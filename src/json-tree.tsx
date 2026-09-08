/**
 * 可折叠 JSON 树 —— 通用组件
 * 特性：
 *  - 对象/数组可折叠，显示键数与首值预览；
 *  - 长字符串（>90）可展开/收起；
 *  - 若字符串内部本身就是 JSON（以 { 或 [ 开头且可 parse），可一键"格式化"
 *    成嵌套树，并可切回原文。
 * 用 React.createElement 手写，不依赖第三方 JSON 树库。
 */

import * as React from 'react'
import { createElement as h } from 'react'
import type { ReactNode } from 'react'

function jstr(v: unknown, sp?: number): string {
  try { return JSON.stringify(v, null, sp === undefined ? undefined : sp) } catch { return String(v) }
}
function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}
function maybeParse(value: unknown): unknown {
  if (typeof value !== 'string') return null
  const t = value.trim()
  if (!t || (t[0] !== '{' && t[0] !== '[')) return null
  try { return JSON.parse(value) } catch { return null }
}

/** 叶子：短原始值 */
function Leaf({ name, text, cls }: { name: string; text: string; cls: string }): ReactNode {
  return h('div', { className: 'llmlog-trow' },
    h('span', { className: 'llmlog-caret' }),
    h('span', { className: 'llmlog-k' }, name + ': '),
    h('span', { className: cls }, text))
}

/** 长字符串（普通文本）：可展开折叠 */
function LongString({ name, value }: { name: string; value: string }): ReactNode {
  const [open, setOpen] = React.useState(false)
  const q = jstr(value)
  if (!open) {
    return h('div', { className: 'llmlog-trow click', onClick: () => setOpen(true) },
      h('span', { className: 'llmlog-caret' }, '▸'),
      h('span', { className: 'llmlog-k' }, name + ': '),
      h('span', { className: 'llmlog-str' }, trunc(q, 90)))
  }
  return h('div', null,
    h('div', { className: 'llmlog-trow click', onClick: () => setOpen(false) },
      h('span', { className: 'llmlog-caret' }, '▾'),
      h('span', { className: 'llmlog-k' }, name + ': '),
      h('span', { className: 'llmlog-str' }, trunc(q, 40))),
    h('div', { className: 'llmlog-children' }, h('div', { className: 'llmlog-quote' }, value)))
}

/** 字符串里其实是一段 JSON 文本：可在"嵌套树 / 原文"间切换 */
function JsonString({ name, value }: { name: string; value: string }): ReactNode {
  const [open, setOpen] = React.useState(false)
  const [asTree, setAsTree] = React.useState(true)
  const parsed = maybeParse(value)
  const summary = h('span', { className: 'llmlog-str' }, trunc(jstr(value), 60))
  const chipLabel = (open && asTree) ? '原文' : '格式化'
  const chip = h('span', {
    className: 'llmlog-chip',
    onClick: (e) => { e.stopPropagation(); if (!open) setOpen(true); setAsTree(!(open && asTree)) },
  }, chipLabel)
  if (!open) {
    return h('div', { className: 'llmlog-trow click', onClick: () => { setOpen(true); setAsTree(true) } },
      h('span', { className: 'llmlog-caret' }, '▸'),
      h('span', { className: 'llmlog-k' }, name + ': '),
      summary, chip,
      h('span', { className: 'llmlog-hint' }, '（字符串·内含 JSON）'))
  }
  return h('div', null,
    h('div', { className: 'llmlog-trow click', onClick: () => setOpen(false) },
      h('span', { className: 'llmlog-caret' }, '▾'),
      h('span', { className: 'llmlog-k' }, name + ': '),
      summary, chip,
      h('span', { className: 'llmlog-hint' }, '（字符串·内含 JSON）')),
    h('div', { className: 'llmlog-children' },
      asTree
        ? (parsed !== null && parsed !== undefined
            ? h(ValueChildren, { data: parsed, depth: 1 })
            : h('div', { className: 'llmlog-quote' }, value))
        : h('div', { className: 'llmlog-quote' }, value)))
}

/** 对象 / 数组容器 */
function ObjectNode({ name, value, depth }: { name: string; value: Record<string, unknown> | unknown[]; depth: number }): ReactNode {
  const [open, setOpen] = React.useState(depth < 1)
  const isArr = Array.isArray(value)
  const keys = Object.keys(value as Record<string, unknown>)
  const size = isArr ? ('[' + value.length + ']') : ('{' + keys.length + '}')
  if (!open) {
    let preview = ''
    if (keys.length) {
      const f = (value as Record<string, unknown>)[keys[0]]
      preview = trunc(jstr(f), 34)
    }
    return h('div', { className: 'llmlog-trow click', onClick: () => setOpen(true) },
      h('span', { className: 'llmlog-caret' }, '▸'),
      h('span', { className: 'llmlog-k' }, name + ': ' + size + (preview ? ' ' + preview : '')))
  }
  return h('div', null,
    h('div', { className: 'llmlog-trow click', onClick: () => setOpen(false) },
      h('span', { className: 'llmlog-caret' }, '▾'),
      h('span', { className: 'llmlog-k' }, name + ': ' + size)),
    h('div', { className: 'llmlog-children' },
      keys.map((k: string) => h(ValueNode, {
        key: k,
        name: isArr ? ('[' + k + ']') : k,
        value: (value as Record<string, unknown>)[k],
        depth: depth + 1,
      }))))
}

/** 顶层分发器：按值的类型选组件 */
function ValueNode({ name, value, depth }: { name: string; value: unknown; depth: number }): ReactNode {
  if (value !== null && typeof value === 'object') return h(ObjectNode, { name, value, depth })
  if (value === null) return h(Leaf, { name, text: 'null', cls: 'llmlog-null' })
  if (typeof value === 'boolean') return h(Leaf, { name, text: String(value), cls: 'llmlog-bool' })
  if (typeof value === 'number') return h(Leaf, { name, text: String(value), cls: 'llmlog-num' })
  const parsed = maybeParse(value)
  if (parsed !== null && parsed !== undefined) return h(JsonString, { name, value })
  if (value.length > 90) return h(LongString, { name, value })
  return h(Leaf, { name, text: jstr(value), cls: 'llmlog-str' })
}

function ValueChildren({ data, depth }: { data: unknown; depth: number }): ReactNode {
  if (data === null || typeof data !== 'object') return null
  const isArr = Array.isArray(data)
  const keys = Object.keys(data as Record<string, unknown>)
  return h('div', null,
    keys.map((k: string) => h(ValueNode, {
      key: k,
      name: isArr ? ('[' + k + ']') : k,
      value: (data as Record<string, unknown>)[k],
      depth,
    })))
}

/** 对外：把一个对象渲染成可折叠 JSON 树 */
export function JsonTree({ data }: { data: unknown }): ReactNode {
  if (data === undefined || data === null) return h('div', { className: 'llmlog-none' }, '空')
  return h('div', { className: 'llmlog-code' }, h(ValueChildren, { data, depth: 0 }))
}
