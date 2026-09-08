import TYPERT_REMOTE from './remote.js'

export const TYPERT = {
  package: 'dsh-llm-capture',
  face: 'host',
  schemas: [],
  model: { services: [], events: [], objects: [] },
  invocations: TYPERT_REMOTE.descriptors,
}
