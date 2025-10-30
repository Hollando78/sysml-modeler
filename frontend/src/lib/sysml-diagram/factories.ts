import type { XYPosition } from 'reactflow';

import type {
  SysMLActionDefinitionSpec,
  SysMLActionUsageSpec,
  SysMLActivityControlSpec,
  SysMLCompartment,
  SysMLEdgeData,
  SysMLItemDefinitionSpec,
  SysMLItemUsageSpec,
  SysMLNodeData,
  SysMLNodeKind,
  SysMLNodeSpec,
  SysMLPartDefinitionSpec,
  SysMLPartUsageSpec,
  SysMLPortDefinitionSpec,
  SysMLPortUsageSpec,
  SysMLPropertySpec,
  SysMLPortSpec,
  SysMLReactFlowEdge,
  SysMLReactFlowNode,
  SysMLRelationshipSpec,
  SysMLSequenceLifelineSpec,
  SysMLSequenceMessageSpec,
  SysMLStateMachineSpec,
  SysMLStateSpec,
  SysMLStateTransitionSpec
} from './types';

// ============================================================================
// Core Factory Infrastructure
// ============================================================================

const defaultPosition: XYPosition = { x: 0, y: 0 };

const normalizePosition = (position?: Partial<XYPosition>): XYPosition => ({
  x: position?.x ?? defaultPosition.x,
  y: position?.y ?? defaultPosition.y
});

// ============================================================================
// Compartment Builders
// ============================================================================

/**
 * Format action for display in compartments
 * Handles both string actions and action references
 */
const formatActionDisplay = (action: string | { actionName: string; actionType: string } | undefined): string | undefined => {
  if (!action) return undefined;
  if (typeof action === 'string') return action;
  // Action reference: show name with link indicator
  return `→ ${action.actionName}`;
};

const buildCompartment = (title: string, items: SysMLCompartment['items']): SysMLCompartment => ({
  title,
  items
});

const propertiesToItems = (
  title: string,
  properties?: SysMLPropertySpec[],
  formatter?: (prop: SysMLPropertySpec) => string
): SysMLCompartment | undefined => {
  if (!properties || properties.length === 0) {
    return undefined;
  }

  return buildCompartment(
    title,
    properties.map((property) => ({
      label: property.name,
      value:
        formatter?.(property) ?? [property.multiplicity, property.type, property.value].filter(Boolean).join(' ')
    }))
  );
};

const portsToCompartment = (ports?: SysMLPortSpec[]): SysMLCompartment | undefined => {
  if (!ports || ports.length === 0) {
    return undefined;
  }

  return buildCompartment(
    'ports',
    ports.map((port) => ({
      label: port.name,
      value: [port.direction?.toUpperCase(), port.type].filter(Boolean).join(' ')
    }))
  );
};

const stringsToCompartment = (title: string, values?: string[]): SysMLCompartment | undefined => {
  if (!values || values.length === 0) {
    return undefined;
  }

  return buildCompartment(
    title,
    values.map((value) => ({
      label: value
    }))
  );
};

const partsToCompartment = (parts?: Array<{
  id: string;
  name: string;
  definitionName: string;
  multiplicity?: string;
}>): SysMLCompartment | undefined => {
  if (!parts || parts.length === 0) {
    return undefined;
  }

  return buildCompartment(
    'parts',
    parts.map((part) => ({
      label: part.name,
      value: `: ${part.definitionName}${part.multiplicity ? ` [${part.multiplicity}]` : ''}`
    }))
  );
};

// ============================================================================
// Generic Node Factory
// ============================================================================

type CompartmentBuilder = (spec: any) => SysMLCompartment | undefined;

interface NodeFactoryConfig {
  type: string;
  kind: SysMLNodeKind;
  elementKind?: 'definition' | 'usage';
  compartmentBuilders?: CompartmentBuilder[];
  dataMappers?: Array<(spec: any, data: Partial<SysMLNodeData>) => void>;
}

