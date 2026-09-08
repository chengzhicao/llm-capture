/**
 * LLM Capture —— 浏览器 UI 样式
 * 全部颜色取自 dsh 主题 token（--dsw-alias-*），亮/暗主题自适应。
 */

export const css = `
  .llmlog{--ll-clear:calc(var(--dsh-composer-height,152px) + 10px);position:relative;box-sizing:border-box;height:100%;width:100%;display:flex;flex-direction:column;font-family:var(--dsh-font,ui-sans-serif,system-ui,sans-serif);font-size:13px;color:var(--dsw-alias-label-primary);overflow:hidden;background:transparent}
  .llmlog-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;flex-wrap:wrap}
  .llmlog-input{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:6px;padding:4px 10px;min-width:170px;flex:1;max-width:320px;font-size:12px;outline:none}
  .llmlog-input:focus{border-color:var(--dsw-alias-brand-primary)}
  .llmlog-count{color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap}
  .llmlog-btn{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:6px;padding:4px 12px;cursor:pointer;font-size:12px;white-space:nowrap}
  .llmlog-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
  .llmlog-main{flex:1;display:flex;min-height:0;padding-bottom:var(--ll-clear);box-sizing:border-box}
  .llmlog-list{flex:1;min-width:300px;max-width:44%;overflow:auto;border-right:1px solid var(--dsw-alias-border-l1);padding:6px}
  .llmlog-detail{flex:1.5;min-width:0;display:flex;flex-direction:column;min-height:0}
  .llmlog-row{display:block;width:100%;text-align:left;background:transparent;border:1px solid transparent;color:var(--dsw-alias-label-primary);border-radius:7px;padding:6px 9px;margin-bottom:2px;cursor:pointer;font-size:12px;line-height:1.5}
  .llmlog-row:hover{background:var(--dsw-alias-bg-layer-2)}
  .llmlog-row.sel{background:var(--dsw-alias-interactive-bg-active);border-color:var(--dsw-alias-brand-primary)}
  .llmlog-rowtop{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .llmlog-tag{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-inverted,#fff);border-radius:4px;padding:0 6px;font-size:11px;flex:none}
  .llmlog-mut{color:var(--dsw-alias-label-secondary);font-size:11px}
  .llmlog-snip{color:var(--dsw-alias-label-secondary);font-size:11px;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .llmlog-empty{flex:1;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);font-size:13px;padding:24px;text-align:center}
  .llmlog-dhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
  .llmlog-dmeta{color:var(--dsw-alias-label-secondary);font-size:12px}
  .llmlog-tabs{display:flex;gap:2px;border-bottom:1px solid var(--dsw-alias-border-l1);padding:0 8px;flex:none;overflow-x:auto}
  .llmlog-tab{background:transparent;border:none;border-bottom:2px solid transparent;color:var(--dsw-alias-label-secondary);padding:8px 14px;cursor:pointer;font-size:12px;white-space:nowrap}
  .llmlog-tab:hover{color:var(--dsw-alias-label-primary)}
  .llmlog-tab.on{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary)}
  .llmlog-body{flex:1;overflow:auto;padding:12px 14px;padding-bottom:calc(var(--ll-clear) + 4px);min-height:0;box-sizing:border-box}
  .llmlog-pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-word;margin:0;color:var(--dsw-alias-label-primary)}
  .llmlog-pantitle{font-weight:600;color:var(--dsw-alias-label-secondary);font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.04em}
  .llmlog-sec{margin-bottom:16px}
  .llmlog-none{color:var(--dsw-alias-label-tertiary);font-style:italic}
  .llmlog-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px;overflow:auto}
  .llmlog-trow{display:flex;align-items:flex-start;gap:3px;border-radius:3px;padding:0 2px;flex-wrap:wrap}
  .llmlog-trow.click{cursor:pointer}
  .llmlog-trow.click:hover{background:var(--dsw-alias-bg-layer-2)}
  .llmlog-caret{width:13px;flex:none;display:inline-block;text-align:center;color:var(--dsw-alias-label-tertiary);user-select:none}
  .llmlog-k{color:var(--dsw-alias-link,#4a6cf7);font-weight:600}
  .llmlog-str{color:var(--dsw-alias-label-primary)}
  .llmlog-num{color:var(--dsw-alias-state-success-primary,#2f9e6e)}
  .llmlog-bool{color:var(--dsw-alias-state-warn-primary,#c07a2d)}
  .llmlog-null{color:var(--dsw-alias-label-tertiary);font-style:italic}
  .llmlog-children{margin-left:16px;border-left:1px solid var(--dsw-alias-border-l1);padding-left:4px}
  .llmlog-chip{display:inline-block;font-size:10px;line-height:1;padding:2px 7px;border-radius:9px;margin-left:6px;vertical-align:middle;background:var(--dsw-alias-markdown-inline-code,#3a3f6b);color:var(--dsw-alias-label-primary);cursor:pointer;border:1px solid var(--dsw-alias-border-l2)}
  .llmlog-chip:hover{filter:brightness(1.15)}
  .llmlog-hint{font-size:10px;color:var(--dsw-alias-label-tertiary);padding-left:16px}
  .llmlog-quote{white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary)}
  .llmlog-divider{height:1px;background:var(--dsw-alias-border-l1);margin:18px 0 14px}
  .llmlog-status{font-size:11px;color:var(--dsw-alias-label-tertiary);margin-left:auto}
`
