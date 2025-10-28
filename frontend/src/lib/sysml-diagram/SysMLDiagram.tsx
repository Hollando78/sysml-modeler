import { memo, useMemo, type ComponentProps } from 'react';
import ReactFlow, { Background, ConnectionMode, Controls, MiniMap } from 'reactflow';

import { sysmlEdgeTypes, SysMLEdgeMarkersComponent } from './edges';
import { sysmlNodeTypes } from './nodes';
import { realizeViewpoint } from './viewpoints';
import type { SysMLReactFlowEdge, SysMLReactFlowNode } from './types';
import type { SysMLModel, SysMLViewpoint, ViewMaterializationOptions } from './viewpoints';

type BaseReactFlowProps = ComponentProps<typeof ReactFlow>;

export interface SysMLDiagramProps
  extends Omit<BaseReactFlowProps, 'nodeTypes' | 'edgeTypes' | 'nodes' | 'edges'> {
  nodes?: SysMLReactFlowNode[];
  edges?: SysMLReactFlowEdge[];
  model?: SysMLModel;
  viewpoint?: SysMLViewpoint;
  viewOptions?: ViewMaterializationOptions;
  nodeTypes?: BaseReactFlowProps['nodeTypes'];
  edgeTypes?: BaseReactFlowProps['edgeTypes'];
  showControls?: boolean;
  showMiniMap?: boolean;
  showBackground?: boolean;
}

export const SysMLDiagram = memo(
  ({
    nodes,
    edges,
    model,
    viewpoint,
    viewOptions,
    showControls = true,
    showMiniMap = true,
    showBackground = true,
    nodeTypes,
    edgeTypes,
    children,
    fitView = true,
    ...rest
  }: SysMLDiagramProps) => {
    console.log('[DEBUG] SysMLDiagram render', {
      nodeCount: nodes?.length,
      edgeCount: edges?.length,
      hasModel: !!model,
      hasViewpoint: !!viewpoint,
      restProps: Object.keys(rest)
    });

    let resolvedNodes = nodes;
    let resolvedEdges = edges;
    const { connectionMode, ...reactFlowProps } = rest;

    if (model && viewpoint) {
      const view = realizeViewpoint(model, viewpoint, viewOptions);
      resolvedNodes = view.nodes;
      resolvedEdges = view.edges;
    }

    if (!resolvedNodes || !resolvedEdges) {
      throw new Error('SysMLDiagram requires nodes/edges or a model+viewpoint combination.');
    }

    const memoizedNodeTypes = useMemo(
      () => (nodeTypes ? { ...sysmlNodeTypes, ...nodeTypes } : sysmlNodeTypes),
      [nodeTypes]
    );

    const memoizedEdgeTypes = useMemo(
      () => (edgeTypes ? { ...sysmlEdgeTypes, ...edgeTypes } : sysmlEdgeTypes),
      [edgeTypes]
    );

    return (
      <ReactFlow
        {...reactFlowProps}
        connectionMode={connectionMode ?? ConnectionMode.Loose}
        fitView={fitView}
        nodes={resolvedNodes}
        edges={resolvedEdges}
        nodeTypes={memoizedNodeTypes}
        edgeTypes={memoizedEdgeTypes}
        style={{ width: '100%', height: '100%' }}
      >
        <SysMLEdgeMarkersComponent />
        {showBackground && <Background gap={16} size={1} color="#393939" style={{ pointerEvents: 'none' }} />}
        {showMiniMap && <MiniMap pannable zoomable />}
        {showControls && <Controls position="bottom-right" />}
        {children}
      </ReactFlow>
    );
  }
);
