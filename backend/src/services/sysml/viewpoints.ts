/**
 * SysML v2 Viewpoint Definitions
 * Based on sysml-reactflow viewpoint system
 */

export interface SysMLViewpoint {
  id: string;
  name: string;
  description: string;
  includeNodeKinds: string[];
  includeEdgeKinds?: string[];
}

export const structuralDefinitionViewpoint: SysMLViewpoint = {
  id: 'sysml.structuralDefinition',
  name: 'Structural Definition Viewpoint',
  description:
    'Focuses on part/action/port/item definitions and the specialization chains that tie them together.',
  includeNodeKinds: [
    'part-definition',
    'action-definition',
    'port-definition',
    'item-definition',
    'attribute-definition',
    'connection-definition',
    'constraint-definition',
    'calculation-definition',
  ],
  includeEdgeKinds: ['specialization', 'definition', 'dependency', 'flow-connection'],
};

export const usageStructureViewpoint: SysMLViewpoint = {
  id: 'sysml.usageStructure',
  name: 'Usage Structure Viewpoint',
  description: 'Shows part, port, action, and item usages mapped back to their definitions.',
  includeNodeKinds: ['part-usage', 'port-usage', 'action-usage', 'item-usage'],
  includeEdgeKinds: ['definition', 'dependency', 'allocate', 'action-flow', 'flow-connection'],
};

export const behaviorControlViewpoint: SysMLViewpoint = {
  id: 'sysml.behaviorControl',
  name: 'Behavior & Control Viewpoint',
  description: 'Captures actions and control nodes with their control and action flows.',
  includeNodeKinds: ['action-definition', 'action-usage', 'activity-control', 'perform-action'],
  includeEdgeKinds: ['control-flow', 'action-flow', 'dependency'],
};

export const interactionViewpoint: SysMLViewpoint = {
  id: 'sysml.interaction',
  name: 'Interaction Viewpoint',
  description: 'Sequence lifelines and messages for interaction scenarios.',
  includeNodeKinds: ['sequence-lifeline'],
  includeEdgeKinds: ['message'],
};

export const stateViewpoint: SysMLViewpoint = {
  id: 'sysml.state',
  name: 'State Viewpoint',
  description: 'State machines, states, and transitions.',
  includeNodeKinds: ['state-machine', 'state', 'state-definition', 'state-usage'],
  includeEdgeKinds: ['transition'],
};

export const requirementViewpoint: SysMLViewpoint = {
  id: 'sysml.requirement',
  name: 'Requirement Viewpoint',
  description: 'Requirement definitions and usages with satisfy/refine/verify relationships.',
  includeNodeKinds: ['requirement-definition', 'requirement-usage'],
  includeEdgeKinds: ['satisfy', 'refine', 'verify', 'dependency'],
};

export const allViewpoints: SysMLViewpoint[] = [
  structuralDefinitionViewpoint,
  usageStructureViewpoint,
  behaviorControlViewpoint,
  interactionViewpoint,
  stateViewpoint,
  requirementViewpoint,
];

export function getViewpointById(id: string): SysMLViewpoint | undefined {
  return allViewpoints.find((vp) => vp.id === id);
}

export function getAvailableTypesForViewpoint(viewpointId: string): {
  nodeKinds: string[];
  edgeKinds: string[];
} {
  const viewpoint = getViewpointById(viewpointId);
  if (!viewpoint) {
    return { nodeKinds: [], edgeKinds: [] };
  }

  return {
    nodeKinds: viewpoint.includeNodeKinds,
    edgeKinds: viewpoint.includeEdgeKinds || [],
  };
}
