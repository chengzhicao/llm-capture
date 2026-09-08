import { z } from "zod";
//#region src/remote.ts
const requestSchema = z.object({ sessionId: z.string().min(1) });
const listResultSchema = z.object({
	records: z.array(z.record(z.string(), z.unknown())),
	persisted: z.string().nullable()
});
const clearResultSchema = z.object({ cleared: z.boolean() });
const TYPERT_REMOTE = {
	package: "dsh-llm-capture",
	descriptors: [{
		id: "dsh-llm-capture#llmLog/list",
		service: "llmLog",
		namespace: "llmLog",
		method: "list",
		invocation: { kind: "direct" },
		parameters: [{
			name: "request",
			wire: "request",
			source: "json",
			codec: {
				mode: "strict",
				typeSymbol: "dsh-llm-capture#LlmLogListRequest",
				schema: requestSchema
			}
		}],
		result: {
			mode: "strict",
			typeSymbol: "dsh-llm-capture#LlmLogListResult",
			schema: listResultSchema
		}
	}, {
		id: "dsh-llm-capture#llmLog/clear",
		service: "llmLog",
		namespace: "llmLog",
		method: "clear",
		invocation: { kind: "direct" },
		parameters: [{
			name: "request",
			wire: "request",
			source: "json",
			codec: {
				mode: "strict",
				typeSymbol: "dsh-llm-capture#LlmLogClearRequest",
				schema: requestSchema
			}
		}],
		result: {
			mode: "strict",
			typeSymbol: "dsh-llm-capture#LlmLogClearResult",
			schema: clearResultSchema
		}
	}]
};
//#endregion
export { TYPERT_REMOTE, TYPERT_REMOTE as default };
