export interface SysMLParameter {
  name: string;
  type?: string;
  direction: 'in' | 'out' | 'inout';
  multiplicity?: string;
}

export interface SysMLInternalTransition {
  trigger?: string;
  guard?: string;
  effect?: string;
}

export interface SysMLCondition {
  expression: string;
}

export interface SysMLVariable {
  name: string;
  type?: string;
  initialValue?: string;
}

export interface SysMLAttribute {
  name: string;
  type?: string;
  multiplicity?: string;
  value?: string;
}

export interface SysMLPort {
  name: string;
  type?: string;
  direction?: 'in' | 'out' | 'inout';
}

export interface SysMLActionReference {
  actionId: string;
  actionType: 'action-definition' | 'action-usage';
  actionName: string;
}

export interface SysMLViewpoint {
  id: string;
  name: string;
  description: string;
  includeNodeKinds: string[];
  includeEdgeKinds?: string[];
}

export interface SysMLNodeSpec {
  kind: string;
  spec: any;
}

export interface SysMLRelationshipSpec {
  id: string;
  type: string;
  source: string;
  target: string;
  label?: string;
  [key: string]: any;
}

export interface SysMLModel {
  nodes: SysMLNodeSpec[];
  relationships: SysMLRelationshipSpec[];
}

export interface ViewpointTypes {
  nodeKinds: string[];
  edgeKinds: string[];
}

export interface SysMLDiagram {
  id: string;
  name: string;
  viewpointId: string;
  elementIds: string[];
  positions: Record<string, { x: number; y: number }>;
  hiddenRelationshipIds?: string[];
  createdAt: string;
  updatedAt: string;
}
