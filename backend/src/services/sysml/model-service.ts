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
      // Fetch nodes
      MATCH (n:SysMLElement)
      ${nodeLabelFilter}
      WITH collect({labels: labels(n), properties: properties(n)}) as nodes

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
    const nodes: SysMLNodeSpec[] = nodesData.map((node) => {
      // Get the specific label (not SysMLElement)
      const specificLabel = node.labels.find((l: string) => l !== 'SysMLElement');
      const kind = labelToNodeKind(specificLabel);
      const spec = neo4jPropertiesToSpec(node.properties);

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
    const properties = specToNeo4jProperties(updates);
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
