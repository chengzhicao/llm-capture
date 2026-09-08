/**
 * LLM Inspector —— Client 一半（浏览器 UI）入口
 * 职责：把"抓包视图"注册进 conversation.view（会话视图切换栏新增一项）。
 *
 * 这份是"插件 Client 侧"的 apply。真实 client 插件会经 tsdown 打成
 * client/client.js 进浏览器；动态版里作为 code.client 由 client runner 执行。
 *
 * 注意 client 侧没有文件系统/Node 全局，取数必须走 Host（见 view.tsx 的
 * LlmLogApi 抽象）。
 */

import { createElement as h } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LlmLogView, type LlmLogApi } from './view.js'
import TYPERT_REMOTE from './remote.js'
import { css } from './styles.js'

export const name = 'llm-capture'
export const inject = ['slots', 'remote']

export async function apply(ctx: Context): Promise<void> {
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE)
  ctx.effect(() => disposeRemote, 'llm-capture: Remote')

  const style = typeof document === 'undefined' ? undefined : document.createElement('style')
  if (style !== undefined) {
    style.dataset.llmLog = 'true'
    style.textContent = css
    document.head.append(style)
  }
  const disposeStyle = () => { style?.remove() }
  if (typeof ctx.effect === 'function') ctx.effect(() => disposeStyle, 'llm-capture: styles')

  ctx.inject(['slots', 'remote', 'remote.llmLog'], (viewCtx: Context) => {
    const api: LlmLogApi = {
      list: async (sessionId) => {
        const result = await viewCtx.remote.llmLog.list({ sessionId })
        if (!result.ok) throw result.error
        return result.value
      },
      clear: async (sessionId) => {
        const result = await viewCtx.remote.llmLog.clear({ sessionId })
        if (!result.ok) throw result.error
        return result.value
      },
      poll: (cb, ms) => {
        const timer = window.setInterval(cb, ms)
        return () => window.clearInterval(timer)
      },
    }

    viewCtx.slots.inject('conversation.view', () => viewCtx.slots.register(
      {
        name: 'conversation.view',
        id: 'llm-capture',
        order: 20,
        label: () => 'LLM Inspector',
        inject: sessionId => ({ sessionId }),
      },
      (props: any) => h(LlmLogView, { sessionId: props.sessionId, api }),
    ))
  })
}
