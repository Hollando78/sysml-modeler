import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Search, List, Network, Scissors, Copy, Clipboard, Edit, Type, Trash2 } from 'lucide-react';
import { useSysMLModel, useSysMLMutations } from '../../hooks/useSysMLApi';
import { useDiagram } from '../../lib/DiagramContext';
import { getNodeIcon } from '../../lib/sysml-diagram/icon-mappings';
import ContextMenu, { type ContextMenuItem } from '../common/ContextMenu';
import type { SysMLNodeSpec } from '../../types';

type ViewMode = 'kind' | 'tree';

export default function ModelBrowser() {
  const { selectedDiagram } = useDiagram();
  const { data: model, isLoading, error } = useSysMLModel(selectedDiagram?.viewpointId);
  const mutations = useSysMLMutations();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('kind');
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: SysMLNodeSpec } | null>(null);
  const [clipboard, setClipboard] = useState<{ action: 'cut' | 'copy'; node: SysMLNodeSpec } | null>(null);
  const [editingNode, setEditingNode] = useState<{ id: string; name: string } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Group nodes by kind
  const groupedNodes = useMemo(() => {
    if (!model) return {};

    const groups: Record<string, SysMLNodeSpec[]> = {};
    model.nodes.forEach((node) => {
      if (!groups[node.kind]) {
        groups[node.kind] = [];
      }
      groups[node.kind].push(node);
    });

    // Filter by search term
    if (searchTerm) {
      const filtered: Record<string, SysMLNodeSpec[]> = {};
      Object.entries(groups).forEach(([kind, nodes]) => {
        const matchingNodes = nodes.filter((node) =>
          node.spec.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (matchingNodes.length > 0) {
          filtered[kind] = matchingNodes;
        }
      });
      return filtered;
    }

    return groups;
  }, [model, searchTerm]);

  // Build tree structure from ownership relationships
  const treeStructure = useMemo(() => {
    if (!model) return {};

    // Build a map of owned parts for each definition
    const ownershipMap: Record<string, Array<{ usage: SysMLNodeSpec; definition: SysMLNodeSpec }>> = {};

    // Find all composition/aggregation relationships
    model.relationships.forEach((rel) => {
      if (rel.type === 'composition' || rel.type === 'aggregation') {
        // rel.source is the owner (definition), rel.target is the owned part-usage
        const partUsage = model.nodes.find((n) => n.spec.id === rel.target);
        if (!partUsage) return;

        // Find the definition relationship from part-usage to its definition
        const defRel = model.relationships.find(
          (r) => r.type === 'definition' && r.source === partUsage.spec.id
        );
        if (!defRel) return;

        const definition = model.nodes.find((n) => n.spec.id === defRel.target);
        if (!definition) return;

        if (!ownershipMap[rel.source]) {
          ownershipMap[rel.source] = [];
        }
        ownershipMap[rel.source].push({ usage: partUsage, definition });
      }
    });

    // Group definitions by kind
    const tree: Record<string, Array<{ node: SysMLNodeSpec; children: typeof ownershipMap[string] }>> = {};

    model.nodes.forEach((node) => {
      // Only show definition types in tree
      if (node.kind.endsWith('-definition')) {
        if (!tree[node.kind]) {
          tree[node.kind] = [];
        }
        tree[node.kind].push({
          node,
          children: ownershipMap[node.spec.id] || []
        });
      }
    });

    return tree;
  }, [model]);

  const toggleKind = (kind: string) => {
    const newExpanded = new Set(expandedKinds);
    if (newExpanded.has(kind)) {
      newExpanded.delete(kind);
    } else {
      newExpanded.add(kind);
    }
    setExpandedKinds(newExpanded);
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const formatKind = (kind: string) => {
    return kind
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleContextMenu = (e: React.MouseEvent, node: SysMLNodeSpec) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleCut = (node: SysMLNodeSpec) => {
    setClipboard({ action: 'cut', node });
  };

  const handleCopy = (node: SysMLNodeSpec) => {
    setClipboard({ action: 'copy', node });
  };

  const handlePaste = async () => {
    if (!clipboard) return;

    const newId = `${clipboard.node.kind}-${Date.now()}`;
    const newNode: SysMLNodeSpec = {
      kind: clipboard.node.kind,
      spec: {
        ...clipboard.node.spec,
        id: newId,
        name: `${clipboard.node.spec.name || clipboard.node.spec.id} (Copy)`,
      },
    };

    try {
      await mutations.createElement.mutateAsync(newNode);

      // If it was a cut operation, delete the original
      if (clipboard.action === 'cut') {
        await mutations.deleteElement.mutateAsync(clipboard.node.spec.id);
        setClipboard(null);
      }
    } catch (error) {
      console.error('Paste error:', error);
    }
  };

  const handleRename = (node: SysMLNodeSpec) => {
    setEditingNode({ id: node.spec.id, name: node.spec.name || node.spec.id });
  };

  const handleRenameSubmit = async (nodeId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingNode(null);
      return;
    }

    try {
      await mutations.updateElement.mutateAsync({
        id: nodeId,
        updates: { name: newName.trim() },
      });
      setEditingNode(null);
    } catch (error) {
      console.error('Rename error:', error);
    }
  };

  const handleDelete = async (node: SysMLNodeSpec) => {
    if (window.confirm(`Are you sure you want to delete "${node.spec.name || node.spec.id}"?`)) {
      try {
        await mutations.deleteElement.mutateAsync(node.spec.id);
        // Clear clipboard if deleted node was in it
        if (clipboard?.node.spec.id === node.spec.id) {
          setClipboard(null);
        }
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  const getContextMenuItems = (node: SysMLNodeSpec): ContextMenuItem[] => {
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
        label: 'Delete',
        icon: React.createElement(Trash2, { size: 14 }),
        onClick: () => handleDelete(node),
      },
    ];
  };

  if (isLoading) {
    return <div style={styles.container}>Loading model...</div>;
  }

  if (error) {
    return <div style={styles.container}>Error loading model: {String(error)}</div>;
  }

  const kindCount = Object.keys(groupedNodes).length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Model Browser</h3>

        {/* View Mode Toggle */}
        <div style={styles.viewToggle}>
          <button
            style={{
              ...styles.viewButton,
              ...(viewMode === 'kind' ? styles.viewButtonActive : {})
            }}
            onClick={() => setViewMode('kind')}
            title="Kind View"
          >
            {React.createElement(List, { size: 14 })}
            <span style={styles.viewButtonText}>Kind</span>
          </button>
          <button
            style={{
              ...styles.viewButton,
              ...(viewMode === 'tree' ? styles.viewButtonActive : {})
            }}
            onClick={() => {
              setViewMode('tree');
              // Auto-expand all kinds when switching to tree view
              if (model) {
                const allKinds = Object.keys(treeStructure);
                if (allKinds.length > 0) {
                  setExpandedKinds(new Set(allKinds));
                }
              }
            }}
            title="Tree View"
          >
            {React.createElement(Network, { size: 14 })}
            <span style={styles.viewButtonText}>Tree</span>
          </button>
        </div>

        <div style={styles.searchContainer}>
          <Search size={14} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search elements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>

      <div style={styles.content}>
        {viewMode === 'kind' ? (
          // Kind View
          kindCount === 0 ? (
            <div style={styles.empty}>
              {searchTerm ? 'No elements match your search' : 'No elements in model'}
            </div>
          ) : (
            Object.entries(groupedNodes)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([kind, nodes]) => {
                const isExpanded = expandedKinds.has(kind);
                const KindIcon = getNodeIcon(kind);
                return (
                  <div key={kind} style={styles.group}>
                    <div style={styles.groupHeader} onClick={() => toggleKind(kind)}>
                      {isExpanded ? (
                        <ChevronDown size={14} style={styles.expandIcon} />
                      ) : (
                        <ChevronRight size={14} style={styles.expandIcon} />
                      )}
                      <KindIcon size={14} style={styles.kindIcon} />
                      <span style={styles.groupTitle}>
                        {formatKind(kind)} ({nodes.length})
                      </span>
                    </div>

                    {isExpanded && (
                      <div style={styles.nodeList}>
                        {nodes.map((node) => {
                          const isEditing = editingNode?.id === node.spec.id;
                          const isHovered = hoveredNode === node.spec.id;
                          return (
                            <div
                              key={node.spec.id}
                              style={{
                                ...styles.nodeItem,
                                ...(isHovered ? styles.nodeItemHover : {}),
                              }}
                              title={node.spec.description || node.spec.documentation}
                              draggable={!isEditing}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('application/sysml-element', JSON.stringify({
                                  id: node.spec.id,
                                  kind: node.kind,
                                  name: node.spec.name || node.spec.id
                                }));
                                e.dataTransfer.effectAllowed = 'copy';
                              }}
                              onContextMenu={(e) => handleContextMenu(e, node)}
                              onMouseEnter={() => setHoveredNode(node.spec.id)}
                              onMouseLeave={() => setHoveredNode(null)}
                            >
                              {isEditing && editingNode ? (
                                <input
                                  type="text"
                                  style={styles.renameInput}
                                  value={editingNode.name}
                                  onChange={(e) => setEditingNode({ id: editingNode.id, name: e.target.value })}
                                  onBlur={() => handleRenameSubmit(node.spec.id, editingNode.name)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleRenameSubmit(node.spec.id, editingNode.name);
                                    } else if (e.key === 'Escape') {
                                      setEditingNode(null);
                                    }
                                  }}
                                  autoFocus
                                />
                              ) : (
                                <>
                                  <span style={styles.nodeName}>{node.spec.name || node.spec.id}</span>
                                  {node.spec.status && (
                                    <span style={styles.nodeStatus}>{node.spec.status}</span>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
          )
        ) : (
          // Tree View
          Object.keys(treeStructure).length === 0 ? (
            <div style={styles.empty}>No definitions in model</div>
          ) : (
            Object.entries(treeStructure)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([kind, items]) => {
                const isKindExpanded = expandedKinds.has(kind);
                const KindIcon = getNodeIcon(kind);
                return (
                  <div key={kind} style={styles.group}>
                    <div style={styles.groupHeader} onClick={() => toggleKind(kind)}>
                      {isKindExpanded ? (
                        <ChevronDown size={14} style={styles.expandIcon} />
                      ) : (
                        <ChevronRight size={14} style={styles.expandIcon} />
                      )}
                      <KindIcon size={14} style={styles.kindIcon} />
                      <span style={styles.groupTitle}>
                        {formatKind(kind)} ({items.length})
                      </span>
                    </div>

                    {isKindExpanded && (
                      <div style={styles.nodeList}>
                        {items.map(({ node, children }) => {
                          const isNodeExpanded = expandedNodes.has(node.spec.id);
                          const hasChildren = children.length > 0;
                          const isEditing = editingNode?.id === node.spec.id;
                          const isHovered = hoveredNode === node.spec.id;
                          return (
                            <div key={node.spec.id}>
                              <div
                                style={{
                                  ...styles.treeNodeItem,
                                  ...(hasChildren ? { fontWeight: 600 } : {}),
                                  ...(isHovered ? styles.treeNodeItemHover : {}),
                                }}
                                draggable={!isEditing}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('application/sysml-element', JSON.stringify({
                                    id: node.spec.id,
                                    kind: node.kind,
                                    name: node.spec.name || node.spec.id
                                  }));
                                  e.dataTransfer.effectAllowed = 'copy';
                                }}
                                onContextMenu={(e) => handleContextMenu(e, node)}
                                onMouseEnter={() => setHoveredNode(node.spec.id)}
                                onMouseLeave={() => setHoveredNode(null)}
                              >
                                <span style={styles.treeToggle}>
                                  {hasChildren ? (
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleNode(node.spec.id);
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      {isNodeExpanded ? (
                                        <ChevronDown size={12} />
                                      ) : (
                                        <ChevronRight size={12} />
                                      )}
                                    </span>
                                  ) : (
                                    <span style={{ width: '12px', display: 'inline-block' }} />
                                  )}
                                </span>
                                {isEditing && editingNode ? (
                                  <input
                                    type="text"
                                    style={styles.renameInput}
                                    value={editingNode.name}
                                    onChange={(e) => setEditingNode({ id: editingNode.id, name: e.target.value })}
                                    onBlur={() => handleRenameSubmit(node.spec.id, editingNode.name)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleRenameSubmit(node.spec.id, editingNode.name);
                                      } else if (e.key === 'Escape') {
                                        setEditingNode(null);
                                      }
                                    }}
                                    autoFocus
                                  />
                                ) : (
                                  <span style={styles.nodeName}>{node.spec.name || node.spec.id}</span>
                                )}
                              </div>

                              {/* Owned parts (children) */}
                              {isNodeExpanded && hasChildren && (
                                <div style={styles.treeChildren}>
                                  {children.map(({ usage, definition }) => {
                                    const isChildEditing = editingNode?.id === usage.spec.id;
                                    const isChildHovered = hoveredNode === usage.spec.id;
                                    return (
                                      <div
                                        key={usage.spec.id}
                                        style={{
                                          ...styles.treeChildItem,
                                          ...(isChildHovered ? styles.treeChildItemHover : {}),
                                        }}
                                        draggable={!isChildEditing}
                                        onDragStart={(e) => {
                                          e.dataTransfer.setData('application/sysml-element', JSON.stringify({
                                            id: usage.spec.id,
                                            kind: usage.kind,
                                            name: usage.spec.name || usage.spec.id
                                          }));
                                          e.dataTransfer.effectAllowed = 'copy';
                                        }}
                                        onContextMenu={(e) => handleContextMenu(e, usage)}
                                        onMouseEnter={() => setHoveredNode(usage.spec.id)}
                                        onMouseLeave={() => setHoveredNode(null)}
                                      >
                                        {isChildEditing && editingNode ? (
                                          <>
                                            <span style={styles.treePartIcon}>🔹</span>
                                            <input
                                              type="text"
                                              style={styles.renameInput}
                                              value={editingNode.name}
                                              onChange={(e) => setEditingNode({ id: editingNode.id, name: e.target.value })}
                                              onBlur={() => handleRenameSubmit(usage.spec.id, editingNode.name)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  handleRenameSubmit(usage.spec.id, editingNode.name);
                                                } else if (e.key === 'Escape') {
                                                  setEditingNode(null);
                                                }
                                              }}
                                              autoFocus
                                            />
                                          </>
                                        ) : (
                                          <>
                                            <span style={styles.treePartIcon}>🔹</span>
                                            <span style={styles.treePartName}>
                                              {usage.spec.name || usage.spec.id}
                                            </span>
                                            <span style={styles.treePartType}>
                                              : {definition.spec.name || definition.spec.id}
                                            </span>
                                            {usage.spec.multiplicity && (
                                              <span style={styles.treePartMultiplicity}>
                                                [{usage.spec.multiplicity}]
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
          )
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.node)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'white',
    borderRight: '1px solid #ddd',
  },
  header: {
    padding: '12px',
    borderBottom: '1px solid #ddd',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '8px',
  },
  viewToggle: {
    display: 'flex',
    gap: '4px',
    marginBottom: '8px',
  },
  viewButton: {
    flex: 1,
    padding: '6px 8px',
    fontSize: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    transition: 'all 0.2s',
  },
  viewButtonActive: {
    backgroundColor: '#007bff',
    color: 'white',
    borderColor: '#0056b3',
  },
  viewButtonText: {
    fontSize: '11px',
    fontWeight: 500,
  },
  searchContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '8px',
    color: '#999',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '6px 8px 6px 28px',
    fontSize: '13px',
    border: '1px solid #ccc',
    borderRadius: '4px',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
  },
  empty: {
    padding: '16px',
    textAlign: 'center',
    color: '#999',
    fontSize: '14px',
  },
  group: {
    marginBottom: '4px',
  },
  groupHeader: {
    padding: '8px',
    cursor: 'pointer',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    userSelect: 'none',
  },
  expandIcon: {
    flexShrink: 0,
    marginRight: '4px',
    color: '#666',
  },
  kindIcon: {
    flexShrink: 0,
    marginRight: '6px',
    color: '#007bff',
  },
  groupTitle: {
    fontSize: '13px',
    fontWeight: 600,
  },
  nodeList: {
    paddingLeft: '24px',
  },
  nodeItem: {
    padding: '6px 8px',
    fontSize: '13px',
    cursor: 'pointer',
    borderRadius: '3px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background-color 0.15s ease',
  },
  nodeItemHover: {
    backgroundColor: '#f5f5f5',
  },
  nodeName: {
    flex: 1,
  },
  nodeStatus: {
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '3px',
    backgroundColor: '#e0e0e0',
    color: '#666',
  },
  treeNodeItem: {
    padding: '6px 8px',
    fontSize: '13px',
    cursor: 'pointer',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'background-color 0.15s ease',
  },
  treeNodeItemHover: {
    backgroundColor: '#f5f5f5',
  },
  treeToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    flexShrink: 0,
  },
  treeChildren: {
    paddingLeft: '20px',
    marginTop: '2px',
  },
  treeChildItem: {
    padding: '4px 8px',
    fontSize: '12px',
    cursor: 'pointer',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: '#555',
    transition: 'background-color 0.15s ease',
  },
  treeChildItemHover: {
    backgroundColor: '#f5f5f5',
  },
  treePartIcon: {
    fontSize: '10px',
  },
  treePartName: {
    fontWeight: 500,
  },
  treePartType: {
    color: '#666',
    fontStyle: 'italic',
  },
  treePartMultiplicity: {
    color: '#888',
    fontSize: '11px',
  },
  renameInput: {
    flex: 1,
    padding: '2px 4px',
    fontSize: '13px',
    border: '1px solid #007bff',
    borderRadius: '2px',
    outline: 'none',
  },
};
