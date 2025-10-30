import { useEffect, useState, useCallback, useRef } from 'react';
import { applyNodeChanges, applyEdgeChanges, ConnectionLineType } from 'reactflow';
import { Scissors, Copy, Clipboard, Edit, Type, Trash2, Network, EyeOff } from 'lucide-react';
import { SysMLDiagram, createNodesFromSpecs, createEdgesFromRelationships } from '../../lib/sysml-diagram';
import type { SysMLNodeSpec as LibSysMLNodeSpec, SysMLRelationshipSpec as LibSysMLRelationshipSpec, SysMLNodeData } from '../../lib/sysml-diagram/types';
import { useSysMLModel, useSysMLMutations, useDiagramMutations, useSysMLDiagram } from '../../hooks/useSysMLApi';
import { useDiagram } from '../../lib/DiagramContext';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect, OnConnectEnd } from 'reactflow';
import type { ToolbarMode } from './SysMLToolbar';
import NodeEditor from './NodeEditor';
import PromptModal from '../common/PromptModal';
import ContextMenu, { type ContextMenuItem } from '../common/ContextMenu';
import ConfirmModal from '../common/ConfirmModal';
import React from 'react';

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
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptData, setPromptData] = useState<{
    kind: string;
    clickPosition: { x: number; y: number };
    compositionData?: {
      sourceId: string;
      targetId: string;
      compositionType: 'composition' | 'aggregation';
    };
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Node<SysMLNodeData> } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edge: Edge } | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; handleId?: string } | null>(null);
  const [clipboard, setClipboard] = useState<{ action: 'cut' | 'copy'; node: Node<SysMLNodeData> } | null>(null);
  const [deleteNodeConfirm, setDeleteNodeConfirm] = useState<{ node: Node<SysMLNodeData> } | null>(null);
  const [deleteEdgeConfirm, setDeleteEdgeConfirm] = useState<{ edge: Edge } | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Track whether React Flow's keyboard delete is being used
  // This helps us distinguish user-initiated deletions from data sync removals
  const isKeyboardDeleteRef = useRef(false);

  // Notify parent of undo/redo state changes
  useEffect(() => {
    onUndoRedoChange?.(canUndo, canRedo);
  }, [canUndo, canRedo, onUndoRedoChange]);

  // Expose undo/redo functions to parent
  useEffect(() => {
    undoRedoRef?.(undo, redo);
  }, [undo, redo, undoRedoRef]);

  // Listen for keyboard delete events to distinguish user-initiated deletions
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        isKeyboardDeleteRef.current = true;
        // Reset after a short delay to handle the node removal event
        setTimeout(() => {
          isKeyboardDeleteRef.current = false;
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for edge label updates from EditableEdgeLabel component
  useEffect(() => {
    const handleEdgeLabelUpdate = async (event: Event) => {
      const customEvent = event as CustomEvent<{ edgeId: string; updates: any }>;
      const { edgeId, updates } = customEvent.detail;
      console.log('[DEBUG] Edge label update received:', edgeId, updates);

      try {
        await elementMutations.updateRelationship.mutateAsync({
          id: edgeId,
          updates
        });
        console.log('[DEBUG] Edge label persisted to backend:', edgeId);
      } catch (error) {
        console.error('[ERROR] Failed to persist edge label update:', error);
      }
    };

    window.addEventListener('sysml-edge-label-update', handleEdgeLabelUpdate);
    return () => window.removeEventListener('sysml-edge-label-update', handleEdgeLabelUpdate);
  }, [elementMutations]);

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

      // Filter out hidden relationships
      const hiddenRelIds = activeDiagram.hiddenRelationshipIds || [];
      const visibleRelationships = model.relationships.filter(rel => !hiddenRelIds.includes(rel.id));

      const reactFlowNodes = createNodesFromSpecs(filteredNodes as LibSysMLNodeSpec[], positions);
      const reactFlowEdges = createEdgesFromRelationships(visibleRelationships as LibSysMLRelationshipSpec[]);

      // Debug: Log use case nodes with their compartments
      reactFlowNodes.forEach(node => {
        if (node.data.kind === 'use-case-usage' || node.data.kind === 'use-case-definition') {
          console.log('[DEBUG] Use case node:', {
            id: node.id,
            name: node.data.name,
            kind: node.data.kind,
            compartments: node.data.compartments,
            compartmentCount: node.data.compartments?.length || 0,
            spec: filteredNodes.find(n => n.spec.id === node.id)?.spec
          });
        }
      });

      console.log('[DEBUG] Created React Flow nodes', {
        nodeCount: reactFlowNodes.length,
        edgeCount: reactFlowEdges.length,
        hiddenRelationships: hiddenRelIds.length,
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

      // Use a default position
      const defaultX = 100 + Math.random() * 200;
      const defaultY = 100 + Math.random() * 200;

      // Show prompt modal
      setPromptData({
        kind: toolbarData.kind,
        clickPosition: { x: defaultX, y: defaultY },
      });
      setShowPrompt(true);
    },
    [toolbarMode, toolbarData]
  );

  const handlePromptConfirm = useCallback(async (name: string) => {
    console.log('[DEBUG] handlePromptConfirm called:', {
      name,
      promptDataKind: promptData?.kind,
      hasCompositionData: !!promptData?.compositionData,
      activeDiagram: activeDiagram?.id,
    });

    setShowPrompt(false);

    if (!promptData || !activeDiagram) {
      console.log('[DEBUG] Missing promptData or activeDiagram, returning');
      return;
    }

    // Check if this is a composition dropped on blank canvas
    if (promptData.kind === 'composition-on-canvas' && promptData.compositionData) {
      const { sourceId, compositionType } = promptData.compositionData;
      const { x, y } = promptData.clickPosition;

      console.log('[DEBUG] Creating part-usage on blank canvas:', {
        sourceId,
        partName: name,
        compositionType,
        position: { x, y },
      });

      try {
        // 1. Create a new part-definition at the drop location to serve as the target
        const targetId = `part-definition-${Date.now()}`;
        await elementMutations.createElement.mutateAsync({
          kind: 'part-definition' as any,
          spec: {
            id: targetId,
            name: `${name}Definition`,
          },
        });

        // 2. Add the new definition to the diagram
        await diagramMutations.addElementsToDiagram.mutateAsync({
          diagramId: activeDiagram.id,
          elementIds: [targetId],
        });

        // 3. Set position for the new definition
        await diagramMutations.updateElementPositionInDiagram.mutateAsync({
          diagramId: activeDiagram.id,
          elementId: targetId,
          position: { x, y },
        });

        // 4. Create composition (which creates part-usage, definition rel, and composition rel)
        const result = await elementMutations.createComposition.mutateAsync({
          sourceId,
          targetId,
          partName: name,
          compositionType,
        });

        console.log('[DEBUG] Composition on canvas created successfully:', result);

        // 5. Add the part-usage to the diagram so it's visible
        await diagramMutations.addElementsToDiagram.mutateAsync({
          diagramId: activeDiagram.id,
          elementIds: [result.partUsageId],
        });

        // 6. Position the part-usage between the source and target
        // Calculate midpoint between source and drop location
        const sourceNode = nodes.find(n => n.id === sourceId);
        if (sourceNode) {
          const midX = (sourceNode.position.x + x) / 2;
          const midY = (sourceNode.position.y + y) / 2;
          await diagramMutations.updateElementPositionInDiagram.mutateAsync({
            diagramId: activeDiagram.id,
            elementId: result.partUsageId,
            position: { x: midX, y: midY },
          });
        }

        // Add undo/redo action
        addAction({
          type: 'create-composition',
          data: { sourceId, targetId, partName: name, compositionType, position: { x, y }, ...result },
          description: `Create ${compositionType} with part "${name}"`,
          undo: async () => {
            // Delete the part-usage and the target definition
            await elementMutations.deleteElement.mutateAsync(result.partUsageId);
            await elementMutations.deleteElement.mutateAsync(targetId);
          },
          redo: async () => {
            // Recreate everything
            await elementMutations.createElement.mutateAsync({
              kind: 'part-definition' as any,
              spec: { id: targetId, name: `${name}Definition` },
            });
            await diagramMutations.addElementsToDiagram.mutateAsync({
              diagramId: activeDiagram.id,
              elementIds: [targetId],
            });
            await diagramMutations.updateElementPositionInDiagram.mutateAsync({
              diagramId: activeDiagram.id,
              elementId: targetId,
              position: { x, y },
            });
            const redoResult = await elementMutations.createComposition.mutateAsync({
              sourceId,
              targetId,
              partName: name,
              compositionType,
            });
            // Add part-usage to diagram
            await diagramMutations.addElementsToDiagram.mutateAsync({
              diagramId: activeDiagram.id,
              elementIds: [redoResult.partUsageId],
            });
            // Position the part-usage
            const sourceNode = nodes.find(n => n.id === sourceId);
            if (sourceNode) {
              const midX = (sourceNode.position.x + x) / 2;
              const midY = (sourceNode.position.y + y) / 2;
              await diagramMutations.updateElementPositionInDiagram.mutateAsync({
                diagramId: activeDiagram.id,
                elementId: redoResult.partUsageId,
                position: { x: midX, y: midY },
              });
            }
          },
        });
      } catch (error) {
        console.error('[DEBUG] Error creating composition on canvas:', error);
      }
    } else if (promptData.kind === 'state-in-statemachine' && promptData.compositionData) {
      const { sourceId, targetId } = promptData.compositionData;

      console.log('[DEBUG] Creating state-in-statemachine:', {
        stateMachineId: sourceId,
        stateDefinitionId: targetId,
        stateName: name,
        hasMutation: !!elementMutations.createStateInStateMachine,
      });

      try {
        console.log('[DEBUG] About to call createStateInStateMachine mutation...');

        // Create state in state machine (creates state-usage, definition rel, and composition rel)
        const result = await elementMutations.createStateInStateMachine.mutateAsync({
          stateMachineId: sourceId,
          stateDefinitionId: targetId,
          stateName: name,
        });

        console.log('[DEBUG] State-in-statemachine created successfully:', result);

        // Add the state-usage to the diagram so it's visible
        await diagramMutations.addElementsToDiagram.mutateAsync({
          diagramId: activeDiagram.id,
          elementIds: [result.stateUsageId],
        });

        // Position the state-usage between the state machine and state definition
        const stateMachineNode = nodes.find(n => n.id === sourceId);
        const stateDefinitionNode = nodes.find(n => n.id === targetId);
        if (stateMachineNode && stateDefinitionNode) {
          const midX = (stateMachineNode.position.x + stateDefinitionNode.position.x) / 2;
          const midY = (stateMachineNode.position.y + stateDefinitionNode.position.y) / 2;
          await diagramMutations.updateElementPositionInDiagram.mutateAsync({
            diagramId: activeDiagram.id,
            elementId: result.stateUsageId,
            position: { x: midX, y: midY },
          });
        }

        // Add undo/redo action
        addAction({
          type: 'create-state-in-statemachine',
          data: { stateMachineId: sourceId, stateDefinitionId: targetId, stateName: name, ...result },
          description: `Add state "${name}" to state machine`,
          undo: async () => {
            // Remove from diagram and delete the state-usage (which will cascade delete the relationships)
            await diagramMutations.removeElementFromDiagram.mutateAsync({
              diagramId: activeDiagram.id,
              elementId: result.stateUsageId,
            });
            await elementMutations.deleteElement.mutateAsync(result.stateUsageId);
          },
          redo: async () => {
            // Recreate the state
            const redoResult = await elementMutations.createStateInStateMachine.mutateAsync({
              stateMachineId: sourceId,
              stateDefinitionId: targetId,
              stateName: name,
            });
            // Add to diagram
            await diagramMutations.addElementsToDiagram.mutateAsync({
              diagramId: activeDiagram.id,
              elementIds: [redoResult.stateUsageId],
            });
          },
        });
      } catch (error) {
        console.error('[DEBUG] Error creating state-in-statemachine:', error);
        console.error('[DEBUG] Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    } else if (promptData.kind === 'composition' && promptData.compositionData) {
      const { sourceId, targetId, compositionType } = promptData.compositionData;

      console.log('[DEBUG] Creating SysML v2.0 compliant composition:', {
        sourceId,
        targetId,
        partName: name,
        compositionType,
      });

      try {
        // Create composition (which creates part-usage, definition rel, and composition rel)
        const result = await elementMutations.createComposition.mutateAsync({
          sourceId,
          targetId,
          partName: name,
          compositionType,
        });

        console.log('[DEBUG] Composition created successfully:', result);

        // Add undo/redo action
        addAction({
          type: 'create-composition',
          data: { sourceId, targetId, partName: name, compositionType, ...result },
          description: `Create ${compositionType} relationship with part "${name}"`,
          undo: async () => {
            // Delete the part-usage (which will cascade delete the relationships)
            await elementMutations.deleteElement.mutateAsync(result.partUsageId);
          },
          redo: async () => {
            // Recreate the composition
            await elementMutations.createComposition.mutateAsync({
              sourceId,
              targetId,
              partName: name,
              compositionType,
            });
          },
        });
      } catch (error) {
        console.error('[DEBUG] Error creating composition:', error);
      }
    } else {
      // Regular node creation
      const id = `${promptData.kind}-${Date.now()}`;
      const { x: defaultX, y: defaultY } = promptData.clickPosition;

      console.log('[DEBUG] Creating element and adding to diagram:', {
        kind: promptData.kind,
        id,
        name,
        position: { x: defaultX, y: defaultY },
        diagramId: activeDiagram.id,
      });

      // Run mutations sequentially to ensure proper order
      try {
        // 1. Create the element first
        await elementMutations.createElement.mutateAsync({
          kind: promptData.kind as any,
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
          data: { id, kind: promptData.kind, name, position: { x: defaultX, y: defaultY }, diagramId: activeDiagram.id },
          description: `Create ${promptData.kind} "${name}"`,
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
              kind: promptData.kind as any,
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
    }
  }, [promptData, activeDiagram, elementMutations, diagramMutations, addAction]);

  const handlePromptCancel = useCallback(() => {
    setShowPrompt(false);
    setPromptData(null);
  }, []);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    console.log('[DEBUG] onNodesChange triggered', {
      changeCount: changes.length,
      changes: changes.map(c => ({ type: c.type, ...(('id' in c) && { id: c.id }) }))
    });

    setNodes((nds) => {
      // Handle node removal (delete key)
      // IMPORTANT: Only process removals that are user-initiated (via keyboard delete)
      // If isKeyboardDeleteRef is false, the removal is from a data sync (e.g., Model Browser delete)
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
              isKeyboardDelete: isKeyboardDeleteRef.current,
            });

            // Only process the deletion if it's user-initiated via keyboard
            if (isKeyboardDeleteRef.current) {
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
            } else {
              console.log('[DEBUG] Skipping deletion - node was removed by external action (e.g., Model Browser delete)');
            }
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
      console.log('[DEBUG] ========== onConnect triggered ==========', {
        connection,
        toolbarMode,
        toolbarDataType: toolbarData?.type,
        hasSource: !!connection.source,
        hasTarget: !!connection.target,
      });

      if (toolbarMode === 'create-relationship' && toolbarData?.type && connection.source && connection.target) {
        // Check if this is a composition or aggregation (SysML v2.0 compliant)
        if (toolbarData.type === 'composition' || toolbarData.type === 'aggregation') {
          // Check if we're connecting a state-machine to a state-definition (or reverse)
          const sourceNode = nodes.find(n => n.id === connection.source);
          const targetNode = nodes.find(n => n.id === connection.target);

          console.log('[DEBUG] Composition connection attempt:', {
            connectionSource: connection.source,
            connectionTarget: connection.target,
            nodesLength: nodes.length,
            foundSourceNode: !!sourceNode,
            foundTargetNode: !!targetNode,
            sourceNodeId: sourceNode?.id,
            targetNodeId: targetNode?.id,
            sourceNodeKind: sourceNode?.data?.kind,
            targetNodeKind: targetNode?.data?.kind,
          });

          const isStateMachineToStateDefinition =
            sourceNode?.data?.kind === 'state-machine' && targetNode?.data?.kind === 'state-definition';
          const isStateDefinitionToStateMachine =
            sourceNode?.data?.kind === 'state-definition' && targetNode?.data?.kind === 'state-machine';

          console.log('[DEBUG] Composition connection check:', {
            sourceKind: sourceNode?.data?.kind,
            targetKind: targetNode?.data?.kind,
            isStateMachineToStateDefinition,
            isStateDefinitionToStateMachine,
          });

          if (isStateMachineToStateDefinition || isStateDefinitionToStateMachine) {
            console.log('[DEBUG] Detected state-machine <-> state-definition connection!');

            // Determine which is which
            const stateMachineId = isStateMachineToStateDefinition ? connection.source : connection.target;
            const stateDefinitionId = isStateMachineToStateDefinition ? connection.target : connection.source;

            // Show prompt modal for state name (state-in-statemachine pattern)
            setPromptData({
              kind: 'state-in-statemachine',
              clickPosition: { x: 0, y: 0 }, // Not used
              compositionData: {
                sourceId: stateMachineId, // state machine
                targetId: stateDefinitionId, // state definition
                compositionType: toolbarData.type as 'composition' | 'aggregation',
              },
            });
            setShowPrompt(true);
          } else {
            // Show prompt modal for part name
            setPromptData({
              kind: 'composition',
              clickPosition: { x: 0, y: 0 }, // Not used for composition
              compositionData: {
                sourceId: connection.source,
                targetId: connection.target,
                compositionType: toolbarData.type as 'composition' | 'aggregation',
              },
            });
            setShowPrompt(true);
          }
        } else {
          // Regular relationship (not composition/aggregation)
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

              // For use case extend/include relationships, also update the source node's compartment
              if (toolbarData.type === 'extend' || toolbarData.type === 'include') {
                const sourceNode = nodes.find(n => n.id === connection.source);
                const targetNode = nodes.find(n => n.id === connection.target);

                console.log('[DEBUG] Checking use case relationship sync', {
                  relationshipType: toolbarData.type,
                  sourceNode: sourceNode ? { id: sourceNode.id, kind: sourceNode.data.kind, name: sourceNode.data.name } : null,
                  targetNode: targetNode ? { id: targetNode.id, kind: targetNode.data.kind, name: targetNode.data.name } : null,
                  isUseCaseNode: sourceNode && (sourceNode.data.kind === 'use-case-usage' || sourceNode.data.kind === 'use-case-definition')
                });

                if (sourceNode && targetNode &&
                    (sourceNode.data.kind === 'use-case-usage' || sourceNode.data.kind === 'use-case-definition')) {

                  console.log('[DEBUG] Syncing use case compartment for', toolbarData.type, {
                    sourceId: sourceNode.id,
                    sourceName: sourceNode.data.name,
                    targetId: targetNode.id,
                    targetName: targetNode.data.name
                  });

                  // Get current extends/includes arrays
                  const currentExtends = (sourceNode.data as any).extends || [];
                  const currentIncludes = (sourceNode.data as any).includes || (sourceNode.data as any).includedUseCases || [];

                  // Add target name to appropriate array
                  const updates: any = {};
                  if (toolbarData.type === 'extend') {
                    // Only use case usages have extends (per SysML v2 spec)
                    if (sourceNode.data.kind === 'use-case-usage') {
                      if (!currentExtends.includes(targetNode.data.name)) {
                        updates.extends = [...currentExtends, targetNode.data.name];
                        console.log('[DEBUG] Adding extend:', targetNode.data.name, 'to usage:', sourceNode.data.name);
                      } else {
                        console.log('[DEBUG] Extend already exists:', targetNode.data.name);
                      }
                    } else {
                      console.warn('[WARN] Cannot add extends to use-case-definition. Only use-case-usages can extend other use cases.');
                    }
                  } else if (toolbarData.type === 'include') {
                    // Both definitions and usages have includes
                    if (!currentIncludes.includes(targetNode.data.name)) {
                      if (sourceNode.data.kind === 'use-case-definition') {
                        updates.includedUseCases = [...currentIncludes, targetNode.data.name];
                      } else {
                        updates.includes = [...currentIncludes, targetNode.data.name];
                      }
                    }
                  }

                  // Update node if there are changes
                  if (Object.keys(updates).length > 0) {
                    console.log('[DEBUG] Updating use case node with:', { id: sourceNode.id, updates });
                    await elementMutations.updateElement.mutateAsync({
                      id: sourceNode.id,
                      updates
                    });
                    console.log('[DEBUG] Use case node updated successfully');
                  } else {
                    console.log('[DEBUG] No updates needed - target already in list or no changes');
                  }
                }
              }

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
      }
    },
    [toolbarMode, toolbarData, elementMutations, addAction, nodes]
  );

  const onConnectStart = useCallback(
    (_event: React.MouseEvent | React.TouchEvent, { nodeId, handleId }: { nodeId: string | null; handleId: string | null }) => {
      if (nodeId) {
        setConnectingFrom({ nodeId, handleId: handleId || undefined });
        console.log('[DEBUG] Connection started from node:', nodeId);
      }
    },
    []
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      console.log('[DEBUG] onConnectEnd triggered', {
        hasConnectingFrom: !!connectingFrom,
        target: event.target,
      });

      if (!connectingFrom || !activeDiagram) {
        setConnectingFrom(null);
        return;
      }

      // Check if the connection ended on a node (vs. blank canvas)
      // If it ended on a node, onConnect will handle it, so we skip this
      const target = event.target as HTMLElement;
      const isOnNode = target.closest('.react-flow__node') !== null;

      console.log('[DEBUG] onConnectEnd analysis', {
        isOnNode,
        targetElement: target.className,
      });

      if (isOnNode) {
        // Connection ended on a node, onConnect will handle it
        console.log('[DEBUG] Connection ended on a node, letting onConnect handle it');
        setConnectingFrom(null);
        return;
      }

      // Check if this is a composition/aggregation in progress
      if (toolbarMode === 'create-relationship' &&
          toolbarData?.type &&
          (toolbarData.type === 'composition' || toolbarData.type === 'aggregation')) {

        // Get the canvas coordinates where the connection was dropped
        const reactFlowBounds = target.closest('.react-flow')?.getBoundingClientRect();

        if (reactFlowBounds && event instanceof MouseEvent) {
          // Calculate position relative to the canvas
          const x = event.clientX - reactFlowBounds.left;
          const y = event.clientY - reactFlowBounds.top;

          console.log('[DEBUG] Composition dropped on blank canvas', {
            sourceNodeId: connectingFrom.nodeId,
            position: { x, y },
            compositionType: toolbarData.type
          });

          // Show prompt to create a new part-usage at this location
          setPromptData({
            kind: 'composition-on-canvas',
            clickPosition: { x, y },
            compositionData: {
              sourceId: connectingFrom.nodeId,
              targetId: '', // Will be created
              compositionType: toolbarData.type as 'composition' | 'aggregation',
            },
          });
          setShowPrompt(true);
        }
      }

      setConnectingFrom(null);
    },
    [connectingFrom, activeDiagram, toolbarMode, toolbarData]
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

  // Context Menu Handlers
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node<SysMLNodeData>) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, node });
  }, []);

  const handleCut = useCallback((node: Node<SysMLNodeData>) => {
    setClipboard({ action: 'cut', node });
  }, []);

  const handleCopy = useCallback((node: Node<SysMLNodeData>) => {
    setClipboard({ action: 'copy', node });
  }, []);

  const handlePaste = useCallback(async () => {
    if (!clipboard || !activeDiagram) return;

    const newId = `${clipboard.node.data.kind}-${Date.now()}`;
    const newNodeSpec = {
      kind: clipboard.node.data.kind,
      spec: {
        ...clipboard.node.data,
        id: newId,
        name: `${clipboard.node.data.name || clipboard.node.id} (Copy)`,
      },
    } as LibSysMLNodeSpec;

    try {
      await elementMutations.createElement.mutateAsync(newNodeSpec);

      // Add to current diagram
      const position = {
        x: clipboard.node.position.x + 50,
        y: clipboard.node.position.y + 50,
      };
      await diagramMutations.addElementsToDiagram.mutateAsync({
        diagramId: activeDiagram.id,
        elementIds: [newId],
      });
      await diagramMutations.updateElementPositionInDiagram.mutateAsync({
        diagramId: activeDiagram.id,
        elementId: newId,
        position,
      });

      // If it was a cut operation, remove the original from diagram
      if (clipboard.action === 'cut') {
        await diagramMutations.removeElementFromDiagram.mutateAsync({
          diagramId: activeDiagram.id,
          elementId: clipboard.node.id,
        });
        setClipboard(null);
      }
    } catch (error) {
      console.error('Paste error:', error);
    }
  }, [clipboard, activeDiagram, elementMutations, diagramMutations]);

  const handleRename = useCallback((node: Node<SysMLNodeData>) => {
    setEditingNode(node);
  }, []);

  const handleHideFromDiagram = useCallback(async (node: Node<SysMLNodeData>) => {
    if (!activeDiagram) return;

    try {
      await diagramMutations.removeElementFromDiagram.mutateAsync({
        diagramId: activeDiagram.id,
        elementId: node.id,
      });

      // Add undo/redo action
      addAction({
        type: 'remove-from-diagram',
        data: { diagramId: activeDiagram.id, elementId: node.id, position: node.position },
        description: `Hide ${node.data.kind} "${node.data.name}" from diagram`,
        undo: async () => {
          await diagramMutations.addElementsToDiagram.mutateAsync({
            diagramId: activeDiagram.id,
            elementIds: [node.id],
          });
          // Restore position
          await diagramMutations.updateElementPositionInDiagram.mutateAsync({
            diagramId: activeDiagram.id,
            elementId: node.id,
            position: node.position,
          });
        },
        redo: async () => {
          await diagramMutations.removeElementFromDiagram.mutateAsync({
            diagramId: activeDiagram.id,
            elementId: node.id,
          });
        },
      });
    } catch (error) {
      console.error('Hide from diagram error:', error);
    }
  }, [activeDiagram, diagramMutations, addAction]);

  const handleDelete = useCallback((node: Node<SysMLNodeData>) => {
    if (!activeDiagram) return;
    setDeleteNodeConfirm({ node });
  }, [activeDiagram]);

  const confirmNodeDelete = useCallback(async () => {
    if (!deleteNodeConfirm || !activeDiagram) return;

    const node = deleteNodeConfirm.node;
    setDeleteNodeConfirm(null);

    try {
      await diagramMutations.removeElementFromDiagram.mutateAsync({
        diagramId: activeDiagram.id,
        elementId: node.id,
      });

      // Clear clipboard if deleted node was in it
      if (clipboard?.node.id === node.id) {
        setClipboard(null);
      }

      // Add undo/redo action
      addAction({
        type: 'remove-from-diagram',
        data: { diagramId: activeDiagram.id, elementId: node.id },
        description: `Remove ${node.data.kind} "${node.data.name}" from diagram`,
        undo: async () => {
          await diagramMutations.addElementsToDiagram.mutateAsync({
            diagramId: activeDiagram.id,
            elementIds: [node.id],
          });
        },
        redo: async () => {
          await diagramMutations.removeElementFromDiagram.mutateAsync({
            diagramId: activeDiagram.id,
            elementId: node.id,
          });
        },
      });
    } catch (error) {
      console.error('Delete error:', error);
    }
  }, [deleteNodeConfirm, activeDiagram, clipboard, diagramMutations, addAction]);

  const handleShowAllRelationships = useCallback(async (node: Node<SysMLNodeData>) => {
    if (!activeDiagram || !model) return;

    // Find all relationships connected to this node
    const connectedRelationshipIds: string[] = [];
    model.relationships.forEach((rel) => {
      if (rel.source === node.id || rel.target === node.id) {
        connectedRelationshipIds.push(rel.id);
      }
    });

    // Filter to only hidden relationships
    const hiddenRelIds = activeDiagram.hiddenRelationshipIds || [];
    const hiddenConnectedRels = connectedRelationshipIds.filter(id => hiddenRelIds.includes(id));

    if (hiddenConnectedRels.length === 0) {
      setInfoMessage('No hidden relationships found for this node.');
      return;
    }

    try {
      // Show all hidden relationships connected to this node
      for (const relId of hiddenConnectedRels) {
        await diagramMutations.showRelationshipInDiagram.mutateAsync({
          diagramId: activeDiagram.id,
          relationshipId: relId,
        });
      }

      console.log(`Shown ${hiddenConnectedRels.length} hidden relationships for node ${node.id}`);
    } catch (error) {
      console.error('Error showing relationships:', error);
    }
  }, [activeDiagram, model, diagramMutations]);

  const handleShowRelatedElements = useCallback(async (node: Node<SysMLNodeData>) => {
    if (!activeDiagram || !model) return;

    // Find all relationships connected to this node
    const relatedElementIds = new Set<string>();

    model.relationships.forEach((rel) => {
      if (rel.source === node.id) {
        relatedElementIds.add(rel.target);
      } else if (rel.target === node.id) {
        relatedElementIds.add(rel.source);
      }
    });

    // Filter to only elements not already in the diagram
    const newElementIds = Array.from(relatedElementIds).filter(
      (id) => !activeDiagram.elementIds.includes(id)
    );

    if (newElementIds.length === 0) {
      setInfoMessage('No hidden related elements found for this node.');
      return;
    }

    try {
      // Add related elements to diagram
      await diagramMutations.addElementsToDiagram.mutateAsync({
        diagramId: activeDiagram.id,
        elementIds: newElementIds,
      });

      // Position new elements in a circle around the source node
      const radius = 200;
      const angleStep = (2 * Math.PI) / newElementIds.length;

      const positions: Record<string, { x: number; y: number }> = {};
      newElementIds.forEach((id, index) => {
        const angle = index * angleStep;
        positions[id] = {
          x: node.position.x + radius * Math.cos(angle),
          y: node.position.y + radius * Math.sin(angle),
        };
      });

      await diagramMutations.updateDiagramPositions.mutateAsync({
        diagramId: activeDiagram.id,
        positions,
      });

      console.log(`Added ${newElementIds.length} related elements to diagram`);
    } catch (error) {
      console.error('Error showing related elements:', error);
    }
  }, [activeDiagram, model, diagramMutations]);

  const handleToggleCompartments = useCallback((node: Node<SysMLNodeData>) => {
    if (!activeDiagram) return;

    const newShowCompartments = node.data.showCompartments === false ? true : false;

    // Update node data in React Flow state
    setNodes((nds) =>
      nds.map((n) =>
        n.id === node.id
          ? { ...n, data: { ...n.data, showCompartments: newShowCompartments } }
          : n
      )
    );
  }, [activeDiagram]);

  const getContextMenuItems = useCallback((node: Node<SysMLNodeData>): ContextMenuItem[] => {
    const hasCompartments = node.data.compartments && node.data.compartments.length > 0;
    const showCompartments = node.data.showCompartments !== false; // Default to true

    return [
      {
        label: 'Cut',
        icon: React.createElement(Scissors, { size: 14 }),
        onClick: () => handleCut(node),
      },
      {
        label: 'Copy',
        icon: React.createElement(Copy, { size: 14 }),
        onClick: () => handleCopy(node),
      },
      {
        label: 'Paste',
        icon: React.createElement(Clipboard, { size: 14 }),
        onClick: handlePaste,
        disabled: !clipboard,
      },
      { separator: true, label: '', onClick: () => {} },
      {
        label: 'Edit',
        icon: React.createElement(Edit, { size: 14 }),
        onClick: () => handleRename(node),
      },
      {
        label: 'Rename',
        icon: React.createElement(Type, { size: 14 }),
        onClick: () => handleRename(node),
      },
      { separator: true, label: '', onClick: () => {} },
      {
        label: showCompartments ? 'Hide compartments' : 'Show compartments',
        icon: React.createElement(Network, { size: 14 }),
        onClick: () => handleToggleCompartments(node),
        disabled: !hasCompartments,
      },
      {
        label: 'Show related elements',
        icon: React.createElement(Network, { size: 14 }),
        onClick: () => handleShowRelatedElements(node),
      },
      {
        label: 'Show all relationships',
        icon: React.createElement(Network, { size: 14 }),
        onClick: () => handleShowAllRelationships(node),
      },
      { separator: true, label: '', onClick: () => {} },
      {
        label: 'Hide from diagram',
        icon: React.createElement(EyeOff, { size: 14 }),
        onClick: () => handleHideFromDiagram(node),
      },
      {
        label: 'Delete',
        icon: React.createElement(Trash2, { size: 14 }),
        onClick: () => handleDelete(node),
      },
    ];
  }, [clipboard, handleCut, handleCopy, handlePaste, handleRename, handleDelete, handleShowRelatedElements, handleShowAllRelationships, handleToggleCompartments, handleHideFromDiagram]);

  // Edge Context Menu Handlers
  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setEdgeContextMenu({ x: event.clientX, y: event.clientY, edge });
  }, []);

  const handleEditEdgeLabel = useCallback(async (edge: Edge) => {
    const newLabel = window.prompt('Enter new label for relationship:', edge.data?.label || '');
    if (newLabel !== null) {
      try {
        await elementMutations.updateRelationship.mutateAsync({
          id: edge.id,
          updates: { label: newLabel },
        });
      } catch (error) {
        console.error('Edit edge label error:', error);
      }
    }
  }, [elementMutations]);

  const handleDeleteEdge = useCallback((edge: Edge) => {
    setDeleteEdgeConfirm({ edge });
  }, []);

  const confirmEdgeDelete = useCallback(async () => {
    if (!deleteEdgeConfirm) return;

    const edge = deleteEdgeConfirm.edge;
    setDeleteEdgeConfirm(null);

    try {
      await elementMutations.deleteRelationship.mutateAsync(edge.id);

      // Add undo/redo action
      addAction({
        type: 'delete-edge',
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.data?.kind,
        },
        description: `Delete ${edge.data?.kind || 'relationship'}`,
        undo: async () => {
          // Would need to recreate the relationship
          await elementMutations.createRelationship.mutateAsync({
            id: edge.id,
            type: edge.data?.kind || 'dependency',
            source: edge.source,
            target: edge.target,
            label: edge.data?.label,
          });
        },
        redo: async () => {
          await elementMutations.deleteRelationship.mutateAsync(edge.id);
        },
      });
    } catch (error) {
      console.error('Delete edge error:', error);
    }
  }, [deleteEdgeConfirm, elementMutations, addAction]);

  const handleHideEdgeFromDiagram = useCallback(async (edge: Edge) => {
    if (!activeDiagram) return;

    try {
      await diagramMutations.hideRelationshipFromDiagram.mutateAsync({
        diagramId: activeDiagram.id,
        relationshipId: edge.id,
      });

      // Add undo/redo action
      addAction({
        type: 'remove-from-diagram',
        data: { diagramId: activeDiagram.id, relationshipId: edge.id },
        description: `Hide ${edge.data?.kind || 'relationship'} from diagram`,
        undo: async () => {
          await diagramMutations.showRelationshipInDiagram.mutateAsync({
            diagramId: activeDiagram.id,
            relationshipId: edge.id,
          });
        },
        redo: async () => {
          await diagramMutations.hideRelationshipFromDiagram.mutateAsync({
            diagramId: activeDiagram.id,
            relationshipId: edge.id,
          });
        },
      });
    } catch (error) {
      console.error('Hide edge from diagram error:', error);
    }
  }, [activeDiagram, diagramMutations, addAction]);

  const handleReverseEdge = useCallback(async (edge: Edge) => {
    if (!activeDiagram) return;

    try {
      // Delete the old edge
      await elementMutations.deleteRelationship.mutateAsync(edge.id);

      // Create a new edge with reversed direction
      const newId = `${edge.target}-${edge.data?.kind || 'dependency'}-${edge.source}`;
      await elementMutations.createRelationship.mutateAsync({
        id: newId,
        type: edge.data?.kind || 'dependency',
        source: edge.target, // Reversed
        target: edge.source, // Reversed
        label: edge.data?.label,
      });

      // Add undo/redo action
      addAction({
        type: 'create-edge',
        data: { oldEdge: edge, newEdgeId: newId },
        description: `Reverse ${edge.data?.kind || 'relationship'} direction`,
        undo: async () => {
          await elementMutations.deleteRelationship.mutateAsync(newId);
          await elementMutations.createRelationship.mutateAsync({
            id: edge.id,
            type: edge.data?.kind || 'dependency',
            source: edge.source,
            target: edge.target,
            label: edge.data?.label,
          });
        },
        redo: async () => {
          await elementMutations.deleteRelationship.mutateAsync(edge.id);
          await elementMutations.createRelationship.mutateAsync({
            id: newId,
            type: edge.data?.kind || 'dependency',
            source: edge.target,
            target: edge.source,
            label: edge.data?.label,
          });
        },
      });
    } catch (error) {
      console.error('Reverse edge error:', error);
    }
  }, [activeDiagram, elementMutations, addAction]);

  const getEdgeContextMenuItems = useCallback((edge: Edge): ContextMenuItem[] => {
    return [
      {
        label: 'Edit label',
        icon: React.createElement(Edit, { size: 14 }),
        onClick: () => handleEditEdgeLabel(edge),
      },
      {
        label: 'Reverse direction',
        icon: React.createElement(Network, { size: 14 }),
        onClick: () => handleReverseEdge(edge),
      },
      { separator: true, label: '', onClick: () => {} },
      {
        label: 'Hide from diagram',
        icon: React.createElement(EyeOff, { size: 14 }),
        onClick: () => handleHideEdgeFromDiagram(edge),
      },
      {
        label: 'Delete',
        icon: React.createElement(Trash2, { size: 14 }),
        onClick: () => handleDeleteEdge(edge),
      },
    ];
  }, [handleEditEdgeLabel, handleReverseEdge, handleDeleteEdge, handleHideEdgeFromDiagram]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();

    if (!activeDiagram) return;

    try {
      const data = e.dataTransfer.getData('application/sysml-element');
      if (!data) return;

      const element = JSON.parse(data);
      console.log('[DEBUG] Dropped element:', element);

      // Get the drop position relative to the diagram
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - 110; // Offset for node center
      const y = e.clientY - rect.top - 60;

      // Check if element is already in the diagram
      const isInDiagram = activeDiagram.elementIds?.includes(element.id);

      if (!isInDiagram) {
        // Add element to diagram
        await diagramMutations.addElementsToDiagram.mutateAsync({
          diagramId: activeDiagram.id,
          elementIds: [element.id],
        });
      }

      // Update element position
      await diagramMutations.updateElementPositionInDiagram.mutateAsync({
        diagramId: activeDiagram.id,
        elementId: element.id,
        position: { x, y },
      });

      // Add undo/redo action
      addAction({
        type: 'add-to-diagram',
        data: { id: element.id, kind: element.kind, name: element.name, position: { x, y }, diagramId: activeDiagram.id, wasInDiagram: isInDiagram },
        description: `Add ${element.kind} "${element.name}" to diagram`,
        undo: async () => {
          if (!isInDiagram) {
            await diagramMutations.removeElementFromDiagram.mutateAsync({
              diagramId: activeDiagram.id,
              elementId: element.id,
            });
          }
        },
        redo: async () => {
          if (!isInDiagram) {
            await diagramMutations.addElementsToDiagram.mutateAsync({
              diagramId: activeDiagram.id,
              elementIds: [element.id],
            });
          }
          await diagramMutations.updateElementPositionInDiagram.mutateAsync({
            diagramId: activeDiagram.id,
            elementId: element.id,
            position: { x, y },
          });
        },
      });
    } catch (error) {
      console.error('[DEBUG] Error handling drop:', error);
    }
  }, [activeDiagram, diagramMutations, addAction]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

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
      onDrop={handleDrop}
      onDragOver={handleDragOver}
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
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneClick={onPaneClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
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
          model={model}
          viewpointId={selectedDiagram?.viewpointId}
        />
      )}

      {/* Prompt Modal for creating nodes and compositions */}
      {showPrompt && promptData && (
        <PromptModal
          title={
            promptData.kind === 'state-in-statemachine'
              ? 'Add State to State Machine'
              : promptData.kind === 'composition' || promptData.kind === 'composition-on-canvas'
              ? 'Create Part'
              : 'Create Element'
          }
          message={
            promptData.kind === 'state-in-statemachine'
              ? 'Enter name for the state:'
              : promptData.kind === 'composition' || promptData.kind === 'composition-on-canvas'
              ? `Enter name for the part (${promptData.compositionData?.compositionType}):`
              : `Enter name for ${promptData.kind.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}:`
          }
          defaultValue=""
          placeholder={
            promptData.kind === 'state-in-statemachine'
              ? 'State name'
              : promptData.kind === 'composition' || promptData.kind === 'composition-on-canvas'
              ? 'Part name'
              : 'Element name'
          }
          onConfirm={handlePromptConfirm}
          onCancel={handlePromptCancel}
        />
      )}

      {/* Node Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.node)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Edge Context Menu */}
      {edgeContextMenu && (
        <ContextMenu
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          items={getEdgeContextMenuItems(edgeContextMenu.edge)}
          onClose={() => setEdgeContextMenu(null)}
        />
      )}

      {/* Delete Node Confirmation Modal */}
      {deleteNodeConfirm && (
        <ConfirmModal
          title="Remove from Diagram"
          message={`Are you sure you want to remove "${deleteNodeConfirm.node.data.name || deleteNodeConfirm.node.id}" from this diagram? The element will still exist in the model.`}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="warning"
          onConfirm={confirmNodeDelete}
          onCancel={() => setDeleteNodeConfirm(null)}
        />
      )}

      {/* Delete Edge Confirmation Modal */}
      {deleteEdgeConfirm && (
        <ConfirmModal
          title="Delete Relationship"
          message={`Are you sure you want to delete this ${deleteEdgeConfirm.edge.data?.kind || 'relationship'}? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={confirmEdgeDelete}
          onCancel={() => setDeleteEdgeConfirm(null)}
        />
      )}

      {/* Info Modal */}
      {infoMessage && (
        <ConfirmModal
          title="Information"
          message={infoMessage}
          confirmLabel="OK"
          cancelLabel="Close"
          variant="info"
          onConfirm={() => setInfoMessage(null)}
          onCancel={() => setInfoMessage(null)}
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