const createGenericNode = (
  spec: any,
  config: NodeFactoryConfig,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => {
  const baseData: SysMLNodeData = {
    id: spec.id,
    name: spec.name,
    stereotype: spec.stereotype,
    documentation: spec.description,
    kind: config.kind
  };

  // Apply additional data mappers
  if (config.dataMappers) {
    config.dataMappers.forEach((mapper) => mapper(spec, baseData));
  }

  // Build compartments from builders
  const builtCompartments = config.compartmentBuilders
    ? config.compartmentBuilders.map((builder) => builder(spec)).filter(Boolean)
    : [];

  // Use compartments from spec if they exist (e.g., from backend transformation), otherwise use built ones
  const compartments = spec.compartments || builtCompartments;

  return {
    id: spec.id,
    type: config.type,
    position: normalizePosition(position),
    draggable: true,
    selectable: true,
    connectable: true,
    data: {
      ...baseData,
      ...(config.elementKind && { elementKind: config.elementKind }),
      ...(compartments.length > 0 && {
        compartments: compartments as SysMLCompartment[],
        showCompartments: true  // Default to showing compartments
      }),
      spec // Include the full spec so we have access to parameters
    }
  };
};

// ============================================================================
// Common Data Mappers
// ============================================================================

const addBaseDefinition = (spec: any, data: Partial<SysMLNodeData>) => {
  if (spec.definition) data.baseDefinition = spec.definition;
};

const addRedefines = (spec: any, data: Partial<SysMLNodeData>) => {
  if (spec.redefines) data.redefines = spec.redefines;
};

const addSubsets = (spec: any, data: Partial<SysMLNodeData>) => {
  if (spec.subsets) data.subsets = spec.subsets;
};

const addStatus = (spec: any, data: Partial<SysMLNodeData>) => {
  if (spec.status) data.status = spec.status;
};

const addControlType = (spec: any, data: Partial<SysMLNodeData>) => {
  if (spec.controlType) {
    data.stereotype = spec.controlType;
    data.controlType = spec.controlType;
  }
};

const addEmphasis = (spec: any, data: Partial<SysMLNodeData>) => {
  if (spec.expression) data.emphasis = spec.expression;
  if (spec.calculationBody) data.emphasis = spec.calculationBody;
};

// ============================================================================
// Node Configuration Registry
// ============================================================================

const NODE_CONFIGS: Record<SysMLNodeKind, NodeFactoryConfig> = {
  // Structural - Parts
  'part-definition': {
    type: 'sysml.part-definition',
    kind: 'part-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => propertiesToItems('attributes', spec.attributes),
      (spec) => portsToCompartment(spec.ports),
      (spec) => partsToCompartment(spec.parts),
      (spec) => stringsToCompartment('actions', spec.actions),
      (spec) => stringsToCompartment('states', spec.states)
    ]
  },
  'part-usage': {
    type: 'sysml.part-usage',
    kind: 'part-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition, addRedefines, addSubsets],
    compartmentBuilders: [
      (spec) => propertiesToItems('attributes', spec.attributes),
      (spec) => portsToCompartment(spec.ports),
      (spec) => partsToCompartment(spec.parts)
    ]
  },

  // Structural - Attributes
  'attribute-definition': {
    type: 'sysml.attribute-definition',
    kind: 'attribute-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => spec.type ? buildCompartment('type', [{ label: spec.type }]) : undefined,
      (spec) => spec.defaultValue ? buildCompartment('default', [{ label: spec.defaultValue }]) : undefined
    ]
  },
  'attribute-usage': {
    type: 'sysml.attribute-usage',
    kind: 'attribute-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition, addRedefines, addSubsets],
    compartmentBuilders: [
      (spec) => spec.type ? buildCompartment('type', [{ label: spec.type }]) : undefined,
      (spec) => spec.value ? buildCompartment('value', [{ label: spec.value }]) : undefined
    ]
  },

  // Structural - Ports
  'port-definition': {
    type: 'sysml.port-definition',
    kind: 'port-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => stringsToCompartment('direction', spec.direction ? [spec.direction] : undefined),
      (spec) => propertiesToItems('items', spec.items),
      (spec) => spec.interface ? buildCompartment('interface', [{ label: spec.interface }]) : undefined
    ]
  },
  'port-usage': {
    type: 'sysml.port-usage',
    kind: 'port-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition],
    compartmentBuilders: [
      (spec) => stringsToCompartment('direction', spec.direction ? [spec.direction] : undefined),
      (spec) => propertiesToItems('items', spec.items),
      (spec) => spec.interface ? buildCompartment('interface', [{ label: spec.interface }]) : undefined
    ]
  },

  // Structural - Items
  'item-definition': {
    type: 'sysml.item-definition',
    kind: 'item-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => stringsToCompartment('quantity kind', spec.quantityKind ? [spec.quantityKind] : undefined),
      (spec) => stringsToCompartment('unit', spec.unit ? [spec.unit] : undefined)
    ]
  },
  'item-usage': {
    type: 'sysml.item-usage',
    kind: 'item-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition],
    compartmentBuilders: [
      (spec) => stringsToCompartment('quantity kind', spec.quantityKind ? [spec.quantityKind] : undefined),
      (spec) => stringsToCompartment('unit', spec.unit ? [spec.unit] : undefined)
    ]
  },

  // Structural - Connections
  'connection-definition': {
    type: 'sysml.connection-definition',
    kind: 'connection-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => propertiesToItems('ends', spec.ends),
      (spec) => propertiesToItems('attributes', spec.attributes)
    ]
  },
  'connection-usage': {
    type: 'sysml.connection-usage',
    kind: 'connection-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition, addRedefines],
    compartmentBuilders: [
      (spec) => stringsToCompartment('connected', spec.connectedParts),
      (spec) => propertiesToItems('attributes', spec.attributes)
    ]
  },

  // Structural - Interfaces
  'interface-definition': {
    type: 'sysml.interface-definition',
    kind: 'interface-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => portsToCompartment(spec.ports),
      (spec) => propertiesToItems('attributes', spec.attributes)
    ]
  },
  'interface-usage': {
    type: 'sysml.interface-usage',
    kind: 'interface-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition],
    compartmentBuilders: [
      (spec) => stringsToCompartment('ports', spec.connectedPorts)
    ]
  },

  // Structural - Allocations
  'allocation-definition': {
    type: 'sysml.allocation-definition',
    kind: 'allocation-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => spec.source ? buildCompartment('source', [{ label: spec.source }]) : undefined,
      (spec) => spec.target ? buildCompartment('target', [{ label: spec.target }]) : undefined
    ]
  },
  'allocation-usage': {
    type: 'sysml.allocation-usage',
    kind: 'allocation-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition],
    compartmentBuilders: [
      (spec) => spec.allocatedFrom ? buildCompartment('from', [{ label: spec.allocatedFrom }]) : undefined,
      (spec) => spec.allocatedTo ? buildCompartment('to', [{ label: spec.allocatedTo }]) : undefined
    ]
  },

  // Structural - References
  'reference-usage': {
    type: 'sysml.reference-usage',
    kind: 'reference-usage',
    elementKind: 'usage',
    dataMappers: [addRedefines],
    compartmentBuilders: [
      (spec) => spec.referencedElement ? buildCompartment('references', [{ label: spec.referencedElement }]) : undefined
    ]
  },

  // Structural - Occurrences
  'occurrence-definition': {
    type: 'sysml.occurrence-definition',
    kind: 'occurrence-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => spec.lifeClass ? buildCompartment('lifeClass', [{ label: spec.lifeClass }]) : undefined
    ]
  },
  'occurrence-usage': {
    type: 'sysml.occurrence-usage',
    kind: 'occurrence-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition],
    compartmentBuilders: [
      (spec) => spec.portionOf ? buildCompartment('portionOf', [{ label: spec.portionOf }]) : undefined
    ]
  },

  // Behavioral - Actions
  'action-definition': {
    type: 'sysml.action-definition',
    kind: 'action-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => spec.preconditions ? buildCompartment('preconditions',
        spec.preconditions.map((c: any) => ({ label: c.expression }))
      ) : undefined,
      (spec) => propertiesToItems('inputs', spec.inputs),
      (spec) => propertiesToItems('outputs', spec.outputs),
      (spec) => spec.localVariables ? buildCompartment('local variables',
        spec.localVariables.map((v: any) => ({
          label: v.name,
          value: v.type || ''
        }))
      ) : undefined,
      (spec) => spec.postconditions ? buildCompartment('postconditions',
        spec.postconditions.map((c: any) => ({ label: c.expression }))
      ) : undefined
    ]
  },
  'action-usage': {
    type: 'sysml.action-usage',
    kind: 'action-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition, addRedefines],
    compartmentBuilders: [
      (spec) => spec.preconditions ? buildCompartment('preconditions',
        spec.preconditions.map((c: any) => ({ label: c.expression }))
      ) : undefined,
      (spec) => propertiesToItems('inputs', spec.inputs),
      (spec) => propertiesToItems('outputs', spec.outputs),
      (spec) => spec.localVariables ? buildCompartment('local variables',
        spec.localVariables.map((v: any) => ({
          label: v.name,
          value: v.type || ''
        }))
      ) : undefined,
      (spec) => spec.postconditions ? buildCompartment('postconditions',
        spec.postconditions.map((c: any) => ({ label: c.expression }))
      ) : undefined
    ]
  },

  // Behavioral - Activity Control
  'activity-control': {
    type: 'sysml.activity-control',
    kind: 'activity-control',
    dataMappers: [addControlType]
  },

  // Behavioral - Calculations
  'calculation-definition': {
    type: 'sysml.calculation-definition',
    kind: 'calculation-definition',
    elementKind: 'definition',
    dataMappers: [addEmphasis],
    compartmentBuilders: [
      (spec) => propertiesToItems('inputs', spec.inputs),
      (spec) => propertiesToItems('outputs', spec.outputs),
      (spec) => spec.returnResult ? buildCompartment('return', [{ label: spec.returnResult }]) : undefined
    ]
  },
  'calculation-usage': {
    type: 'sysml.calculation-usage',
    kind: 'calculation-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition, addEmphasis],
    compartmentBuilders: [
      (spec) => propertiesToItems('inputs', spec.inputs),
      (spec) => propertiesToItems('outputs', spec.outputs)
    ]
  },

  // Behavioral - Advanced Actions
  'perform-action': {
    type: 'sysml.perform-action',
    kind: 'perform-action',
    compartmentBuilders: [
      (spec) => spec.performedAction ? buildCompartment('performs', [{ label: spec.performedAction }]) : undefined,
      (spec) => propertiesToItems('inputs', spec.inputs),
      (spec) => propertiesToItems('outputs', spec.outputs)
    ]
  },
  'send-action': {
    type: 'sysml.send-action',
    kind: 'send-action',
    compartmentBuilders: [
      (spec) => spec.payload ? buildCompartment('payload', [{ label: spec.payload }]) : undefined,
      (spec) => spec.target ? buildCompartment('to', [{ label: spec.target }]) : undefined,
      (spec) => spec.via ? buildCompartment('via', [{ label: spec.via }]) : undefined
    ]
  },
  'accept-action': {
    type: 'sysml.accept-action',
    kind: 'accept-action',
    compartmentBuilders: [
      (spec) => spec.payloadType ? buildCompartment('accepts', [{ label: spec.payloadType }]) : undefined,
      (spec) => spec.via ? buildCompartment('via', [{ label: spec.via }]) : undefined,
      (spec) => spec.receiver ? buildCompartment('receiver', [{ label: spec.receiver }]) : undefined
    ]
  },
  'assignment-action': {
    type: 'sysml.assignment-action',
    kind: 'assignment-action',
    compartmentBuilders: [
      (spec) => spec.targetFeature ? buildCompartment('target', [{ label: spec.targetFeature }]) : undefined,
      (spec) => spec.valueExpression ? buildCompartment('value', [{ label: spec.valueExpression }]) : undefined
    ]
  },
  'if-action': {
    type: 'sysml.if-action',
    kind: 'if-action',
    compartmentBuilders: [
      (spec) => spec.condition ? buildCompartment('if', [{ label: spec.condition }]) : undefined,
      (spec) => spec.thenAction ? buildCompartment('then', [{ label: spec.thenAction }]) : undefined,
      (spec) => spec.elseAction ? buildCompartment('else', [{ label: spec.elseAction }]) : undefined
    ]
  },
  'for-loop-action': {
    type: 'sysml.for-loop-action',
    kind: 'for-loop-action',
    compartmentBuilders: [
      (spec) => spec.variable ? buildCompartment('var', [{ label: spec.variable }]) : undefined,
      (spec) => spec.collection ? buildCompartment('in', [{ label: spec.collection }]) : undefined,
      (spec) => spec.body ? buildCompartment('do', [{ label: spec.body }]) : undefined
    ]
  },
  'while-loop-action': {
    type: 'sysml.while-loop-action',
    kind: 'while-loop-action',
    compartmentBuilders: [
      (spec) => spec.condition ? buildCompartment('while', [{ label: spec.condition }]) : undefined,
      (spec) => spec.body ? buildCompartment('do', [{ label: spec.body }]) : undefined
    ]
  },

  // Behavioral - States
  'state': {
    type: 'sysml.state',
    kind: 'state',
    dataMappers: [
      (spec, data) => {
        data.stereotype = 'state';
        if (spec.status) data.status = spec.status;
      }
    ],
    compartmentBuilders: [
      (spec) => spec.entryAction ? { title: 'entry', items: [{ label: spec.entryAction }] } : undefined,
      (spec) => spec.doActivity ? { title: 'do', items: [{ label: spec.doActivity }] } : undefined,
      (spec) => spec.exitAction ? { title: 'exit', items: [{ label: spec.exitAction }] } : undefined
    ]
  },
  'state-machine': {
    type: 'sysml.state-machine',
    kind: 'state-machine',
    dataMappers: [
      (spec, data) => {
        data.stereotype = spec.stereotype ?? 'stateMachine';
      }
    ],
    compartmentBuilders: [
      (spec) => spec.states && spec.states.length > 0
        ? {
            title: 'states',
            items: spec.states.map((state: any) => ({
              label: state.name,
              value: state.definitionName ? `(${state.definitionName})` : ''
            }))
          }
        : undefined
    ]
  },
  'state-definition': {
    type: 'sysml.state-definition',
    kind: 'state-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => {
        const action = formatActionDisplay(spec.entryAction);
        return action ? buildCompartment('entry', [{ label: action }]) : undefined;
      },
      (spec) => {
        const action = formatActionDisplay(spec.doActivity);
        return action ? buildCompartment('do', [{ label: action }]) : undefined;
      },
      (spec) => {
        const action = formatActionDisplay(spec.exitAction);
        return action ? buildCompartment('exit', [{ label: action }]) : undefined;
      },
      (spec) => stringsToCompartment('substates', spec.substates),
      (spec) => spec.internalTransitions ? buildCompartment('internal transitions',
        spec.internalTransitions.map((t: any) => ({
          label: [t.trigger, t.guard, t.effect].filter(Boolean).join(' / ')
        }))
      ) : undefined
    ]
  },
  'state-usage': {
    type: 'sysml.state-usage',
    kind: 'state-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition],
    compartmentBuilders: [
      (spec) => {
        const action = formatActionDisplay(spec.entryAction);
        return action ? buildCompartment('entry', [{ label: action }]) : undefined;
      },
      (spec) => {
        const action = formatActionDisplay(spec.doActivity);
        return action ? buildCompartment('do', [{ label: action }]) : undefined;
      },
      (spec) => {
        const action = formatActionDisplay(spec.exitAction);
        return action ? buildCompartment('exit', [{ label: action }]) : undefined;
      },
      (spec) => stringsToCompartment('substates', spec.substates),
      (spec) => spec.internalTransitions ? buildCompartment('internal transitions',
        spec.internalTransitions.map((t: any) => ({
          label: [t.trigger, t.guard, t.effect].filter(Boolean).join(' / ')
        }))
      ) : undefined
    ]
  },
  'transition-usage': {
    type: 'sysml.transition-usage',
    kind: 'transition-usage',
    compartmentBuilders: [
      (spec) => spec.trigger ? buildCompartment('trigger', [{ label: spec.trigger }]) : undefined,
      (spec) => spec.guard ? buildCompartment('guard', [{ label: spec.guard }]) : undefined,
      (spec) => spec.effect ? buildCompartment('effect', [{ label: spec.effect }]) : undefined
    ]
  },
  'exhibit-state': {
    type: 'sysml.exhibit-state',
    kind: 'exhibit-state',
    compartmentBuilders: [
      (spec) => spec.exhibitedState ? buildCompartment('state', [{ label: spec.exhibitedState }]) : undefined,
      (spec) => spec.performer ? buildCompartment('performer', [{ label: spec.performer }]) : undefined
    ]
  },

  // Requirements & Constraints
  'requirement-definition': {
    type: 'sysml.requirement-definition',
    kind: 'requirement-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => spec.text ? buildCompartment('text', [{ label: spec.text }]) : undefined,
      (spec) => spec.reqId ? buildCompartment('id', [{ label: spec.reqId }]) : undefined,
      (spec) => stringsToCompartment('assume', spec.assumeConstraint),
      (spec) => stringsToCompartment('require', spec.requireConstraint),
      (spec) => stringsToCompartment('concerns', spec.framedConcerns),
      (spec) => stringsToCompartment('actors', spec.actors)
    ]
  },
  'requirement-usage': {
    type: 'sysml.requirement-usage',
    kind: 'requirement-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition, addStatus],
    compartmentBuilders: [
      (spec) => spec.text ? buildCompartment('text', [{ label: spec.text }]) : undefined,
      (spec) => spec.reqId ? buildCompartment('id', [{ label: spec.reqId }]) : undefined,
      (spec) => stringsToCompartment('assume', spec.assumeConstraint),
      (spec) => stringsToCompartment('require', spec.requireConstraint)
    ]
  },
  'constraint-definition': {
    type: 'sysml.constraint-definition',
    kind: 'constraint-definition',
    elementKind: 'definition',
    dataMappers: [addEmphasis],
    compartmentBuilders: []
  },
  'constraint-usage': {
    type: 'sysml.constraint-usage',
    kind: 'constraint-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition, addEmphasis],
    compartmentBuilders: []
  },

  // Verification & Analysis Cases
  'verification-case-definition': {
    type: 'sysml.verification-case-definition',
    kind: 'verification-case-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => spec.verifiedRequirement ? buildCompartment('verifies', [{ label: spec.verifiedRequirement }]) : undefined,
      (spec) => spec.objectiveRequirement ? buildCompartment('objective', [{ label: spec.objectiveRequirement }]) : undefined
    ]
  },
  'verification-case-usage': {
    type: 'sysml.verification-case-usage',
    kind: 'verification-case-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition, addStatus],
    compartmentBuilders: [
      (spec) => spec.verifiedRequirement ? buildCompartment('verifies', [{ label: spec.verifiedRequirement }]) : undefined,
      (spec) => spec.verificationMethod ? buildCompartment('method', [{ label: spec.verificationMethod }]) : undefined
    ]
  },
  'analysis-case-definition': {
    type: 'sysml.analysis-case-definition',
    kind: 'analysis-case-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => spec.analysisAction ? buildCompartment('action', [{ label: spec.analysisAction }]) : undefined,
      (spec) => spec.resultExpression ? buildCompartment('result', [{ label: spec.resultExpression }]) : undefined
    ]
  },
  'analysis-case-usage': {
    type: 'sysml.analysis-case-usage',
    kind: 'analysis-case-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition],
    compartmentBuilders: [
      (spec) => spec.analysisAction ? buildCompartment('action', [{ label: spec.analysisAction }]) : undefined,
      (spec) => spec.resultExpression ? buildCompartment('result', [{ label: spec.resultExpression }]) : undefined
    ]
  },

  // Use Cases & Concerns
  'use-case-definition': {
    type: 'sysml.use-case-definition',
    kind: 'use-case-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => stringsToCompartment('includes', spec.includedUseCases),
      (spec) => spec.objectiveRequirement ? buildCompartment('objective', [{ label: spec.objectiveRequirement }]) : undefined
    ]
  },
  'use-case-usage': {
    type: 'sysml.use-case-usage',
    kind: 'use-case-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition, addStatus],
    compartmentBuilders: [
      (spec) => stringsToCompartment('actors', spec.actors),
      (spec) => stringsToCompartment('includes', spec.includes),
      (spec) => stringsToCompartment('extends', spec.extends)
    ]
  },
  'concern-definition': {
    type: 'sysml.concern-definition',
    kind: 'concern-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => spec.text ? buildCompartment('text', [{ label: spec.text }]) : undefined
    ]
  },
  'concern-usage': {
    type: 'sysml.concern-usage',
    kind: 'concern-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition],
    compartmentBuilders: [
      (spec) => spec.text ? buildCompartment('text', [{ label: spec.text }]) : undefined,
      (spec) => stringsToCompartment('stakeholders', spec.stakeholders)
    ]
  },

  // Organizational
  'package': {
    type: 'sysml.package',
    kind: 'package',
    compartmentBuilders: [
      (spec) => stringsToCompartment('members', spec.members),
      (spec) => stringsToCompartment('imports', spec.imports)
    ]
  },
  'library-package': {
    type: 'sysml.library-package',
    kind: 'library-package',
    compartmentBuilders: [
      (spec) => stringsToCompartment('members', spec.members)
    ]
  },

  // Interactions
  'sequence-lifeline': {
    type: 'sysml.sequence-lifeline',
    kind: 'sequence-lifeline',
    dataMappers: [
      (spec, data) => {
        data.stereotype = spec.stereotype ?? 'lifeline';
        data.documentation = spec.classifier;
      }
    ]
  },
  'interaction': {
    type: 'sysml.interaction',
    kind: 'interaction',
    compartmentBuilders: [
      (spec) => stringsToCompartment('participants', spec.participants),
      (spec) => stringsToCompartment('messages', spec.messages)
    ]
  },

  // Metadata
  'metadata-definition': {
    type: 'sysml.metadata-definition',
    kind: 'metadata-definition',
    elementKind: 'definition',
    compartmentBuilders: [
      (spec) => spec.baseType ? buildCompartment('baseType', [{ label: spec.baseType }]) : undefined,
      (spec) => propertiesToItems('attributes', spec.attributes)
    ]
  },
  'metadata-usage': {
    type: 'sysml.metadata-usage',
    kind: 'metadata-usage',
    elementKind: 'usage',
    dataMappers: [addBaseDefinition],
    compartmentBuilders: [
      (spec) => spec.annotatedElement ? buildCompartment('annotates', [{ label: spec.annotatedElement }]) : undefined
    ]
  },
  'comment': {
    type: 'sysml.comment',
    kind: 'comment',
    dataMappers: [
      (spec, data) => {
        data.name = 'Comment';
        data.documentation = spec.body;
      }
    ],
    compartmentBuilders: [
      (spec) => spec.annotatedElement ? buildCompartment('annotates', [{ label: spec.annotatedElement }]) : undefined
    ]
  },
  'documentation': {
    type: 'sysml.documentation',
    kind: 'documentation',
    dataMappers: [
      (spec, data) => {
        data.name = 'Documentation';
        data.documentation = spec.body;
      }
    ],
    compartmentBuilders: [
      (spec) => spec.documentedElement ? buildCompartment('documents', [{ label: spec.documentedElement }]) : undefined
    ]
  }
};

