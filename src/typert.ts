import TYPERT_REMOTE from './remote.js'

export const TYPERT = {
  package: 'llm-inspector',
  face: 'host',
  schemas: [],
  model: { services: [], events: [], objects: [] },
  invocations: TYPERT_REMOTE.descriptors,
}
