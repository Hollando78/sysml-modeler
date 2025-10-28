// Re-export the components and functions needed by the frontend
export { SysMLDiagram, type SysMLDiagramProps } from './SysMLDiagram';
export { createNodesFromSpecs, createEdgesFromRelationships } from './factories';
export type { SysMLNodeSpec, SysMLRelationshipSpec } from './types';
