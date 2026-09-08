import TYPERT_REMOTE from './remote.js'

export const TYPERT = {
  package: 'dsh-llm-inspector',
  face: 'host',
  schemas: [],
  model: { services: [], events: [], objects: [] },
  invocations: TYPERT_REMOTE.descriptors,
}
