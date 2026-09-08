import s from "@deepseek-ai/schemastery";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
//#region src/host.ts
const name = "llm-inspector";
/** Host services used for persistence and debounced writes. */
const inject = ["fs", "timer"];
/** Validate deployment-varying persistence settings at load. */
const Config = s.object({
	directory: s.string().required(),
	capacity: s.number().step(1).min(1).default(500),
	flushDelayMs: s.number().step(1).min(0).default(400)
});
/** 把可选标量的 undefined 归并为 null（保证最终 JSON 是 lossless JSON）。 */
function orNull(v) {
	return v === void 0 ? null : v;
}
/** 深度清洗为可 JSON 化的纯值（去函数/symbol，防循环爆栈）。 */
function sanitize(value, depth) {
	if (value === null || value === void 0) return null;
	const t = typeof value;
	if (t === "string" || t === "number" || t === "boolean") return value;
	if (depth > 12) return String(value);
	if (Array.isArray(value)) {
		const out = [];
		for (const item of value) out.push(sanitize(item, depth + 1));
		return out;
	}
	if (t === "object") {
		const out = {};
		for (const k of Object.keys(value)) {
			const v = value[k];
			const vt = typeof v;
			if (vt === "function" || vt === "symbol") continue;
			out[k] = sanitize(v, depth + 1);
		}
		return out;
	}
	return String(value);
}
/** 把一个 ContentBlock 压成纯文本（供列表摘要/落盘）。 */
function blockToText(block) {
	if (!block || typeof block !== "object") return "";
	switch (block.type) {
		case "text": return block.text || "";
		case "reasoning": return block.text || "";
		case "tool-call": return (block.name || "") + " " + (block.arguments || block.argumentsRaw || "");
		case "tool-result": return (block.content || []).map((b) => blockToText(b)).filter(Boolean).join("\n");
		case "image": return "[image: " + (block.attachment && block.attachment.name || "") + "]";
		case "file": return "[file: " + (block.attachment && block.attachment.name || "") + "]";
		default: return block.type || "";
	}
}
function messagePlain(msg) {
	if (!msg || typeof msg !== "object") return {
		role: "unknown",
		content: []
	};
	const blocks = Array.isArray(msg.content) ? msg.content : [];
	return {
		role: msg.role || "unknown",
		content: blocks.map((b) => ({
			type: b && b.type || null,
			text: blockToText(b)
		}))
	};
}
function snapshotRequest(o) {
	return {
		provider: orNull(o.provider),
		model: orNull(o.model),
		purpose: orNull(o.purpose),
		temperature: orNull(o.temperature),
		maxTokens: orNull(o.maxTokens),
		reasoningEffort: orNull(o.reasoningEffort),
		system: o.system || "",
		messages: (Array.isArray(o.messages) ? o.messages : []).map(messagePlain),
		tools: Array.isArray(o.tools) ? o.tools.map((t) => sanitize({
			name: t.name,
			description: t.description,
			parameters: t.parameters
		}, 0)) : []
	};
}
async function apply(ctx, config) {
	const { directory, capacity = 500, flushDelayMs = 400 } = config;
	const cache = /* @__PURE__ */ new Map();
	const loading = /* @__PURE__ */ new Map();
	const dirty = /* @__PURE__ */ new Set();
	const flushTimers = /* @__PURE__ */ new Map();
	const seqBySession = /* @__PURE__ */ new Map();
	const fs = ctx.fs;
	const fileName = (sessionId) => directory + "/" + String(sessionId).replace(/[^A-Za-z0-9_-]/g, "_") + ".json";
	async function recordCall(sessionId, options, result) {
		if (!sessionId) return;
		await loadOne(sessionId);
		const seq = (seqBySession.get(sessionId) ?? 0) + 1;
		seqBySession.set(sessionId, seq);
		const rec = {
			id: "call-" + seq,
			seq,
			at: Date.now(),
			sessionId,
			provider: orNull(options.provider),
			model: orNull(options.model),
			purpose: orNull(options.purpose),
			request: snapshotRequest(options),
			response: result
		};
		let list = cache.get(sessionId);
		if (!list) {
			list = [];
			cache.set(sessionId, list);
		}
		list.push(rec);
		if (list.length > capacity) list.splice(0, list.length - capacity);
		dirty.add(sessionId);
		scheduleFlush(sessionId);
	}
	function scheduleFlush(sessionId) {
		const existing = flushTimers.get(sessionId);
		if (existing) try {
			existing();
		} catch {}
		const dispose = ctx.timeout(() => {
			flushTimers.delete(sessionId);
			flushOne(sessionId);
		}, flushDelayMs);
		flushTimers.set(sessionId, dispose);
	}
	async function flushOne(sessionId) {
		dirty.delete(sessionId);
		const list = cache.get(sessionId) || [];
		const content = JSON.stringify(list);
		try {
			const target = await fs.resolve(fileName(sessionId));
			await fs.writeText(target, content);
		} catch (e) {
			console.error("llm-inspector: flush failed", fileName(sessionId), e);
		}
	}
	function loadOne(sessionId) {
		let pending = loading.get(sessionId);
		if (pending !== void 0) return pending;
		pending = (async () => {
			try {
				const target = await fs.resolve(fileName(sessionId));
				if (!await fs.stat(target)) return;
				const text = await fs.readText(target);
				let arr = [];
				try {
					arr = JSON.parse(text);
					if (!Array.isArray(arr)) arr = [];
				} catch {
					arr = [];
				}
				let maxSeq = seqBySession.get(sessionId) ?? 0;
				for (const r of arr) if (r && typeof r.seq === "number" && r.seq > maxSeq) maxSeq = r.seq;
				seqBySession.set(sessionId, maxSeq);
				const live = cache.get(sessionId) ?? [];
				const merged = [...arr, ...live];
				cache.set(sessionId, merged.slice(Math.max(0, merged.length - capacity)));
			} catch {}
		})();
		loading.set(sessionId, pending);
		return pending;
	}
	ctx.on("llm/stream", (options, next) => {
		const sessionId = options && options.sessionId || void 0;
		const startedAt = Date.now();
		const acc = {
			text: "",
			reasoning: "",
			toolCalls: [],
			usage: null,
			finish: null,
			chunks: 0
		};
		const toolByIndex = /* @__PURE__ */ new Map();
		return (async function* () {
			let upstream;
			try {
				upstream = next();
			} catch (e) {
				acc.finish = {
					kind: "error",
					failure: { message: String(e?.message || e) }
				};
				await recordCall(sessionId, options, acc);
				throw e;
			}
			try {
				for await (const chunk of upstream) {
					acc.chunks += 1;
					if (!chunk || typeof chunk !== "object") {
						yield chunk;
						continue;
					}
					switch (chunk.type) {
						case "text-delta":
							acc.text += chunk.text || "";
							break;
						case "reasoning-delta":
							acc.reasoning += chunk.text || "";
							break;
						case "tool-call-delta": {
							let tc = toolByIndex.get(chunk.index);
							if (!tc) {
								tc = {
									id: chunk.id,
									name: "",
									arguments: ""
								};
								toolByIndex.set(chunk.index, tc);
								acc.toolCalls.push(tc);
							}
							if (chunk.name) tc.name = chunk.name;
							tc.arguments += chunk.argumentsDelta || "";
							break;
						}
						case "usage":
							acc.usage = chunk.usage || null;
							break;
						case "finish":
							acc.finish = chunk.reason || null;
							break;
						default: break;
					}
					yield chunk;
				}
			} catch (e) {
				acc.finish = {
					kind: "error",
					failure: { message: String(e?.message || e) }
				};
				throw e;
			} finally {
				acc.startedAt = startedAt;
				acc.durationMs = Date.now() - startedAt;
				await recordCall(sessionId, options, acc);
			}
		})();
	});
	async function listRecords(request) {
		await loadOne(request.sessionId);
		const sessionId = request.sessionId;
		const list = cache.get(sessionId) || [];
		const records = [];
		for (let i = list.length - 1; i >= 0; i--) records.push(list[i]);
		return {
			records,
			persisted: directory
		};
	}
	async function clearRecords(request) {
		const sessionId = request.sessionId;
		await loadOne(sessionId);
		cache.delete(sessionId);
		try {
			const target = await fs.resolve(fileName(sessionId));
			await fs.writeText(target, "[]");
		} catch {}
		return { cleared: true };
	}
	class LlmLogRemoteService extends TypertRemoteService {
		constructor(serviceCtx) {
			super(serviceCtx, "llmLog");
			for (const initialize of remoteInitializers) initialize.call(this);
		}
		list(request) {
			return listRecords(request);
		}
		clear(request) {
			return clearRecords(request);
		}
	}
	const remoteInitializers = [];
	for (const method of ["list", "clear"]) Remote(Reflect.get(LlmLogRemoteService.prototype, method), {
		kind: "method",
		name: method,
		static: false,
		private: false,
		metadata: {},
		access: {
			has: (object) => method in object,
			get: (object) => Reflect.get(object, method)
		},
		addInitializer: (initializer) => {
			remoteInitializers.push(initializer);
		}
	});
	await ctx.plugin(LlmLogRemoteService);
	ctx.effect(() => async () => {
		for (const cancel of flushTimers.values()) cancel();
		flushTimers.clear();
		await Promise.all([...dirty].map((sessionId) => flushOne(sessionId)));
	}, "llm-inspector.flush");
}
//#endregion
export { Config, apply, inject, name };