// ============================================================================
// Legacy Individual Factory Functions (for backwards compatibility)
// ============================================================================

export const createPartDefinitionNode = (
  spec: SysMLPartDefinitionSpec,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['part-definition'], position);

export const createPartUsageNode = (
  spec: SysMLPartUsageSpec,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['part-usage'], position);

export const createActionDefinitionNode = (
  spec: SysMLActionDefinitionSpec,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['action-definition'], position);

export const createActionUsageNode = (
  spec: SysMLActionUsageSpec,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['action-usage'], position);

export const createPortDefinitionNode = (
  spec: SysMLPortDefinitionSpec,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['port-definition'], position);

export const createPortUsageNode = (
  spec: SysMLPortUsageSpec,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['port-usage'], position);

export const createItemDefinitionNode = (
  spec: SysMLItemDefinitionSpec,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['item-definition'], position);

export const createItemUsageNode = (
  spec: SysMLItemUsageSpec,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['item-usage'], position);

export const createActivityControlNode = (
  spec: SysMLActivityControlSpec,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['activity-control'], position);

export const createStateNode = (
  spec: SysMLStateSpec,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['state'], position);

export const createStateMachineNode = (
  spec: SysMLStateMachineSpec,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['state-machine'], position);

export const createSequenceLifelineNode = (
  spec: SysMLSequenceLifelineSpec,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['sequence-lifeline'], position);

