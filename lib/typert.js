import { TYPERT_REMOTE } from "./remote.js";
//#region src/typert.ts
const TYPERT = {
	package: "llm-inspector",
	face: "host",
	schemas: [],
	model: {
		services: [],
		events: [],
		objects: []
	},
	invocations: TYPERT_REMOTE.descriptors
};
//#endregion
export { TYPERT };
