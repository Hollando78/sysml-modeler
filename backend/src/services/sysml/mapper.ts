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

  // State-specific properties
  if (spec.entryAction) props.entryAction = spec.entryAction;
  if (spec.exitAction) props.exitAction = spec.exitAction;
  if (spec.doActivity) props.doActivity = spec.doActivity;

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

  // State-specific
  if (properties.entryAction) spec.entryAction = properties.entryAction;
  if (properties.exitAction) spec.exitAction = properties.exitAction;
  if (properties.doActivity) spec.doActivity = properties.doActivity;

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