export const createStateTransitionEdge = (
  transition: SysMLStateTransitionSpec
): SysMLReactFlowEdge => ({
  id: transition.id,
  type: 'sysml.relationship',
  source: transition.source,
  target: transition.target,
  data: {
    kind: 'transition',
    label: transition.trigger ?? transition.id,
    guard: transition.guard,
    effect: transition.effect
  }
});

export const createSequenceMessageEdge = (
  message: SysMLSequenceMessageSpec
): SysMLReactFlowEdge => ({
  id: message.id,
  type: 'sysml.relationship',
  source: message.source,
  target: message.target,
  data: {
    kind: 'message',
    label: message.label,
    guard: message.guard,
    trigger: message.type
  }
});

export const createRelationshipEdge = (spec: SysMLRelationshipSpec): SysMLReactFlowEdge => ({
  id: spec.id,
  type: 'sysml.relationship',
  source: spec.source,
  target: spec.target,
  data: {
    kind: spec.type,
    // Use spec.label if provided, otherwise use the relationship type formatted nicely
    label: spec.label || spec.type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    rationale: spec.rationale,
    trigger: spec.trigger,
    guard: spec.guard,
    effect: spec.effect
  } satisfies SysMLEdgeData
});


// ============================================================================
// Additional Legacy Factory Functions
// ============================================================================

