import { z } from "zod";
//#region src/remote.ts
const requestSchema = z.object({ sessionId: z.string().min(1) });
const listResultSchema = z.object({
	records: z.array(z.record(z.string(), z.unknown())),
	persisted: z.string().nullable()
});
const clearResultSchema = z.object({ cleared: z.boolean() });
const TYPERT_REMOTE = {
	package: "dsh-llm-inspector",
	descriptors: [{
		id: "dsh-llm-inspector#llmLog/list",
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
				typeSymbol: "dsh-llm-inspector#LlmLogListRequest",
				schema: requestSchema
			}
		}],
		result: {
			mode: "strict",
			typeSymbol: "dsh-llm-inspector#LlmLogListResult",
			schema: listResultSchema
		}
	}, {
		id: "dsh-llm-inspector#llmLog/clear",
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
				typeSymbol: "dsh-llm-inspector#LlmLogClearRequest",
				schema: requestSchema
			}
		}],
		result: {
			mode: "strict",
			typeSymbol: "dsh-llm-inspector#LlmLogClearResult",
			schema: clearResultSchema
		}
	}]
};
//#endregion
export { TYPERT_REMOTE, TYPERT_REMOTE as default };
