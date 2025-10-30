/**
 * Maps SysML v2 types to Neo4j node labels and relationship types
 * Based on sysml-reactflow type system
 */

export type SysMLNodeKind = string;
export type SysMLEdgeKind = string;

/**
 * Convert SysML node kind to Neo4j label
 * Example: 'part-definition' -> 'PartDefinition'
 */
export function nodeKindToLabel(kind: SysMLNodeKind): string {
  return kind
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Convert Neo4j label to SysML node kind
 * Example: 'PartDefinition' -> 'part-definition'
 */
export function labelToNodeKind(label: string): SysMLNodeKind {
  return label
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .slice(1);
}

/**
 * Convert SysML edge kind to Neo4j relationship type
 * Example: 'control-flow' -> 'CONTROL_FLOW'
 */
export function edgeKindToRelType(kind: SysMLEdgeKind): string {
  return kind.replace(/-/g, '_').toUpperCase();
}

/**
 * Convert Neo4j relationship type to SysML edge kind
 * Example: 'CONTROL_FLOW' -> 'control-flow'
 */
export function relTypeToEdgeKind(relType: string): SysMLEdgeKind {
  return relType.replace(/_/g, '-').toLowerCase();
}

/**
 * Get all Neo4j labels for a node (includes base label)
 */
export function getNodeLabels(kind: SysMLNodeKind): string[] {
  const specificLabel = nodeKindToLabel(kind);
  return ['SysMLElement', specificLabel];
}

/**
 * Determine if a node kind is a definition or usage
 */
export function getElementKind(kind: SysMLNodeKind): 'definition' | 'usage' | null {
  if (kind.endsWith('-definition')) {
    return 'definition';
  }
  if (kind.endsWith('-usage')) {
    return 'usage';
  }
  return null;
}

/**
 * Map SysML spec properties to Neo4j node properties
 */
export function specToNeo4jProperties(spec: any): Record<string, any> {
  const props: Record<string, any> = {
    id: spec.id,
    name: spec.name,
  };

  // Optional common properties
  if (spec.stereotype) props.stereotype = spec.stereotype;
  if (spec.description) props.description = spec.description;
  if (spec.documentation) props.documentation = spec.documentation;
  if (spec.status) props.status = spec.status;
  if (spec.text) props.text = spec.text;

  // Definition/usage relationship
  if (spec.definition) props.definition = spec.definition;

  // Store complex properties as JSON strings
  if (spec.attributes && Array.isArray(spec.attributes)) {
    props.attributes = JSON.stringify(spec.attributes);
  }
  if (spec.ports && Array.isArray(spec.ports)) {
    props.ports = JSON.stringify(spec.ports);
  }
  if (spec.tags && Array.isArray(spec.tags)) {
    props.tags = JSON.stringify(spec.tags);
  }
  if (spec.parameters && Array.isArray(spec.parameters)) {
    props.parameters = JSON.stringify(spec.parameters);
  }
  if (spec.internalTransitions !== undefined) {
    if (Array.isArray(spec.internalTransitions) && spec.internalTransitions.length > 0) {
      props.internalTransitions = JSON.stringify(spec.internalTransitions);
    } else {
      props.internalTransitions = null; // Explicitly clear the property
    }
  }
  if (spec.preconditions && Array.isArray(spec.preconditions)) {
    props.preconditions = JSON.stringify(spec.preconditions);
  }
  if (spec.postconditions && Array.isArray(spec.postconditions)) {
    props.postconditions = JSON.stringify(spec.postconditions);
  }
  if (spec.localVariables && Array.isArray(spec.localVariables)) {
    props.localVariables = JSON.stringify(spec.localVariables);
  }

  // State-specific properties
  // Actions can be strings (simple text) or objects (action references)
  if (spec.entryAction !== undefined) {
    if (typeof spec.entryAction === 'object' && spec.entryAction !== null) {
      props.entryAction = JSON.stringify(spec.entryAction);
    } else {
      props.entryAction = spec.entryAction || null; // Allow clearing
    }
  }
  if (spec.exitAction !== undefined) {
    if (typeof spec.exitAction === 'object' && spec.exitAction !== null) {
      props.exitAction = JSON.stringify(spec.exitAction);
    } else {
      props.exitAction = spec.exitAction || null; // Allow clearing
    }
  }
  if (spec.doActivity !== undefined) {
    if (typeof spec.doActivity === 'object' && spec.doActivity !== null) {
      props.doActivity = JSON.stringify(spec.doActivity);
    } else {
      props.doActivity = spec.doActivity || null; // Allow clearing
    }
  }

  // Port-specific properties
  if (spec.interface) props.interface = spec.interface;

  // Use case properties
  if (spec.actors && Array.isArray(spec.actors)) {
    props.actors = JSON.stringify(spec.actors);
  }
  if (spec.includes && Array.isArray(spec.includes)) {
    props.includes = JSON.stringify(spec.includes);
  }
  if (spec.includedUseCases && Array.isArray(spec.includedUseCases)) {
    props.includedUseCases = JSON.stringify(spec.includedUseCases);
  }
  if (spec.extends && Array.isArray(spec.extends)) {
    props.extends = JSON.stringify(spec.extends);
  }
  if (spec.objectiveRequirement) props.objectiveRequirement = spec.objectiveRequirement;
  if (spec.subjectParameter) props.subjectParameter = spec.subjectParameter;

  // Relationship-specific properties (for edges)
  if (spec.trigger) props.trigger = spec.trigger;
  if (spec.guard) props.guard = spec.guard;
  if (spec.effect) props.effect = spec.effect;
  if (spec.rationale) props.rationale = spec.rationale;

  // Layout positions (stored as JSON keyed by viewpoint ID)
  if (spec.positions) {
    props.layoutPositions = JSON.stringify(spec.positions);
  }

  return props;
}

/**
 * Map Neo4j node properties back to SysML spec
 */
export function neo4jPropertiesToSpec(properties: Record<string, any>): any {
  const spec: any = {
    id: properties.id,
    name: properties.name,
  };

  // Optional properties
  if (properties.stereotype) spec.stereotype = properties.stereotype;
  if (properties.description) spec.description = properties.description;
  if (properties.documentation) spec.documentation = properties.documentation;
  if (properties.status) spec.status = properties.status;
  if (properties.text) spec.text = properties.text;
  if (properties.definition) spec.definition = properties.definition;

  // Parse JSON properties
  if (properties.attributes) {
    try {
      spec.attributes = JSON.parse(properties.attributes);
    } catch (e) {
      console.warn('Failed to parse attributes JSON:', e);
    }
  }
  if (properties.ports) {
    try {
      spec.ports = JSON.parse(properties.ports);
    } catch (e) {
      console.warn('Failed to parse ports JSON:', e);
    }
  }
  if (properties.tags) {
    try {
      spec.tags = JSON.parse(properties.tags);
    } catch (e) {
      console.warn('Failed to parse tags JSON:', e);
    }
  }
  if (properties.parameters) {
    try {
      spec.parameters = JSON.parse(properties.parameters);
    } catch (e) {
      console.warn('Failed to parse parameters JSON:', e);
    }
  }
  if (properties.internalTransitions) {
    try {
      spec.internalTransitions = JSON.parse(properties.internalTransitions);
    } catch (e) {
      console.warn('Failed to parse internalTransitions JSON:', e);
    }
  }
  if (properties.preconditions) {
    try {
      spec.preconditions = JSON.parse(properties.preconditions);
    } catch (e) {
      console.warn('Failed to parse preconditions JSON:', e);
    }
  }
  if (properties.postconditions) {
    try {
      spec.postconditions = JSON.parse(properties.postconditions);
    } catch (e) {
      console.warn('Failed to parse postconditions JSON:', e);
    }
  }
  if (properties.localVariables) {
    try {
      spec.localVariables = JSON.parse(properties.localVariables);
    } catch (e) {
      console.warn('Failed to parse localVariables JSON:', e);
    }
  }

  // State-specific
  // Actions can be strings or JSON objects (action references)
  if (properties.entryAction) {
    try {
      spec.entryAction = JSON.parse(properties.entryAction);
    } catch (e) {
      // If not valid JSON, treat as plain string
      spec.entryAction = properties.entryAction;
    }
  }
  if (properties.exitAction) {
    try {
      spec.exitAction = JSON.parse(properties.exitAction);
    } catch (e) {
      spec.exitAction = properties.exitAction;
    }
  }
  if (properties.doActivity) {
    try {
      spec.doActivity = JSON.parse(properties.doActivity);
    } catch (e) {
      spec.doActivity = properties.doActivity;
    }
  }

  // Port-specific
  if (properties.interface) spec.interface = properties.interface;

  // Use case properties
  if (properties.actors) {
    try {
      spec.actors = JSON.parse(properties.actors);
    } catch (e) {
      console.warn('Failed to parse actors JSON:', e);
    }
  }
  if (properties.includes) {
    try {
      spec.includes = JSON.parse(properties.includes);
    } catch (e) {
      console.warn('Failed to parse includes JSON:', e);
    }
  }
  if (properties.includedUseCases) {
    try {
      spec.includedUseCases = JSON.parse(properties.includedUseCases);
    } catch (e) {
      console.warn('Failed to parse includedUseCases JSON:', e);
    }
  }
  if (properties.extends) {
    try {
      spec.extends = JSON.parse(properties.extends);
    } catch (e) {
      console.warn('Failed to parse extends JSON:', e);
    }
  }
  if (properties.objectiveRequirement) spec.objectiveRequirement = properties.objectiveRequirement;
  if (properties.subjectParameter) spec.subjectParameter = properties.subjectParameter;

  // Relationship-specific
  if (properties.trigger) spec.trigger = properties.trigger;
  if (properties.guard) spec.guard = properties.guard;
  if (properties.effect) spec.effect = properties.effect;
  if (properties.rationale) spec.rationale = properties.rationale;

  // Layout positions
  if (properties.layoutPositions) {
    try {
      spec.positions = JSON.parse(properties.layoutPositions);
    } catch (e) {
      console.warn('Failed to parse layout positions JSON:', e);
    }
  }

  return spec;
}