export const createAttributeDefinitionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['attribute-definition'], position);

export const createAttributeUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['attribute-usage'], position);

export const createConnectionDefinitionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['connection-definition'], position);

export const createConnectionUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['connection-usage'], position);

export const createInterfaceDefinitionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['interface-definition'], position);

export const createInterfaceUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['interface-usage'], position);

export const createAllocationDefinitionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['allocation-definition'], position);

export const createAllocationUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['allocation-usage'], position);

export const createReferenceUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['reference-usage'], position);

export const createOccurrenceDefinitionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['occurrence-definition'], position);

export const createOccurrenceUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['occurrence-usage'], position);

export const createCalculationDefinitionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['calculation-definition'], position);

export const createCalculationUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['calculation-usage'], position);

export const createPerformActionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['perform-action'], position);

export const createSendActionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['send-action'], position);

export const createAcceptActionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['accept-action'], position);

export const createAssignmentActionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['assignment-action'], position);

export const createIfActionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['if-action'], position);

export const createForLoopActionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['for-loop-action'], position);

export const createWhileLoopActionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['while-loop-action'], position);

export const createStateDefinitionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['state-definition'], position);

export const createStateUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['state-usage'], position);

export const createTransitionUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['transition-usage'], position);

export const createExhibitStateNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['exhibit-state'], position);

