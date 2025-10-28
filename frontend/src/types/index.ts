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
  createdAt: string;
  updatedAt: string;
}
