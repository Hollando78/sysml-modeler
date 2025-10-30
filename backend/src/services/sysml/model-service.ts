import { getSession } from '../neo4j/driver.js';
import {
  nodeKindToLabel,
  edgeKindToRelType,
  relTypeToEdgeKind,
  labelToNodeKind,
  specToNeo4jProperties,
  neo4jPropertiesToSpec,
  getNodeLabels,
} from './mapper.js';
import { getViewpointById } from './viewpoints.js';

/**
 * Transform parameters into compartments for display
 */
function parametersToCompartments(parameters?: any[]): any[] | undefined {
  if (!parameters || parameters.length === 0) {
    return undefined;
  }

  const inputs = parameters.filter(p => p.direction === 'in' || p.direction === 'inout');
  const outputs = parameters.filter(p => p.direction === 'out' || p.direction === 'inout');

  const compartments: any[] = [];

  if (inputs.length > 0) {
    compartments.push({
      title: 'inputs',
      items: inputs.map(p => ({
        label: p.name,
        value: p.type || '',
        emphasis: p.inherited ? false : undefined, // De-emphasize inherited params
        inherited: p.inherited || false, // Track if parameter is inherited
      })),
    });
  }

  if (outputs.length > 0) {
    compartments.push({
      title: 'outputs',
      items: outputs.map(p => ({
        label: p.name,
        value: p.type || '',
        emphasis: p.inherited ? false : undefined,
        inherited: p.inherited || false,
      })),
    });
  }

  return compartments.length > 0 ? compartments : undefined;
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

/**
 * Fetch all SysML elements and relationships, optionally filtered by viewpoint
 */
export async function fetchModel(viewpointId?: string): Promise<SysMLModel> {
  const session = getSession();
  try {
    const viewpoint = viewpointId ? getViewpointById(viewpointId) : null;

    // Build node label filter
    let nodeLabelFilter = '';
    if (viewpoint && viewpoint.includeNodeKinds.length > 0) {
      const labels = viewpoint.includeNodeKinds.map((kind) => nodeKindToLabel(kind));
      nodeLabelFilter = `WHERE ${labels.map((label) => `'${label}' IN labels(n)`).join(' OR ')}`;
    }

    // Build relationship type filter
    let relTypeFilter = '';
    if (viewpoint && viewpoint.includeEdgeKinds && viewpoint.includeEdgeKinds.length > 0) {
      const relTypes = viewpoint.includeEdgeKinds.map((kind) => edgeKindToRelType(kind));
      relTypeFilter = `WHERE type(r) IN [${relTypes.map((t) => `'${t}'`).join(', ')}]`;
    }

    const query = `
      // Fetch nodes with their owned parts and definition (for parameter inheritance)
      MATCH (n:SysMLElement)
      ${nodeLabelFilter}
      OPTIONAL MATCH (n)-[compRel:COMPOSITION|AGGREGATION]->(partUsage:PartUsage)-[defRel:DEFINITION]->(partDef:SysMLElement)
      WITH n, collect({
        id: partUsage.id,
        name: partUsage.name,
        definitionId: partDef.id,
        definitionName: partDef.name,
        multiplicity: partUsage.multiplicity,
        relationshipType: type(compRel)
      }) as ownedParts
      // For state machines, fetch their owned states
      OPTIONAL MATCH (n)-[stateCompRel:COMPOSITION|AGGREGATION]->(stateUsage:StateUsage)-[stateDefRel:DEFINITION]->(stateDef:SysMLElement)
      WHERE 'StateMachine' IN labels(n)
      WITH n, ownedParts, collect({
        id: stateUsage.id,
        name: stateUsage.name,
        definitionId: stateDef.id,
        definitionName: stateDef.name,
        relationshipType: type(stateCompRel)
      }) as ownedStates
      // For action/calculation usages, fetch their definition's parameters
      OPTIONAL MATCH (n)-[:DEFINITION]->(def:SysMLElement)
      WHERE 'ActionUsage' IN labels(n) OR 'CalculationUsage' IN labels(n)
      WITH n, ownedParts, ownedStates, def
      WITH collect({
        labels: labels(n),
        properties: properties(n),
        ownedParts: CASE WHEN size(ownedParts) > 0 AND ownedParts[0].id IS NOT NULL THEN ownedParts ELSE [] END,
        ownedStates: CASE WHEN size(ownedStates) > 0 AND ownedStates[0].id IS NOT NULL THEN ownedStates ELSE [] END,
        definitionParameters: CASE WHEN def IS NOT NULL THEN def.parameters ELSE NULL END
      }) as nodes

      // Fetch relationships
      OPTIONAL MATCH (source:SysMLElement)-[r]->(target:SysMLElement)
      ${relTypeFilter}
      WITH nodes, collect({
        type: type(r),
        source: source.id,
        target: target.id,
        properties: properties(r)
      }) as relationships

      RETURN nodes, relationships
    `;

    const result = await session.run(query);
    const record = result.records[0];

    if (!record) {
      return { nodes: [], relationships: [] };
    }

    // Parse nodes
    const nodesData = record.get('nodes') as any[];
    console.log('[DEBUG] fetchModel: Processing', nodesData.length, 'nodes');
    const nodes: SysMLNodeSpec[] = nodesData.map((node) => {
      // Get the specific label (not SysMLElement)
      const specificLabel = node.labels.find((l: string) => l !== 'SysMLElement');
      const kind = labelToNodeKind(specificLabel);
      const spec = neo4jPropertiesToSpec(node.properties);

      console.log('[DEBUG] Processing node:', { kind, id: spec.id, hasParameters: !!spec.parameters, hasDefinitionParameters: !!node.definitionParameters });

      // Add owned parts if present
      if (node.ownedParts && node.ownedParts.length > 0) {
        spec.parts = node.ownedParts.map((part: any) => ({
          id: part.id,
          name: part.name,
          definitionId: part.definitionId,
          definitionName: part.definitionName,
          multiplicity: part.multiplicity,
          relationshipType: part.relationshipType,
        }));
      }

      // Add owned states if present (for state machines)
      if (node.ownedStates && node.ownedStates.length > 0) {
        spec.states = node.ownedStates.map((state: any) => ({
          id: state.id,
          name: state.name,
          definitionId: state.definitionId,
          definitionName: state.definitionName,
          relationshipType: state.relationshipType,
        }));
      }

      // Merge inherited parameters from definition (for usages)
      if ((kind === 'action-usage' || kind === 'calculation-usage') && node.definitionParameters) {
        try {
          const inheritedParams = JSON.parse(node.definitionParameters);
          const localParams = spec.parameters || [];

          console.log('[DEBUG] Inheriting parameters for', kind, ':', {
            inherited: inheritedParams,
            local: localParams
          });

          // Mark inherited parameters
          const inheritedWithFlag = inheritedParams.map((p: any) => ({ ...p, inherited: true }));

          // Merge: local parameters override inherited ones with same name
          const localNames = new Set(localParams.map((p: any) => p.name));
          const mergedParams = [
            ...inheritedWithFlag.filter((p: any) => !localNames.has(p.name)),
            ...localParams.map((p: any) => ({ ...p, inherited: false }))
          ];

          spec.parameters = mergedParams;
          console.log('[DEBUG] Merged parameters:', mergedParams);
        } catch (e) {
          console.warn('[DEBUG] Failed to parse definition parameters:', e);
        }
      }

      // Transform parameters into compartments for action definitions/usages
      if ((kind === 'action-definition' || kind === 'action-usage' || kind === 'calculation-usage') && spec.parameters) {
        console.log('[DEBUG] Found parameters for', kind, ':', spec.parameters);
        const compartments = parametersToCompartments(spec.parameters);
        console.log('[DEBUG] Generated compartments for', kind, ':', compartments);
        spec.compartments = compartments;
      }

      return { kind, spec };
    });

    // Parse relationships
    const relationshipsData = record.get('relationships') as any[];
    const relationships: SysMLRelationshipSpec[] = relationshipsData
      .filter((rel) => rel.type !== null) // Filter out null relationships from OPTIONAL MATCH
      .map((rel) => {
        const type = relTypeToEdgeKind(rel.type);
        return {
          id: rel.properties.id || `${rel.source}-${type}-${rel.target}`,
          type,
          source: rel.source,
          target: rel.target,
          label: rel.properties.label,
          ...neo4jPropertiesToSpec(rel.properties),
        };
      });

    return { nodes, relationships };
  } finally {
    await session.close();
  }
}

/**
 * Create a new SysML element
 */
export async function createElement(nodeSpec: SysMLNodeSpec): Promise<void> {
  const session = getSession();
  try {
    const labels = getNodeLabels(nodeSpec.kind);
    const properties = specToNeo4jProperties(nodeSpec.spec);

    // Add timestamps
    properties.createdAt = new Date().toISOString();
    properties.updatedAt = new Date().toISOString();

    const labelString = labels.map((l) => `:${l}`).join('');
    const query = `
      CREATE (n${labelString})
      SET n = $properties
      RETURN n
    `;

    await session.run(query, { properties });
  } finally {
    await session.close();
  }
}

/**
 * Update an existing SysML element
 */
export async function updateElement(id: string, updates: Partial<any>): Promise<void> {
  const session = getSession();
  try {
    console.log('[DEBUG] updateElement called with:', { id, updates });
    const properties = specToNeo4jProperties(updates);
    console.log('[DEBUG] Converted to Neo4j properties:', properties);
    properties.updatedAt = new Date().toISOString();

    // Remove id from updates (shouldn't be updated)
    delete properties.id;

    const query = `
      MATCH (n:SysMLElement {id: $id})
      SET n += $properties
      RETURN n
    `;

    const result = await session.run(query, { id, properties });

    if (result.records.length === 0) {
      throw new Error(`Element with id ${id} not found`);
    }
    console.log('[DEBUG] Element updated successfully');
  } finally {
    await session.close();
  }
}

/**
 * Delete a SysML element and all its relationships
 */
export async function deleteElement(id: string): Promise<void> {
  const session = getSession();
  try {
    const query = `
      MATCH (n:SysMLElement {id: $id})
      DETACH DELETE n
    `;

    await session.run(query, { id });
  } finally {
    await session.close();
  }
}

/**
 * Create a relationship between two elements
 */
export async function createRelationship(relationshipSpec: SysMLRelationshipSpec): Promise<void> {
  const session = getSession();
  try {
    const relType = edgeKindToRelType(relationshipSpec.type);
    const properties = specToNeo4jProperties(relationshipSpec);

    // Add timestamps
    properties.createdAt = new Date().toISOString();
    properties.updatedAt = new Date().toISOString();

    const query = `
      MATCH (source:SysMLElement {id: $sourceId})
      MATCH (target:SysMLElement {id: $targetId})
      CREATE (source)-[r:${relType}]->(target)
      SET r = $properties
      RETURN r
    `;

    const result = await session.run(query, {
      sourceId: relationshipSpec.source,
      targetId: relationshipSpec.target,
      properties,
    });

    if (result.records.length === 0) {
      throw new Error('Failed to create relationship. Source or target not found.');
    }
  } finally {
    await session.close();
  }
}

/**
 * Update a relationship
 */
export async function updateRelationship(id: string, updates: Partial<any>): Promise<void> {
  const session = getSession();
  try {
    const properties = specToNeo4jProperties(updates);
    properties.updatedAt = new Date().toISOString();

    // Remove id from updates (shouldn't be updated)
    delete properties.id;

    const query = `
      MATCH ()-[r {id: $id}]->()
      SET r += $properties
      RETURN r
    `;

    const result = await session.run(query, { id, properties });

    if (result.records.length === 0) {
      throw new Error(`Relationship with id ${id} not found`);
    }
  } finally {
    await session.close();
  }
}

/**
 * Delete a relationship
 */
export async function deleteRelationship(id: string): Promise<void> {
  const session = getSession();
  try {
    const query = `
      MATCH ()-[r {id: $id}]->()
      DELETE r
    `;

    await session.run(query, { id });
  } finally {
    await session.close();
  }
}

/**
 * Create a SysML v2.0 compliant composition relationship
 * This creates an intermediate part-usage that references the target definition
 */
export async function createComposition(
  sourceId: string,
  targetId: string,
  partName: string,
  compositionType: 'composition' | 'aggregation'
): Promise<{ partUsageId: string; definitionRelId: string; compositionRelId: string }> {
  const session = getSession();
  try {
    // Generate IDs
    const partUsageId = `${sourceId}-part-${Date.now()}`;
    const definitionRelId = `${partUsageId}-definition-${targetId}`;
    const compositionRelId = `${sourceId}-${compositionType}-${partUsageId}`;

    const relType = compositionType === 'composition' ? 'COMPOSITION' : 'AGGREGATION';

    const now = new Date().toISOString();

    // Create part-usage, definition relationship, and composition relationship in one transaction
    const query = `
      // Verify source and target exist
      MATCH (source:SysMLElement {id: $sourceId})
      MATCH (target:SysMLElement {id: $targetId})

      // Create the part-usage node
      CREATE (partUsage:SysMLElement:PartUsage {
        id: $partUsageId,
        name: $partName,
        createdAt: $now,
        updatedAt: $now
      })

      // Create DEFINITION relationship: part-usage -> target definition
      CREATE (partUsage)-[defRel:DEFINITION {
        id: $definitionRelId,
        createdAt: $now,
        updatedAt: $now
      }]->(target)

      // Create COMPOSITION/AGGREGATION relationship: source -> part-usage
      CREATE (source)-[compRel:${relType} {
        id: $compositionRelId,
        createdAt: $now,
        updatedAt: $now
      }]->(partUsage)

      RETURN partUsage, defRel, compRel
    `;

    const result = await session.run(query, {
      sourceId,
      targetId,
      partUsageId,
      partName,
      definitionRelId,
      compositionRelId,
      now,
    });

    if (result.records.length === 0) {
      throw new Error('Failed to create composition. Source or target not found.');
    }

    return {
      partUsageId,
      definitionRelId,
      compositionRelId,
    };
  } finally {
    await session.close();
  }
}

/**
 * Delete a composition relationship and its intermediate part-usage
 * This reverses the createComposition operation
 */
export async function deleteComposition(partUsageId: string): Promise<void> {
  const session = getSession();
  try {
    // Delete the part-usage node and all its relationships
    const query = `
      MATCH (partUsage:SysMLElement:PartUsage {id: $partUsageId})
      DETACH DELETE partUsage
    `;

    await session.run(query, { partUsageId });
  } finally {
    await session.close();
  }
}

/**
 * Create a SysML v2.0 compliant state-in-statemachine relationship
 * This creates an intermediate state-usage that references the target state definition
 */
export async function createStateInStateMachine(
  stateMachineId: string,
  stateDefinitionId: string,
  stateName: string
): Promise<{ stateUsageId: string; definitionRelId: string; compositionRelId: string }> {
  const session = getSession();
  try {
    // Generate IDs
    const stateUsageId = `${stateMachineId}-state-${Date.now()}`;
    const definitionRelId = `${stateUsageId}-definition-${stateDefinitionId}`;
    const compositionRelId = `${stateMachineId}-composition-${stateUsageId}`;

    const now = new Date().toISOString();

    // Create state-usage, definition relationship, and composition relationship in one transaction
    const query = `
      // Verify state machine and state definition exist
      MATCH (stateMachine:SysMLElement {id: $stateMachineId})
      MATCH (stateDef:SysMLElement {id: $stateDefinitionId})

      // Create the state-usage node
      CREATE (stateUsage:SysMLElement:StateUsage {
        id: $stateUsageId,
        name: $stateName,
        createdAt: $now,
        updatedAt: $now
      })

      // Create DEFINITION relationship: state-usage -> state definition
      CREATE (stateUsage)-[defRel:DEFINITION {
        id: $definitionRelId,
        createdAt: $now,
        updatedAt: $now
      }]->(stateDef)

      // Create COMPOSITION relationship: state machine -> state-usage
      CREATE (stateMachine)-[compRel:COMPOSITION {
        id: $compositionRelId,
        createdAt: $now,
        updatedAt: $now
      }]->(stateUsage)

      RETURN stateUsage, defRel, compRel
    `;

    const result = await session.run(query, {
      stateMachineId,
      stateDefinitionId,
      stateUsageId,
      stateName,
      definitionRelId,
      compositionRelId,
      now,
    });

    if (result.records.length === 0) {
      throw new Error('Failed to create state in state machine. State machine or state definition not found.');
    }

    return {
      stateUsageId,
      definitionRelId,
      compositionRelId,
    };
  } finally {
    await session.close();
  }
}

/**
 * Delete a state from a state machine and its intermediate state-usage
 * This reverses the createStateInStateMachine operation
 */
export async function deleteStateFromStateMachine(stateUsageId: string): Promise<void> {
  const session = getSession();
  try {
    // Delete the state-usage node and all its relationships
    const query = `
      MATCH (stateUsage:SysMLElement:StateUsage {id: $stateUsageId})
      DETACH DELETE stateUsage
    `;

    await session.run(query, { stateUsageId });
  } finally {
    await session.close();
  }
}

/**
 * Update element position for a specific viewpoint
 */
export async function updateElementPosition(
  elementId: string,
  viewpointId: string,
  position: { x: number; y: number }
): Promise<void> {
  const session = getSession();
  try {
    const query = `
      MATCH (n:SysMLElement {id: $elementId})
      WITH n, coalesce(n.layoutPositions, '{}') as currentPositions
      WITH n, apoc.convert.fromJsonMap(currentPositions) as posMap
      WITH n, apoc.map.setKey(posMap, $viewpointId, $position) as newPosMap
      SET n.layoutPositions = apoc.convert.toJson(newPosMap)
      RETURN n
    `;

    await session.run(query, {
      elementId,
      viewpointId,
      position,
    });
  } finally {
    await session.close();
  }
}
