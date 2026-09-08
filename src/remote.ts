import { z } from 'zod'
import type {
  RemoteResult,
  TypertRemoteContribution,
} from '@deepseek-ai/dsh-typert-protocol'

export interface LlmLogListRequest {
  readonly sessionId: string
}

export interface LlmLogListResult {
  readonly records: Record<string, unknown>[]
  readonly persisted: string | null
}

export interface LlmLogClearRequest {
  readonly sessionId: string
}

export interface LlmLogClearResult {
  readonly cleared: boolean
}

const requestSchema = z.object({ sessionId: z.string().min(1) })
const listResultSchema = z.object({
  records: z.array(z.record(z.string(), z.unknown())),
  persisted: z.string().nullable(),
})
const clearResultSchema = z.object({ cleared: z.boolean() })

const descriptors: TypertRemoteContribution['descriptors'] = [
  {
    id: 'llm-inspector#llmLog/list',
    service: 'llmLog',
    namespace: 'llmLog',
    method: 'list',
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: { mode: 'strict', typeSymbol: 'llm-inspector#LlmLogListRequest', schema: requestSchema },
    }],
    result: { mode: 'strict', typeSymbol: 'llm-inspector#LlmLogListResult', schema: listResultSchema },
  },
  {
    id: 'llm-inspector#llmLog/clear',
    service: 'llmLog',
    namespace: 'llmLog',
    method: 'clear',
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: { mode: 'strict', typeSymbol: 'llm-inspector#LlmLogClearRequest', schema: requestSchema },
    }],
    result: { mode: 'strict', typeSymbol: 'llm-inspector#LlmLogClearResult', schema: clearResultSchema },
  },
]

export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: 'llm-inspector',
  descriptors,
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'llmLog/list': (request: LlmLogListRequest) => Promise<RemoteResult<LlmLogListResult>>
    'llmLog/clear': (request: LlmLogClearRequest) => Promise<RemoteResult<LlmLogClearResult>>
  }

  interface TypertRemoteNamespaceMap {
    llmLog: {
      list: (request: LlmLogListRequest) => Promise<RemoteResult<LlmLogListResult>>
      clear: (request: LlmLogClearRequest) => Promise<RemoteResult<LlmLogClearResult>>
    }
  }
}

export default TYPERT_REMOTE
