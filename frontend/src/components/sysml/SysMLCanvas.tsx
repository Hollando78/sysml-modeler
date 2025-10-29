import { useEffect, useState, useCallback } from 'react';
import { applyNodeChanges, applyEdgeChanges, ConnectionLineType } from 'reactflow';
import { SysMLDiagram, createNodesFromSpecs, createEdgesFromRelationships } from '../../lib/sysml-diagram';
import type { SysMLNodeSpec as LibSysMLNodeSpec, SysMLRelationshipSpec as LibSysMLRelationshipSpec, SysMLNodeData } from '../../lib/sysml-diagram/types';
import { useSysMLModel, useSysMLMutations, useDiagramMutations, useSysMLDiagram } from '../../hooks/useSysMLApi';
import { useDiagram } from '../../lib/DiagramContext';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from 'reactflow';
import type { ToolbarMode } from './SysMLToolbar';
import NodeEditor from './NodeEditor';

interface SysMLCanvasProps {
  toolbarMode: ToolbarMode;
  toolbarData?: { kind?: string; type?: string };
  onUndoRedoChange?: (canUndo: boolean, canRedo: boolean) => void;
  undoRedoRef?: (undo: () => void, redo: () => void) => void;
}

export default function SysMLCanvas({ toolbarMode, toolbarData, onUndoRedoChange, undoRedoRef }: SysMLCanvasProps) {
  const { selectedDiagram } = useDiagram();
  const { data: latestDiagram, isLoading: diagramLoading } = useSysMLDiagram(selectedDiagram?.id);

  // Always use the latest diagram data from the query, not the stale context data
  const activeDiagram = latestDiagram;

  const { data: model, isLoading: modelLoading, error } = useSysMLModel(activeDiagram?.viewpointId);
  const isLoading = diagramLoading || modelLoading;

  const elementMutations = useSysMLMutations();
  const diagramMutations = useDiagramMutations();
  const { addAction, undo, redo, canUndo, canRedo } = useUndoRedo();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [editingNode, setEditingNode] = useState<Node<SysMLNodeData> | null>(null);

  // Notify parent of undo/redo state changes
  useEffect(() => {
    onUndoRedoChange?.(canUndo, canRedo);
  }, [canUndo, canRedo, onUndoRedoChange]);

  // Expose undo/redo functions to parent
  useEffect(() => {
    undoRedoRef?.(undo, redo);
  }, [undo, redo, undoRedoRef]);

  console.log('[DEBUG] SysMLCanvas render', {
    toolbarMode,
    toolbarData,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    isLoading,
    hasError: !!error,
    selectedDiagram: selectedDiagram?.id,
    activeDiagram: activeDiagram?.id,
    hasModel: !!model
  });

  // Convert model to React Flow format
  useEffect(() => {
    if (model && activeDiagram) {
      console.log('[DEBUG] Converting model to React Flow format', {
        diagramId: activeDiagram.id,
        diagramName: activeDiagram.name,
        totalModelNodes: model.nodes.length,
        diagramElementIds: activeDiagram.elementIds.length,
        diagramPositions: Object.keys(activeDiagram.positions).length,
      });

      // Filter model nodes to only include elements in the diagram
      const filteredNodes = model.nodes.filter((node) =>
        activeDiagram.elementIds.includes(node.spec.id)
      );

      console.log('[DEBUG] Filtered nodes:', {
        filtered: filteredNodes.length,
        ids: filteredNodes.map((n) => n.spec.id),
      });

      // Use positions from the diagram
      const positions = activeDiagram.positions;

      const reactFlowNodes = createNodesFromSpecs(filteredNodes as LibSysMLNodeSpec[], positions);
      const reactFlowEdges = createEdgesFromRelationships(model.relationships as LibSysMLRelationshipSpec[]);

      console.log('[DEBUG] Created React Flow nodes', {
        nodeCount: reactFlowNodes.length,
        nodes: reactFlowNodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
        })),
      });

      setNodes(reactFlowNodes);
      setEdges(reactFlowEdges);
    } else if (!activeDiagram) {
      // No diagram selected, clear the canvas
      setNodes([]);
      setEdges([]);
    }
  }, [model, activeDiagram]);

  // Update node draggable and connectable state based on toolbar mode
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        draggable: toolbarMode !== 'create-relationship',
        connectable: toolbarMode === 'create-relationship',
      }))
    );
  }, [toolbarMode]);

  // Handle canvas click for placing nodes
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      console.log('[DEBUG] onPaneClick triggered', {
        toolbarMode,
        kind: toolbarData?.kind,
        eventType: event.type,
        target: event.target
      });

      if (toolbarMode !== 'create-node' || !toolbarData?.kind) {
        console.log('[DEBUG] onPaneClick skipped - wrong mode or no kind');
        return;
      }

      const id = `${toolbarData.kind}-${Date.now()}`;
      const name = prompt(`Enter name for ${toolbarData.kind}:`);

      console.log('[DEBUG] Node creation prompt result:', { name, id });

      if (name && activeDiagram) {
        // Use a default position
        const defaultX = 100 + Math.random() * 200;
        const defaultY = 100 + Math.random() * 200;

        console.log('[DEBUG] Creating element and adding to diagram:', {
          kind: toolbarData.kind,
          id,
          name,
          position: { x: defaultX, y: defaultY },
          diagramId: activeDiagram.id,
        });

        // Run mutations sequentially to ensure proper order
        (async () => {
          try {
            // 1. Create the element first
            await elementMutations.createElement.mutateAsync({
              kind: toolbarData.kind!,
              spec: {
                id,
                name,
              },
            });

            // 2. Add element to diagram
            await diagramMutations.addElementsToDiagram.mutateAsync({
              diagramId: activeDiagram.id,
              elementIds: [id],
            });

            // 3. Set initial position in diagram
            await diagramMutations.updateElementPositionInDiagram.mutateAsync({
              diagramId: activeDiagram.id,
              elementId: id,
              position: { x: defaultX, y: defaultY },
            });

            console.log('[DEBUG] Element created and added to diagram successfully');

            // 4. Add undo/redo action
            addAction({
              type: 'create-node',
              data: { id, kind: toolbarData.kind, name, position: { x: defaultX, y: defaultY }, diagramId: activeDiagram.id },
              description: `Create ${toolbarData.kind} "${name}"`,
              undo: async () => {
                // Remove from diagram and delete element
                await diagramMutations.removeElementFromDiagram.mutateAsync({
                  diagramId: activeDiagram.id,
                  elementId: id,
                });
                await elementMutations.deleteElement.mutateAsync(id);
              },
              redo: async () => {
                // Recreate element and add to diagram
                await elementMutations.createElement.mutateAsync({
                  kind: toolbarData.kind!,
                  spec: { id, name },
                });
                await diagramMutations.addElementsToDiagram.mutateAsync({
                  diagramId: activeDiagram.id,
                  elementIds: [id],
                });
                await diagramMutations.updateElementPositionInDiagram.mutateAsync({
                  diagramId: activeDiagram.id,
                  elementId: id,
                  position: { x: defaultX, y: defaultY },
                });
              },
            });
          } catch (error) {
            console.error('[DEBUG] Error creating element:', error);
          }
        })();
      }
    },
    [toolbarMode, toolbarData, activeDiagram, elementMutations, diagramMutations, addAction]
  );

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    console.log('[DEBUG] onNodesChange triggered', {
      changeCount: changes.length,
      changes: changes.map(c => ({ type: c.type, ...(('id' in c) && { id: c.id }) }))
    });

    setNodes((nds) => {
      // Handle node removal (delete key)
      changes.forEach((change) => {
        if (change.type === 'remove') {
          const nodeToRemove = nds.find(n => n.id === change.id);
          if (nodeToRemove && activeDiagram?.id) {
            const nodeData = nodeToRemove.data;
            const nodePosition = nodeToRemove.position;

            console.log('[DEBUG] Node removal detected', {
              id: change.id,
              nodeData,
              position: nodePosition,
            });

            // Remove from diagram and delete element
            (async () => {
              try {
                await diagramMutations.removeElementFromDiagram.mutateAsync({
                  diagramId: activeDiagram.id,
                  elementId: change.id,
                });
                await elementMutations.deleteElement.mutateAsync(change.id);

                // Add undo/redo action
                addAction({
                  type: 'delete-node',
                  data: { id: change.id, nodeData, position: nodePosition, diagramId: activeDiagram.id },
                  description: `Delete node ${change.id}`,
                  undo: async () => {
                    // Recreate element and add to diagram
                    await elementMutations.createElement.mutateAsync({
                      kind: nodeData.kind,
                      spec: { id: change.id, name: nodeData.name },
                    });
                    await diagramMutations.addElementsToDiagram.mutateAsync({
                      diagramId: activeDiagram.id,
                      elementIds: [change.id],
                    });
                    await diagramMutations.updateElementPositionInDiagram.mutateAsync({
                      diagramId: activeDiagram.id,
                      elementId: change.id,
                      position: nodePosition,
                    });
                  },
                  redo: async () => {
                    // Delete element again
                    await diagramMutations.removeElementFromDiagram.mutateAsync({
                      diagramId: activeDiagram.id,
                      elementId: change.id,
                    });
                    await elementMutations.deleteElement.mutateAsync(change.id);
                  },
                });
              } catch (error) {
                console.error('[DEBUG] Error deleting node:', error);
              }
            })();
          }
        }
      });

      // Apply all React Flow changes (select, drag, remove, etc.)
      const updatedNodes = applyNodeChanges(changes, nds);

      console.log('[DEBUG] Applied node changes', {
        oldCount: nds.length,
        newCount: updatedNodes.length
      });

      // Save position updates to backend when drag ends
      changes.forEach((change) => {
        if (change.type === 'position' && change.dragging === false) {
          // Find the updated node to get its new position
          const updatedNode = updatedNodes.find(n => n.id === change.id);
          const oldNode = nds.find(n => n.id === change.id);

          if (updatedNode && oldNode && activeDiagram?.id) {
            const oldPosition = oldNode.position;
            const newPosition = updatedNode.position;

            console.log('[DEBUG] Position change detected, saving to diagram', {
              id: change.id,
              oldPosition,
              newPosition,
              diagramId: activeDiagram.id,
            });

            diagramMutations.updateElementPositionInDiagram.mutate({
              diagramId: activeDiagram.id,
              elementId: change.id,
              position: newPosition,
            });

            // Add undo/redo action for position change
            addAction({
              type: 'move-node',
              data: { id: change.id, oldPosition, newPosition, diagramId: activeDiagram.id },
              description: `Move node ${change.id}`,
              undo: async () => {
                await diagramMutations.updateElementPositionInDiagram.mutateAsync({
                  diagramId: activeDiagram.id,
                  elementId: change.id,
                  position: oldPosition,
                });
              },
              redo: async () => {
                await diagramMutations.updateElementPositionInDiagram.mutateAsync({
                  diagramId: activeDiagram.id,
                  elementId: change.id,
                  position: newPosition,
                });
              },
            });
          } else {
            console.log('[DEBUG] NOT saving position', {
              id: change.id,
              hasNode: !!updatedNode,
              hasDiagram: !!activeDiagram?.id,
            });
          }
        }
      });

      return updatedNodes;
    });
  }, [activeDiagram, diagramMutations, addAction]);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => {
      // Handle edge removal
      changes.forEach((change) => {
        if (change.type === 'remove') {
          const edgeToRemove = eds.find(e => e.id === change.id);
          if (edgeToRemove) {
            console.log('[DEBUG] Edge removal detected', {
              id: change.id,
              edgeData: edgeToRemove,
            });

            // Delete relationship
            (async () => {
              try {
                await elementMutations.deleteRelationship.mutateAsync(change.id);

                // Add undo/redo action
                addAction({
                  type: 'delete-edge',
                  data: {
                    id: change.id,
                    source: edgeToRemove.source,
                    target: edgeToRemove.target,
                    type: edgeToRemove.data?.type || edgeToRemove.label,
                    label: edgeToRemove.label,
                  },
                  description: `Delete edge ${change.id}`,
                  undo: async () => {
                    // Recreate relationship
                    const label = typeof edgeToRemove.label === 'string' ? edgeToRemove.label : undefined;
                    await elementMutations.createRelationship.mutateAsync({
                      id: change.id,
                      source: edgeToRemove.source,
                      target: edgeToRemove.target,
                      type: edgeToRemove.data?.type || label || 'dependency',
                      label: label,
                    });
                  },
                  redo: async () => {
                    // Delete relationship again
                    await elementMutations.deleteRelationship.mutateAsync(change.id);
                  },
                });
              } catch (error) {
                console.error('[DEBUG] Error deleting edge:', error);
              }
            })();
          }
        }
      });

      return applyEdgeChanges(changes, eds);
    });
  }, [elementMutations, addAction]);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      console.log('[DEBUG] onConnect triggered', { connection, toolbarMode });

      if (toolbarMode === 'create-relationship' && toolbarData?.type && connection.source && connection.target) {
        const id = `${connection.source}-${toolbarData.type}-${connection.target}`;

        console.log('[DEBUG] Creating relationship', {
          id,
          type: toolbarData.type,
          source: connection.source,
          target: connection.target
        });

        const relationshipSpec = {
          id,
          type: toolbarData.type,
          source: connection.source,
          target: connection.target,
          label: toolbarData.type,
        };

        (async () => {
          try {
            await elementMutations.createRelationship.mutateAsync(relationshipSpec);

            // Add undo/redo action
            addAction({
              type: 'create-edge',
              data: relationshipSpec,
              description: `Create ${toolbarData.type} relationship`,
              undo: async () => {
                await elementMutations.deleteRelationship.mutateAsync(id);
              },
              redo: async () => {
                await elementMutations.createRelationship.mutateAsync(relationshipSpec);
              },
            });
          } catch (error) {
            console.error('[DEBUG] Error creating relationship:', error);
          }
        })();
      }
    },
    [toolbarMode, toolbarData, elementMutations, addAction]
  );

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    console.log('[DEBUG] Node double-clicked!', {
      nodeId: node.id,
      nodeData: node.data
    });
    setEditingNode(node as Node<SysMLNodeData>);
  }, []);

  const handleNodeEditSave = useCallback(async (updates: Partial<SysMLNodeData>) => {
    if (!editingNode) return;

    const oldData = { ...editingNode.data };
    const newData = { ...oldData, ...updates };

    console.log('[DEBUG] Saving node updates', {
      id: editingNode.id,
      updates,
      oldData,
      newData
    });

    try {
      // Update the element in the backend
      await elementMutations.updateElement.mutateAsync({
        id: editingNode.id,
        updates: updates,
      });

      // Add undo/redo action
      addAction({
        type: 'create-node', // Reusing type - could add 'update-node' type
        data: { id: editingNode.id, oldData, newData },
        description: `Edit ${editingNode.data.kind} "${editingNode.data.name}"`,
        undo: async () => {
          await elementMutations.updateElement.mutateAsync({
            id: editingNode.id,
            updates: oldData,
          });
        },
        redo: async () => {
          await elementMutations.updateElement.mutateAsync({
            id: editingNode.id,
            updates: updates,
          });
        },
      });
    } catch (error) {
      console.error('[DEBUG] Error updating node:', error);
    }
  }, [editingNode, elementMutations, addAction]);

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.message}>Loading model...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Error loading model: {String(error)}</div>
      </div>
    );
  }

  if (!selectedDiagram) {
    return (
      <div style={styles.container}>
        <div style={styles.message}>Select or create a diagram to start modeling</div>
      </div>
    );
  }

  return (
    <div
      style={styles.container}
      onClick={(e) => console.log('[DEBUG] Container div clicked!', e.target)}
      onMouseDown={(e) => console.log('[DEBUG] Container mousedown', e.target)}
    >
      {/* Visual debug indicator */}
      <div style={styles.debugIndicator}>
        DEBUG: Canvas Active | Nodes: {nodes.length} | Mode: {toolbarMode}
      </div>

      <SysMLDiagram
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onNodeDoubleClick={onNodeDoubleClick}
        nodesDraggable={toolbarMode !== 'create-relationship'}
        nodesConnectable={toolbarMode === 'create-relationship'}
        elementsSelectable={true}
        panOnDrag={toolbarMode !== 'create-relationship'}
        connectionLineType={ConnectionLineType.Straight}
        connectionLineStyle={{
          stroke: '#8d8d8d',
          strokeWidth: 2,
        }}
        fitView={false}
      />
      {toolbarMode !== 'select' && (
        <div style={styles.modeIndicator}>
          {toolbarMode === 'create-node' && `Click to place: ${toolbarData?.kind}`}
          {toolbarMode === 'create-relationship' && `Click nodes to connect: ${toolbarData?.type}`}
        </div>
      )}

      {/* Node Editor Modal */}
      {editingNode && (
        <NodeEditor
          nodeData={editingNode.data}
          onClose={() => setEditingNode(null)}
          onSave={handleNodeEditSave}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#f5f5f5',
    width: '100%',
    height: '100%',
    minHeight: '500px',
  },
  message: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '16px',
    color: '#666',
  },
  error: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '16px',
    color: '#d32f2f',
    backgroundColor: '#ffebee',
    padding: '16px 24px',
    borderRadius: '8px',
    border: '1px solid #ef5350',
  },
  modeIndicator: {
    position: 'absolute',
    bottom: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#007bff',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    zIndex: 10,
  },
  debugIndicator: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    color: 'white',
    padding: '4px 8px',
    fontSize: '12px',
    fontFamily: 'monospace',
    zIndex: 1000,
    borderRadius: '4px',
    pointerEvents: 'none',
  },
};
