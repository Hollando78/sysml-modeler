import type { SysMLModel, SysMLNodeSpec, SysMLRelationshipSpec, SysMLViewpoint, ViewpointTypes, SysMLDiagram } from '../types';

const API_BASE = '/api/sysml';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const apiClient = {
  // Model operations
  async fetchModel(viewpointId?: string): Promise<SysMLModel> {
    const url = viewpointId
      ? `${API_BASE}/model?viewpoint=${encodeURIComponent(viewpointId)}`
      : `${API_BASE}/model`;
    return fetchJSON<SysMLModel>(url);
  },

  // Viewpoint operations
  async fetchViewpoints(): Promise<SysMLViewpoint[]> {
    return fetchJSON<SysMLViewpoint[]>(`${API_BASE}/viewpoints`);
  },

  async fetchViewpointTypes(viewpointId: string): Promise<ViewpointTypes> {
    return fetchJSON<ViewpointTypes>(`${API_BASE}/viewpoints/${viewpointId}/types`);
  },

  // Element operations
  async createElement(nodeSpec: SysMLNodeSpec): Promise<void> {
    await fetchJSON(`${API_BASE}/elements`, {
      method: 'POST',
      body: JSON.stringify(nodeSpec),
    });
  },

  async updateElement(id: string, updates: Partial<any>): Promise<void> {
    await fetchJSON(`${API_BASE}/elements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ updates }),
    });
  },

  async deleteElement(id: string): Promise<void> {
    await fetchJSON(`${API_BASE}/elements/${id}`, {
      method: 'DELETE',
    });
  },

  // Relationship operations
  async createRelationship(relationshipSpec: SysMLRelationshipSpec): Promise<void> {
    await fetchJSON(`${API_BASE}/relationships`, {
      method: 'POST',
      body: JSON.stringify(relationshipSpec),
    });
  },

  async updateRelationship(id: string, updates: { label?: string }): Promise<void> {
    await fetchJSON(`${API_BASE}/relationships/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteRelationship(id: string): Promise<void> {
    await fetchJSON(`${API_BASE}/relationships/${id}`, {
      method: 'DELETE',
    });
  },

  async createComposition(
    sourceId: string,
    targetId: string,
    partName: string,
    compositionType: 'composition' | 'aggregation'
  ): Promise<{ partUsageId: string; definitionRelId: string; compositionRelId: string }> {
    return fetchJSON(`${API_BASE}/compositions`, {
      method: 'POST',
      body: JSON.stringify({ sourceId, targetId, partName, compositionType }),
    });
  },

  // Position operations
  async updateElementPosition(
    id: string,
    viewpointId: string,
    position: { x: number; y: number }
  ): Promise<void> {
    await fetchJSON(`${API_BASE}/elements/${id}/position`, {
      method: 'PATCH',
      body: JSON.stringify({ viewpointId, position }),
    });
  },

  // Diagram operations
  async fetchDiagrams(viewpointId?: string): Promise<SysMLDiagram[]> {
    const url = viewpointId
      ? `${API_BASE}/diagrams?viewpoint=${encodeURIComponent(viewpointId)}`
      : `${API_BASE}/diagrams`;
    return fetchJSON<SysMLDiagram[]>(url);
  },

  async fetchDiagram(diagramId: string): Promise<SysMLDiagram> {
    return fetchJSON<SysMLDiagram>(`${API_BASE}/diagrams/${diagramId}`);
  },

  async createDiagram(spec: {
    id?: string;
    name: string;
    viewpointId: string;
    elementIds?: string[];
    positions?: Record<string, { x: number; y: number }>;
  }): Promise<SysMLDiagram> {
    return fetchJSON<SysMLDiagram>(`${API_BASE}/diagrams`, {
      method: 'POST',
      body: JSON.stringify(spec),
    });
  },

  async updateDiagram(
    diagramId: string,
    updates: { name?: string; viewpointId?: string }
  ): Promise<void> {
    await fetchJSON(`${API_BASE}/diagrams/${diagramId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteDiagram(diagramId: string): Promise<void> {
    await fetchJSON(`${API_BASE}/diagrams/${diagramId}`, {
      method: 'DELETE',
    });
  },

  async addElementsToDiagram(diagramId: string, elementIds: string[]): Promise<void> {
    await fetchJSON(`${API_BASE}/diagrams/${diagramId}/elements`, {
      method: 'POST',
      body: JSON.stringify({ elementIds }),
    });
  },

  async removeElementFromDiagram(diagramId: string, elementId: string): Promise<void> {
    await fetchJSON(`${API_BASE}/diagrams/${diagramId}/elements/${elementId}`, {
      method: 'DELETE',
    });
  },

  async updateElementPositionInDiagram(
    diagramId: string,
    elementId: string,
    position: { x: number; y: number }
  ): Promise<void> {
    await fetchJSON(`${API_BASE}/diagrams/${diagramId}/elements/${elementId}/position`, {
      method: 'PATCH',
      body: JSON.stringify({ position }),
    });
  },

  async updateDiagramPositions(
    diagramId: string,
    positions: Record<string, { x: number; y: number }>
  ): Promise<void> {
    await fetchJSON(`${API_BASE}/diagrams/${diagramId}/positions`, {
      method: 'PATCH',
      body: JSON.stringify({ positions }),
    });
  },
};
