/**
 * LLM Capture —— 抓包式两栏视图（浏览器 UI）
 * 左栏：单行可扫列表（含提示词摘要）；右栏：聚焦详情（Tab + JSON 树）。
 *
 * 数据来源：通过 host.call / ctx.remote 从 Host 拉取（真实插件用 Remote；
 * 动态版用 harness.handle + host.call）。
 */

import * as React from 'react'
import { createElement as h } from 'react'
import type { ReactNode } from 'react'
import { JsonTree } from './json-tree.js'

function jstr(v: unknown, sp?: number): string {
  try { return JSON.stringify(v, null, sp === undefined ? undefined : sp) } catch { return String(v) }
}

/** 搜索用的整条记录纯文本 */
function recordHaystack(rec: any): string {
  const parts = [rec.provider, rec.model, rec.purpose,
    rec.request ? jstr(rec.request) : '', rec.response ? jstr(rec.response) : '']
  return parts.filter(Boolean).join('\n')
}

/** 列表摘要：取最后一条 user 消息的文本 */
function snippetOf(call: any): string {
  const req = call.request || {}
  const msgs = Array.isArray(req.messages) ? req.messages : []
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m && m.role === 'user') {
      const txt = Array.isArray(m.content) ? m.content.map((b: any) => (b && b.text) || '').join(' ') : ''
      const s = txt.replace(/\s+/g, ' ').trim()
      if (s) return s
    }
  }
  return ''
}

/** messages 分节阅读 */
function MessageLines({ call }: { call: any }): ReactNode {
  const msgs = (call.request || {}).messages
  if (!Array.isArray(msgs) || !msgs.length) return h('div', { className: 'llmlog-none' }, '无消息')
  const rows = msgs.map((m: any, i: number) => {
    const text = Array.isArray(m.content) ? m.content.map((b: any) => (b && b.text) || '').join('\n') : ''
    return h('div', { className: 'llmlog-sec', key: i },
      h('div', { className: 'llmlog-pantitle' }, '#' + (i + 1) + ' · ' + (m.role || '?')),
      h('pre', { className: 'llmlog-pre' }, text || '（无文本内容）'))
  })
  return h('div', null, rows)
}

/** 返回 tab：易读分区 + 完整返回记录 JSON 树 */
function ResponsePane({ call }: { call: any }): ReactNode {
  const res = call.response || {}
  const panes: ReactNode[] = []
  panes.push(h('div', { className: 'llmlog-sec', key: 'm' },
    h('div', { className: 'llmlog-pantitle' }, '完成情况 / usage'),
    h('pre', { className: 'llmlog-pre' }, jstr({ finish: res.finish || null, usage: res.usage || null, chunks: res.chunks || 0, durationMs: res.durationMs || null }, 2))))
  panes.push(h('div', { className: 'llmlog-sec', key: 't' },
    h('div', { className: 'llmlog-pantitle' }, '返回文本'),
    h('pre', { className: 'llmlog-pre' }, res.text || '（无文本）')))
  if (res.reasoning) panes.push(h('div', { className: 'llmlog-sec', key: 'r' },
    h('div', { className: 'llmlog-pantitle' }, '推理 reasoning'),
    h('pre', { className: 'llmlog-pre' }, res.reasoning)))
  if (res.toolCalls && res.toolCalls.length) panes.push(h('div', { className: 'llmlog-sec', key: 'c' },
    h('div', { className: 'llmlog-pantitle' }, '工具调用 tool_calls'),
    h('pre', { className: 'llmlog-pre' }, jstr(res.toolCalls, 2))))
  panes.push(h('div', { className: 'llmlog-divider', key: 'dv' }))
  panes.push(h('div', { className: 'llmlog-sec', key: 'raw' },
    h('div', { className: 'llmlog-pantitle' }, '返回原始记录 (JSON)'),
    res && typeof res === 'object' ? h(JsonTree, { data: res }) : h('pre', { className: 'llmlog-pre' }, jstr(res, 2))))
  return h('div', null, panes)
}

/** 列表一行 */
function Row({ call, selected, onSelect }: { call: any; selected: boolean; onSelect: (seq: number) => void }): ReactNode {
  const res = call.response || {}
  const usage = res.usage
  const finish = res.finish
  const meta = [(call.provider || '?') + ' / ' + (call.model || '?')]
  if (call.purpose) meta.push('purpose:' + call.purpose)
  if (res.durationMs != null) meta.push(res.durationMs + 'ms')
  if (usage) {
    let tk = '↑' + (usage.inputTokens ?? '?') + ' ↓' + (usage.outputTokens ?? '?')
    if (usage.reasoningTokens != null) tk += ' ∿' + usage.reasoningTokens
    meta.push(tk)
  }
  if (finish) meta.push('finish:' + (finish.kind || '?'))
  const snip = snippetOf(call)
  return h('button', { className: 'llmlog-row' + (selected ? ' sel' : ''), onClick: () => onSelect(call.seq) },
    h('div', { className: 'llmlog-rowtop' },
      h('span', { className: 'llmlog-tag' }, '#' + call.seq),
      h('span', { className: 'llmlog-mut' }, meta.join(' · '))),
    snip ? h('div', { className: 'llmlog-snip' }, snip) : null)
}