export const createRequirementDefinitionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['requirement-definition'], position);

export const createRequirementUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['requirement-usage'], position);

export const createConstraintDefinitionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['constraint-definition'], position);

export const createConstraintUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['constraint-usage'], position);

export const createVerificationCaseDefinitionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['verification-case-definition'], position);

export const createVerificationCaseUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['verification-case-usage'], position);

export const createAnalysisCaseDefinitionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['analysis-case-definition'], position);

export const createAnalysisCaseUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['analysis-case-usage'], position);

export const createUseCaseDefinitionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['use-case-definition'], position);

export const createUseCaseUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['use-case-usage'], position);

export const createConcernDefinitionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['concern-definition'], position);

export const createConcernUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['concern-usage'], position);

export const createPackageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['package'], position);

export const createLibraryPackageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['library-package'], position);

export const createInteractionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['interaction'], position);

export const createMetadataDefinitionNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['metadata-definition'], position);

export const createMetadataUsageNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['metadata-usage'], position);

export const createCommentNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['comment'], position);

export const createDocumentationNode = (
  spec: any,
  position?: Partial<XYPosition>
): SysMLReactFlowNode => createGenericNode(spec, NODE_CONFIGS['documentation'], position);

export const createNodesFromSpecs = (
  specs: SysMLNodeSpec[],
  positions: Record<string, Partial<XYPosition>> = {}
): SysMLReactFlowNode[] =>
  specs.map((descriptor, index) => {
    const fallback = { x: (index % 3) * 320, y: Math.floor(index / 3) * 260 };
    const position = positions[descriptor.spec.id] ?? fallback;

    const config = NODE_CONFIGS[descriptor.kind];
    if (!config) {
      throw new Error(`Unknown node kind: ${descriptor.kind}`);
    }

    return createGenericNode(descriptor.spec, config, position);
  });

export const createEdgesFromRelationships = (
  specs: SysMLRelationshipSpec[]
): SysMLReactFlowEdge[] => specs.map((relationship) => createRelationshipEdge(relationship));
