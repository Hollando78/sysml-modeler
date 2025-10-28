import { useEffect, useMemo, useState, useCallback } from 'react';
import { applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { SysMLDiagram, createNodesFromSpecs, createEdgesFromRelationships } from '../../lib/sysml-diagram';
import { useSysMLModel, useSysMLMutations, useDiagramMutations, useSysMLDiagram } from '../../hooks/useSysMLApi';
import { useDiagram } from '../../lib/DiagramContext';
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from 'reactflow';
import type { ToolbarMode } from './SysMLToolbar';

interface SysMLCanvasProps {
  toolbarMode: ToolbarMode;
  toolbarData?: { kind?: string; type?: string };
}

export default function SysMLCanvas({ toolbarMode, toolbarData }: SysMLCanvasProps) {
  const { selectedDiagram } = useDiagram();
  const { data: latestDiagram, isLoading: diagramLoading } = useSysMLDiagram(selectedDiagram?.id);

  // Always use the latest diagram data from the query, not the stale context data
  const activeDiagram = latestDiagram;

  const { data: model, isLoading: modelLoading, error } = useSysMLModel(activeDiagram?.viewpointId);
  const isLoading = diagramLoading || modelLoading;

  const elementMutations = useSysMLMutations();
  const diagramMutations = useDiagramMutations();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

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

      const reactFlowNodes = createNodesFromSpecs(filteredNodes, positions);
      const reactFlowEdges = createEdgesFromRelationships(model.relationships);

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
              kind: toolbarData.kind,
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
          } catch (error) {
            console.error('[DEBUG] Error creating element:', error);
          }
        })();
      }
    },
    [toolbarMode, toolbarData, activeDiagram, elementMutations, diagramMutations]
  );

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    console.log('[DEBUG] onNodesChange triggered', {
      changeCount: changes.length,
      changes: changes.map(c => ({ type: c.type, id: c.id, dragging: c.dragging, position: c.position }))
    });

    setNodes((nds) => {
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

          if (updatedNode && activeDiagram?.id) {
            console.log('[DEBUG] Position change detected, saving to diagram', {
              id: change.id,
              position: updatedNode.position,
              diagramId: activeDiagram.id,
            });

            diagramMutations.updateElementPositionInDiagram.mutate({
              diagramId: activeDiagram.id,
              elementId: change.id,
              position: updatedNode.position,
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
  }, [activeDiagram, diagramMutations]);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

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

        elementMutations.createRelationship.mutate({
          id,
          type: toolbarData.type,
          source: connection.source,
          target: connection.target,
          label: toolbarData.type,
        });
      }
    },
    [toolbarMode, toolbarData, elementMutations]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('[DEBUG] Node clicked!', {
      nodeId: node.id,
      nodeType: node.type,
      draggable: node.draggable,
      selectable: node.selectable,
      selected: node.selected
    });
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
        onNodeClick={onNodeClick}
        nodesDraggable={toolbarMode !== 'create-relationship'}
        nodesConnectable={toolbarMode === 'create-relationship'}
        elementsSelectable={true}
        panOnDrag={toolbarMode !== 'create-relationship'}
        connectionLineType="straight"
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
