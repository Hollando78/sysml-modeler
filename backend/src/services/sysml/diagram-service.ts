import { getSession } from '../neo4j/driver.js';

export interface SysMLDiagramSpec {
  id: string;
  name: string;
  viewpointId: string;
  elementIds: string[];
  positions: Record<string, { x: number; y: number }>;
}

export interface SysMLDiagram extends SysMLDiagramSpec {
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new diagram
 */
export async function createDiagram(spec: Partial<SysMLDiagramSpec>): Promise<SysMLDiagram> {
  const session = getSession();
  try {
    const id = spec.id || `diagram-${Date.now()}`;
    const now = new Date().toISOString();

    const properties = {
      id,
      name: spec.name || 'Untitled Diagram',
      viewpointId: spec.viewpointId || '',
      elementIds: JSON.stringify(spec.elementIds || []),
      positions: JSON.stringify(spec.positions || {}),
      createdAt: now,
      updatedAt: now,
    };

    const query = `
      CREATE (d:Diagram)
      SET d = $properties
      RETURN d
    `;

    const result = await session.run(query, { properties });
    const record = result.records[0];

    if (!record) {
      throw new Error('Failed to create diagram');
    }

    return neo4jToDiagram(record.get('d').properties);
  } finally {
    await session.close();
  }
}

/**
 * Fetch all diagrams, optionally filtered by viewpoint
 */
export async function fetchDiagrams(viewpointId?: string): Promise<SysMLDiagram[]> {
  const session = getSession();
  try {
    const whereClause = viewpointId ? 'WHERE d.viewpointId = $viewpointId' : '';

    const query = `
      MATCH (d:Diagram)
      ${whereClause}
      RETURN d
      ORDER BY d.updatedAt DESC
    `;

    const result = await session.run(query, { viewpointId });

    return result.records.map((record) => neo4jToDiagram(record.get('d').properties));
  } finally {
    await session.close();
  }
}

/**
 * Fetch a single diagram by ID
 */
export async function fetchDiagram(diagramId: string): Promise<SysMLDiagram | null> {
  const session = getSession();
  try {
    const query = `
      MATCH (d:Diagram {id: $diagramId})
      RETURN d
    `;

    const result = await session.run(query, { diagramId });

    if (result.records.length === 0) {
      return null;
    }

    return neo4jToDiagram(result.records[0].get('d').properties);
  } finally {
    await session.close();
  }
}

/**
 * Update diagram metadata (name, viewpointId)
 */
export async function updateDiagram(
  diagramId: string,
  updates: Partial<Pick<SysMLDiagramSpec, 'name' | 'viewpointId'>>
): Promise<void> {
  const session = getSession();
  try {
    const properties: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (updates.name !== undefined) {
      properties.name = updates.name;
    }
    if (updates.viewpointId !== undefined) {
      properties.viewpointId = updates.viewpointId;
    }

    const query = `
      MATCH (d:Diagram {id: $diagramId})
      SET d += $properties
      RETURN d
    `;

    const result = await session.run(query, { diagramId, properties });

    if (result.records.length === 0) {
      throw new Error(`Diagram with id ${diagramId} not found`);
    }
  } finally {
    await session.close();
  }
}

/**
 * Delete a diagram
 */
export async function deleteDiagram(diagramId: string): Promise<void> {
  const session = getSession();
  try {
    const query = `
      MATCH (d:Diagram {id: $diagramId})
      DELETE d
    `;

    await session.run(query, { diagramId });
  } finally {
    await session.close();
  }
}

/**
 * Add elements to a diagram
 */
export async function addElementsToDiagram(diagramId: string, elementIds: string[]): Promise<void> {
  const session = getSession();
  try {
    const query = `
      MATCH (d:Diagram {id: $diagramId})
      WITH d, apoc.convert.fromJsonList(d.elementIds) as currentIds
      WITH d, currentIds + $elementIds as allIds
      WITH d, [id IN allIds | id] as uniqueIds
      SET d.elementIds = apoc.convert.toJson(uniqueIds),
          d.updatedAt = $updatedAt
      RETURN d
    `;

    await session.run(query, {
      diagramId,
      elementIds,
      updatedAt: new Date().toISOString(),
    });
  } finally {
    await session.close();
  }
}

/**
 * Remove an element from a diagram
 */
export async function removeElementFromDiagram(diagramId: string, elementId: string): Promise<void> {
  const session = getSession();
  try {
    const query = `
      MATCH (d:Diagram {id: $diagramId})
      WITH d, apoc.convert.fromJsonList(d.elementIds) as currentIds
      WITH d, [id IN currentIds WHERE id <> $elementId | id] as filteredIds
      SET d.elementIds = apoc.convert.toJson(filteredIds),
          d.updatedAt = $updatedAt
      RETURN d
    `;

    await session.run(query, {
      diagramId,
      elementId,
      updatedAt: new Date().toISOString(),
    });
  } finally {
    await session.close();
  }
}

/**
 * Update element position within a diagram
 */
export async function updateElementPositionInDiagram(
  diagramId: string,
  elementId: string,
  position: { x: number; y: number }
): Promise<void> {
  const session = getSession();
  try {
    const query = `
      MATCH (d:Diagram {id: $diagramId})
      WITH d, coalesce(d.positions, '{}') as currentPositions
      WITH d, apoc.convert.fromJsonMap(currentPositions) as posMap
      WITH d, apoc.map.setKey(posMap, $elementId, $position) as newPosMap
      SET d.positions = apoc.convert.toJson(newPosMap),
          d.updatedAt = $updatedAt
      RETURN d
    `;

    await session.run(query, {
      diagramId,
      elementId,
      position,
      updatedAt: new Date().toISOString(),
    });
  } finally {
    await session.close();
  }
}

/**
 * Bulk update positions for multiple elements in a diagram
 */
export async function updateDiagramPositions(
  diagramId: string,
  positions: Record<string, { x: number; y: number }>
): Promise<void> {
  const session = getSession();
  try {
    const query = `
      MATCH (d:Diagram {id: $diagramId})
      SET d.positions = $positions,
          d.updatedAt = $updatedAt
      RETURN d
    `;

    await session.run(query, {
      diagramId,
      positions: JSON.stringify(positions),
      updatedAt: new Date().toISOString(),
    });
  } finally {
    await session.close();
  }
}

/**
 * Convert Neo4j properties to SysMLDiagram
 */
function neo4jToDiagram(properties: Record<string, any>): SysMLDiagram {
  return {
    id: properties.id,
    name: properties.name,
    viewpointId: properties.viewpointId,
    elementIds: JSON.parse(properties.elementIds || '[]'),
    positions: JSON.parse(properties.positions || '{}'),
    createdAt: properties.createdAt,
    updatedAt: properties.updatedAt,
  };
}
