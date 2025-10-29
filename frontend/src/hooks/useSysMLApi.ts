import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { SysMLNodeSpec, SysMLRelationshipSpec } from '../types';

export function useSysMLModel(viewpointId?: string) {
  return useQuery({
    queryKey: ['sysml-model', viewpointId],
    queryFn: () => apiClient.fetchModel(viewpointId),
  });
}

export function useSysMLViewpoints() {
  return useQuery({
    queryKey: ['sysml-viewpoints'],
    queryFn: () => apiClient.fetchViewpoints(),
  });
}

export function useViewpointTypes(viewpointId?: string) {
  return useQuery({
    queryKey: ['viewpoint-types', viewpointId],
    queryFn: () => apiClient.fetchViewpointTypes(viewpointId!),
    enabled: !!viewpointId,
  });
}

export function useSysMLMutations(_viewpointId?: string) {
  const queryClient = useQueryClient();

  const invalidateModel = () => {
    queryClient.invalidateQueries({ queryKey: ['sysml-model'] });
  };

  const createElementMutation = useMutation({
    mutationFn: (nodeSpec: SysMLNodeSpec) => apiClient.createElement(nodeSpec),
    onSuccess: invalidateModel,
  });

  const updateElementMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<any> }) =>
      apiClient.updateElement(id, updates),
    onSuccess: invalidateModel,
  });

  const deleteElementMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteElement(id),
    onSuccess: invalidateModel,
  });

  const createRelationshipMutation = useMutation({
    mutationFn: (relationshipSpec: SysMLRelationshipSpec) =>
      apiClient.createRelationship(relationshipSpec),
    onSuccess: invalidateModel,
  });

  const updateRelationshipMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { label?: string } }) =>
      apiClient.updateRelationship(id, updates),
    onSuccess: invalidateModel,
  });

  const deleteRelationshipMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteRelationship(id),
    onSuccess: invalidateModel,
  });

  const createCompositionMutation = useMutation({
    mutationFn: ({
      sourceId,
      targetId,
      partName,
      compositionType,
    }: {
      sourceId: string;
      targetId: string;
      partName: string;
      compositionType: 'composition' | 'aggregation';
    }) => apiClient.createComposition(sourceId, targetId, partName, compositionType),
    onSuccess: invalidateModel,
  });

  const updatePositionMutation = useMutation({
    mutationFn: ({
      id,
      viewpointId,
      position,
    }: {
      id: string;
      viewpointId: string;
      position: { x: number; y: number };
    }) => apiClient.updateElementPosition(id, viewpointId, position),
    // Don't invalidate on position update to avoid refetch during drag
  });

  return {
    createElement: createElementMutation,
    updateElement: updateElementMutation,
    deleteElement: deleteElementMutation,
    createRelationship: createRelationshipMutation,
    updateRelationship: updateRelationshipMutation,
    deleteRelationship: deleteRelationshipMutation,
    createComposition: createCompositionMutation,
    updatePosition: updatePositionMutation,
  };
}

export function useSysMLDiagrams(viewpointId?: string) {
  return useQuery({
    queryKey: ['sysml-diagrams', viewpointId],
    queryFn: () => apiClient.fetchDiagrams(viewpointId),
  });
}

export function useSysMLDiagram(diagramId?: string) {
  return useQuery({
    queryKey: ['sysml-diagram', diagramId],
    queryFn: () => apiClient.fetchDiagram(diagramId!),
    enabled: !!diagramId,
    staleTime: 0, // Always fetch fresh data when switching diagrams
  });
}

export function useDiagramMutations() {
  const queryClient = useQueryClient();

  const invalidateDiagrams = () => {
    queryClient.invalidateQueries({ queryKey: ['sysml-diagrams'] });
  };

  const invalidateDiagram = (diagramId: string) => {
    queryClient.invalidateQueries({ queryKey: ['sysml-diagram', diagramId] });
  };

  const createDiagramMutation = useMutation({
    mutationFn: (spec: {
      id?: string;
      name: string;
      viewpointId: string;
      elementIds?: string[];
      positions?: Record<string, { x: number; y: number }>;
    }) => apiClient.createDiagram(spec),
    onSuccess: invalidateDiagrams,
  });

  const updateDiagramMutation = useMutation({
    mutationFn: ({
      diagramId,
      updates,
    }: {
      diagramId: string;
      updates: { name?: string; viewpointId?: string };
    }) => apiClient.updateDiagram(diagramId, updates),
    onSuccess: (_data, variables) => {
      invalidateDiagram(variables.diagramId);
      invalidateDiagrams();
    },
  });

  const deleteDiagramMutation = useMutation({
    mutationFn: (diagramId: string) => apiClient.deleteDiagram(diagramId),
    onSuccess: invalidateDiagrams,
  });

  const addElementsToDiagramMutation = useMutation({
    mutationFn: ({ diagramId, elementIds }: { diagramId: string; elementIds: string[] }) =>
      apiClient.addElementsToDiagram(diagramId, elementIds),
    onSuccess: (_data, variables) => {
      invalidateDiagram(variables.diagramId);
      // Also invalidate model queries to fetch the new element data
      queryClient.invalidateQueries({ queryKey: ['sysml-model'] });
    },
  });

  const removeElementFromDiagramMutation = useMutation({
    mutationFn: ({ diagramId, elementId }: { diagramId: string; elementId: string }) =>
      apiClient.removeElementFromDiagram(diagramId, elementId),
    onSuccess: (_data, variables) => {
      invalidateDiagram(variables.diagramId);
      // Also invalidate model queries to refetch updated element list
      queryClient.invalidateQueries({ queryKey: ['sysml-model'] });
    },
  });

  const updateElementPositionInDiagramMutation = useMutation({
    mutationFn: ({
      diagramId,
      elementId,
      position,
    }: {
      diagramId: string;
      elementId: string;
      position: { x: number; y: number };
    }) => apiClient.updateElementPositionInDiagram(diagramId, elementId, position),
    // Don't invalidate on position update - the local state is already correct
    // and invalidating would cause React Flow to receive new objects while dragging
  });

  const updateDiagramPositionsMutation = useMutation({
    mutationFn: ({
      diagramId,
      positions,
    }: {
      diagramId: string;
      positions: Record<string, { x: number; y: number }>;
    }) => apiClient.updateDiagramPositions(diagramId, positions),
    onSuccess: (_data, variables) => {
      invalidateDiagram(variables.diagramId);
    },
  });

  return {
    createDiagram: createDiagramMutation,
    updateDiagram: updateDiagramMutation,
    deleteDiagram: deleteDiagramMutation,
    addElementsToDiagram: addElementsToDiagramMutation,
    removeElementFromDiagram: removeElementFromDiagramMutation,
    updateElementPositionInDiagram: updateElementPositionInDiagramMutation,
    updateDiagramPositions: updateDiagramPositionsMutation,
  };
}