/** 右侧详情 */
function Detail({ call }: { call: any }): ReactNode {
  const [tab, setTab] = React.useState('request')
  const tabs = [['request', '请求 JSON'], ['messages', '请求 messages'], ['response', '返回'], ['raw', '原文']] as const
  let body: ReactNode
  if (tab === 'request') body = h(JsonTree, { data: call.request })
  else if (tab === 'messages') body = h(MessageLines, { call })
  else if (tab === 'response') body = h(ResponsePane, { call })
  else body = h('pre', { className: 'llmlog-pre' }, jstr(call, 2))
  const res = call.response || {}
  const usage = res.usage
  const meta = [(call.provider || '') + ' / ' + (call.model || '')]
  if (usage && (usage.inputTokens != null || usage.outputTokens != null)) meta.push('in:' + (usage.inputTokens ?? '?') + ' out:' + (usage.outputTokens ?? '?'))
  if (res.durationMs != null) meta.push(res.durationMs + 'ms')
  return h('div', { className: 'llmlog-detail' },
    h('div', { className: 'llmlog-dhead' },
      h('span', { className: 'llmlog-tag' }, '#' + call.seq),
      h('span', { className: 'llmlog-dmeta' }, meta.join(' · '))),
    h('div', { className: 'llmlog-tabs' }, tabs.map(t => h('button', { key: t[0], className: 'llmlog-tab' + (tab === t[0] ? ' on' : ''), onClick: () => setTab(t[0]) }, t[1]))),
    h('div', { className: 'llmlog-body' }, body))
}

/**
 * 主视图。数据从 Host 读取：list() / clear() 两个取数函数由外部注入——
 * 动态版注入 host.call 的封装；真实插件注入 ctx.remote 的封装。
 * 视图本身不关心传输实现。
 */
export interface LlmLogApi {
  list(sessionId: string): Promise<{ records: any[]; persisted?: string | null }>
  clear(sessionId: string): Promise<unknown>
  /** 轮询间隔毫秒；返回 cleanup（动态版用 ctx.interval，真实插件用 ctx.interval 或定时器） */
  poll(cb: () => void, ms: number): () => void
}

export function LlmLogView({ sessionId, api }: { sessionId?: string; api: LlmLogApi }): ReactNode {
  const [records, setRecords] = React.useState<any[]>([])
  const [query, setQuery] = React.useState('')
  const [selectedSeq, setSelectedSeq] = React.useState<number | null>(null)
  const [persisted, setPersisted] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    if (!sessionId) return
    api.list(sessionId).then(res => {
      setRecords((res && Array.isArray(res.records)) ? res.records : [])
      setPersisted((res && res.persisted) ? (res.persisted as string) : null)
      setError(null)
    }).catch(cause => { setError(cause instanceof Error ? cause.message : String(cause)) })
  }, [sessionId, api])

  React.useEffect(() => {
    load()
    const off = api.poll(load, 1500)
    return () => { try { off() } catch { /* ignore */ } }
  }, [load, api])

  const q = query.trim().toLowerCase()
  const filtered = q ? records.filter(r => recordHaystack(r).toLowerCase().indexOf(q) >= 0) : records
  const selected = records.find(r => r.seq === selectedSeq) || filtered[0] || null
  const clear = () => {
    if (!sessionId) return
    api.clear(sessionId).then(() => {
      setSelectedSeq(null)
      load()
    }).catch(cause => { setError(cause instanceof Error ? cause.message : String(cause)) })
  }
  const rows = filtered.map(r => h(Row, { key: r.seq, call: r, selected: selected !== null && selected.seq === r.seq, onSelect: (sq) => setSelectedSeq(sq) }))

  // 关键：data-conversation-composer-overlay 让 ConversationRoot 把底部输入框
  // 视为绝对覆盖层，由本视图自持滚动；滚动区 padding-bottom 预留输入框高度。
  return h('div', { className: 'llmlog', 'data-conversation-composer-overlay': '' },
    h('div', { className: 'llmlog-bar' },
      h('b', null, 'LLM Capture'),
      h('input', { className: 'llmlog-input', placeholder: '搜索请求 / 返回全文…', value: query, onChange: (e) => setQuery(e.target.value) }),
      h('span', { className: 'llmlog-count' }, filtered.length + ' / ' + records.length + ' 条'),
      h('button', { className: 'llmlog-btn', onClick: () => load() }, '刷新'),
      h('button', { className: 'llmlog-btn', onClick: () => clear() }, '清空'),
      persisted ? h('span', { className: 'llmlog-status', title: persisted }, '已持久化到磁盘') : null),
    error
      ? h('div', { className: 'llmlog-empty' }, '读取失败：' + error)
      : records.length === 0
      ? h('div', { className: 'llmlog-empty' }, '本会话暂无模型调用记录（运行一次任务后自动出现）')
      : h('div', { className: 'llmlog-main' },
          h('div', { className: 'llmlog-list' }, rows),
          selected ? h(Detail, { call: selected }) : h('div', { className: 'llmlog-empty' }, '选择左侧一条调用查看详情')))
}
