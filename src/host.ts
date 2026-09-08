/**
 * LLM Inspector —— Host 一半
 * =========================
 * 职责：
 *   1. 订阅进程级 `llm/stream` 瀑布事件，捕获每次对大模型的请求与返回；
 *   2. 将记录按 session 存进内存环形缓冲（最近 CAP 条）；
 *   3. 落盘到 <DIR>/<sanitized-sessionId>.json（每会话一个 JSON 数组），
 *      插件重启/进程重启后可由磁盘回读，历史不丢。
 *
 * 这是"插件 Host 侧"的形态：导出一个带 apply(ctx) 的对象/函数。
 * 真实插件里这份代码放进一个 .ts 文件，由 cordis loader 加载即可。
 * 动态版里它作为 code.host 被 cordis_define/cordis_run 执行，
 * 并额外提供了 harness.handle 的 RPC（动态 runner 专属）。
 *
 * 注意：`ctx` 的类型来自 @deepseek-ai/cordis；事件名 'llm/stream'、
 *   GenerateOptions / StreamChunk 来自 @deepseek-ai/dsh-llm。
 */

import type { Context } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/cordis-plugin-timer'
import type {} from '@deepseek-ai/dsh-fs'
import type {
  LlmLogClearRequest,
  LlmLogClearResult,
  LlmLogListRequest,
  LlmLogListResult,
} from './remote.js'

export const name = 'llm-inspector'

/** Host services used for persistence and debounced writes. */
export const inject = ['fs', 'timer']

/** Host persistence policy. */
export interface Config {
  /** Directory containing one JSON file per Session. */
  directory: string
  /** Maximum records retained per Session. */
  capacity?: number
  /** Delay used to coalesce adjacent writes. */
  flushDelayMs?: number
}

/** Validate deployment-varying persistence settings at load. */
export const Config: s<Config> = s.object({
  directory: s.string().required(),
  capacity: s.number().step(1).min(1).default(500),
  flushDelayMs: s.number().step(1).min(0).default(400),
})

/** 把可选标量的 undefined 归并为 null（保证最终 JSON 是 lossless JSON）。 */
function orNull(v: unknown): unknown {
  return v === undefined ? null : v
}

/** 深度清洗为可 JSON 化的纯值（去函数/symbol，防循环爆栈）。 */
function sanitize(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return null
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean') return value
  if (depth > 12) return String(value)
  if (Array.isArray(value)) {
    const out: unknown[] = []
    for (const item of value) out.push(sanitize(item, depth + 1))
    return out
  }
  if (t === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value as Record<string, unknown>)) {
      const v = (value as Record<string, unknown>)[k]
      const vt = typeof v
      if (vt === 'function' || vt === 'symbol') continue
      out[k] = sanitize(v, depth + 1)
    }
    return out
  }
  return String(value)
}

/** 把一个 ContentBlock 压成纯文本（供列表摘要/落盘）。 */
function blockToText(block: any): string {
  if (!block || typeof block !== 'object') return ''
  switch (block.type) {
    case 'text': return block.text || ''
    case 'reasoning': return block.text || ''
    case 'tool-call': return (block.name || '') + ' ' + (block.arguments || block.argumentsRaw || '')
    case 'tool-result': {
      const parts = ((block.content || []) as any[]).map(b => blockToText(b)).filter(Boolean)
      return parts.join('\n')
    }
    case 'image': return '[image: ' + ((block.attachment && block.attachment.name) || '') + ']'
    case 'file': return '[file: ' + ((block.attachment && block.attachment.name) || '') + ']'
    default: return block.type || ''
  }
}

function messagePlain(msg: any): { role: string; content: { type: string | null; text: string }[] } {
  if (!msg || typeof msg !== 'object') return { role: 'unknown', content: [] }
  const blocks = Array.isArray(msg.content) ? msg.content : []
  return {
    role: msg.role || 'unknown',
    content: blocks.map((b: any) => ({ type: (b && b.type) || null, text: blockToText(b) })),
  }
}

