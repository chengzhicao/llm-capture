# LLM Inspector

这是一个可安装的 Web 插件。Host 监听 `llm/stream`，按 Session 缓存并持久化模型请求与返回；Client 在轨迹 Tab 旁注册“LLM Inspector”，两侧通过 `llmLog` Remote 通信。

## 安装和启动

```sh
pnpm --dir tmp/llm-log-plugin run build
pnpm dsh plugin --profile web add ./tmp/llm-log-plugin
pnpm dsh web
```

修改源码后重新执行 build，并重启 `pnpm dsh web`。`cordis.patch.yml` 中的 `directory` 控制日志目录；`capacity` 和 `flushDelayMs` 可按需覆盖。

## 文件结构

```text
  src/host.ts          Host 监听、缓存和持久化
  src/client.ts        conversation.view 注册和 Remote 调用
  src/view.tsx         日志列表与详情
  src/json-tree.tsx    可折叠 JSON 树
  src/styles.ts        主题样式
  src/remote.ts        Host/Client 共用的严格 Remote descriptor
  src/typert.ts        Host Typert 清单
cordis.patch.yml profile 配置层
```

每条记录包含 `id`、`seq`、`at`、`sessionId`、`provider`、`model`、`purpose`、`request` 和 `response`。`seq` 是当前 Session 内的调用序号，每个新 Session 从 `1` 开始；磁盘上每个 Session 对应一个 JSON 数组文件。