function snapshotRequest(o: any): any {
  return {
    provider: orNull(o.provider),
    model: orNull(o.model),
    purpose: orNull(o.purpose),
    temperature: orNull(o.temperature),
    maxTokens: orNull(o.maxTokens),
    reasoningEffort: orNull(o.reasoningEffort),
    system: o.system || '',
    messages: (Array.isArray(o.messages) ? o.messages : []).map(messagePlain),
    tools: Array.isArray(o.tools)
      ? o.tools.map((t: any) => sanitize({ name: t.name, description: t.description, parameters: t.parameters }, 0))
      : [],
  }
}

export async function apply(ctx: Context, config: Config): Promise<void> {
  const { directory, capacity = 500, flushDelayMs = 400 } = config
  // —— in-memory 缓存：sessionId -> 记录数组（旧->新）——
  const cache = new Map<string, any[]>()
  const loading = new Map<string, Promise<void>>()
  const dirty = new Set<string>()
  const flushTimers = new Map<string, () => void>()
  const seqBySession = new Map<string, number>()
  const fs = ctx.fs

  const fileName = (sessionId: string): string =>
    directory + '/' + String(sessionId).replace(/[^A-Za-z0-9_-]/g, '_') + '.json'

  async function recordCall(sessionId: string | undefined, options: any, result: any): Promise<void> {
    if (!sessionId) return
    await loadOne(sessionId)
    const seq = (seqBySession.get(sessionId) ?? 0) + 1
    seqBySession.set(sessionId, seq)
    const rec = {
      id: 'call-' + seq,
      seq,
      at: Date.now(),
      sessionId,
      provider: orNull(options.provider),
      model: orNull(options.model),
      purpose: orNull(options.purpose),
      request: snapshotRequest(options),
      response: result,
    }
    let list = cache.get(sessionId)
    if (!list) { list = []; cache.set(sessionId, list) }
    list.push(rec)
    if (list.length > capacity) list.splice(0, list.length - capacity)
    dirty.add(sessionId)
    scheduleFlush(sessionId)
  }

  // —— 磁盘持久化 ——
  function scheduleFlush(sessionId: string): void {
    const existing = flushTimers.get(sessionId)
    if (existing) { try { existing() } catch { /* ignore */ } }
    const dispose = ctx.timeout(() => {
      flushTimers.delete(sessionId)
      void flushOne(sessionId)
    }, flushDelayMs)
    flushTimers.set(sessionId, dispose)
  }
  async function flushOne(sessionId: string): Promise<void> {
    dirty.delete(sessionId)
    const list = cache.get(sessionId) || []
    const content = JSON.stringify(list)
    try {
      const target = await fs.resolve(fileName(sessionId))
      await fs.writeText(target, content)
    } catch (e) {
      console.error('llm-inspector: flush failed', fileName(sessionId), e)
    }
  }
  function loadOne(sessionId: string): Promise<void> {
    let pending = loading.get(sessionId)
    if (pending !== undefined) return pending
    pending = (async () => {
      try {
        const target = await fs.resolve(fileName(sessionId))
        const existing = await fs.stat(target)
        if (!existing) return
        const text = await fs.readText(target)
        let arr: any[] = []
        try { arr = JSON.parse(text); if (!Array.isArray(arr)) arr = [] } catch { arr = [] }
        let maxSeq = seqBySession.get(sessionId) ?? 0
        for (const r of arr) if (r && typeof r.seq === 'number' && r.seq > maxSeq) maxSeq = r.seq
        seqBySession.set(sessionId, maxSeq)
        const live = cache.get(sessionId) ?? []
        const merged = [...arr, ...live]
        cache.set(sessionId, merged.slice(Math.max(0, merged.length - capacity)))
      } catch { /* unreadable -> keep empty */ }
    })()
    loading.set(sessionId, pending)
    return pending
  }

  // —— 监听进程级 llm/stream 瀑布（waterfall）——
  // 注意：waterfall 事件签名是 (options, next)。监听器必须调用 next() 拿到
  // 真实上游流并原样透传 chunk；在透传同时做累积与落盘。
  ctx.on('llm/stream', (options: any, next: () => AsyncIterable<any>) => {
    const sessionId = (options && options.sessionId) || undefined
    const startedAt = Date.now()
    const acc: any = { text: '', reasoning: '', toolCalls: [], usage: null, finish: null, chunks: 0 }
    const toolByIndex = new Map<number, any>()
    return (async function* () {
      let upstream: AsyncIterable<any>
      try {
        upstream = next()
      } catch (e) {
        acc.finish = { kind: 'error', failure: { message: String((e as Error)?.message || e) } }
        await recordCall(sessionId, options, acc)
        throw e
      }
      try {
        for await (const chunk of upstream) {
          acc.chunks += 1
          if (!chunk || typeof chunk !== 'object') { yield chunk; continue }
          switch (chunk.type) {
            case 'text-delta': acc.text += chunk.text || ''; break
            case 'reasoning-delta': acc.reasoning += chunk.text || ''; break
            case 'tool-call-delta': {
              let tc = toolByIndex.get(chunk.index)
              if (!tc) { tc = { id: chunk.id, name: '', arguments: '' }; toolByIndex.set(chunk.index, tc); acc.toolCalls.push(tc) }
              if (chunk.name) tc.name = chunk.name
              tc.arguments += chunk.argumentsDelta || ''
              break
            }
            case 'usage': acc.usage = chunk.usage || null; break
            case 'finish': acc.finish = chunk.reason || null; break
            default: break
          }
          yield chunk
        }
      } catch (e) {
        acc.finish = { kind: 'error', failure: { message: String((e as Error)?.message || e) } }
        throw e
      } finally {
        acc.startedAt = startedAt
        acc.durationMs = Date.now() - startedAt
        await recordCall(sessionId, options, acc)
      }
    })()
  })

  // —— 对外暴露读取/清空 ——
  async function listRecords(request: LlmLogListRequest): Promise<LlmLogListResult> {
    await loadOne(request.sessionId)
    const sessionId = request.sessionId
    const list = cache.get(sessionId) || []
    const records: any[] = []
    for (let i = list.length - 1; i >= 0; i--) records.push(list[i])
    return { records, persisted: directory }
  }
  async function clearRecords(request: LlmLogClearRequest): Promise<LlmLogClearResult> {
    const sessionId = request.sessionId
    await loadOne(sessionId)
    cache.delete(sessionId)
    try {
      const target = await fs.resolve(fileName(sessionId))
      await fs.writeText(target, '[]')
    } catch { /* an unreadable persistence target does not prevent clearing memory */ }
    return { cleared: true }
  }

  class LlmLogRemoteService extends TypertRemoteService {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'llmLog')
      for (const initialize of remoteInitializers) initialize.call(this)
    }

    list(request: LlmLogListRequest): Promise<LlmLogListResult> {
      return listRecords(request)
    }

    clear(request: LlmLogClearRequest): Promise<LlmLogClearResult> {
      return clearRecords(request)
    }
  }

  const remoteInitializers: Array<(this: LlmLogRemoteService) => void> = []
  for (const method of ['list', 'clear'] as const) {
    Remote(
      Reflect.get(LlmLogRemoteService.prototype, method) as (
        this: LlmLogRemoteService,
        ...args: unknown[]
      ) => unknown,
      {
        kind: 'method',
        name: method,
        static: false,
        private: false,
        metadata: {},
        access: {
          has: object => method in object,
          get: object => Reflect.get(object, method) as (
            this: LlmLogRemoteService,
            ...args: unknown[]
          ) => unknown,
        },
        addInitializer: initializer => { remoteInitializers.push(initializer) },
      },
    )
  }

  await ctx.plugin(LlmLogRemoteService)
  ctx.effect(() => async () => {
    for (const cancel of flushTimers.values()) cancel()
    flushTimers.clear()
    await Promise.all([...dirty].map(sessionId => flushOne(sessionId)))
  }, 'llm-inspector.flush')
}
