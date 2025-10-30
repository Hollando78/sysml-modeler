import React, { useMemo, useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Search, List, Network, Scissors, Copy, Clipboard, Edit, Type, Trash2, LogIn, Zap, LogOut } from 'lucide-react';
import { useSysMLModel, useSysMLMutations } from '../../hooks/useSysMLApi';
import { useDiagram } from '../../lib/DiagramContext';
import { getNodeIcon } from '../../lib/sysml-diagram/icon-mappings';
import ContextMenu, { type ContextMenuItem } from '../common/ContextMenu';
import ConfirmModal from '../common/ConfirmModal';
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ node: SysMLNodeSpec } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close context menu when clicking anywhere outside (including on canvas)
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickAnywhere = (e: MouseEvent) => {
      // Check if the click is inside the context menu itself
      const target = e.target as HTMLElement;
      const isContextMenuClick = target.closest('[data-context-menu]');

      if (!isContextMenuClick) {
        setContextMenu(null);
      }
    };

    // Add listener with a small delay to prevent immediate closing
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickAnywhere, true);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickAnywhere, true);
    };
  }, [contextMenu]);

  // Build a map of action definitions to state machines that reference them
  const actionToStateMachinesMap = useMemo(() => {
    if (!model) return new Map<string, string[]>();

    const map = new Map<string, string[]>();

    // Helper to collect action IDs from a state
    const collectActionIds = (state: SysMLNodeSpec): string[] => {
      const actionIds: string[] = [];
      const actions = [
        state.spec.entryAction,
        state.spec.doActivity,
        state.spec.exitAction,
        (state as any).entryAction,
        (state as any).doActivity,
        (state as any).exitAction,
      ];

      actions.forEach((action) => {
        if (action && typeof action === 'object' && action.actionId) {
          actionIds.push(action.actionId);
        }
      });

      return actionIds;
    };

    // Find all state machines
    const stateMachines = model.nodes.filter(n => n.kind === 'state-machine');

    stateMachines.forEach(sm => {
      // Find all states in this state machine via composition relationships
      const stateIds = new Set<string>();
      const findStates = (ownerId: string, visited = new Set<string>()) => {
        if (visited.has(ownerId)) return;
        visited.add(ownerId);

        model.relationships
          .filter(rel => rel.source === ownerId && (rel.type === 'composition' || rel.type === 'aggregation'))
          .forEach(rel => {
            const child = model.nodes.find(n => n.spec.id === rel.target);
            if (child && (child.kind === 'state-usage' || child.kind === 'state-definition')) {
              stateIds.add(child.spec.id);
              // Check for action references in this state
              const actionIds = collectActionIds(child);
              actionIds.forEach(actionId => {
                if (!map.has(actionId)) {
                  map.set(actionId, []);
                }
                const machines = map.get(actionId)!;
                if (!machines.includes(sm.spec.name || sm.spec.id)) {
                  machines.push(sm.spec.name || sm.spec.id);
                }
              });
              // Recursively check children
              findStates(child.spec.id, visited);
            }
          });
      };

      findStates(sm.spec.id);
    });

    return map;
  }, [model]);

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

    // Build a map of owned parts/states for each owner (can be definition, part-usage, or state-machine)
    const ownershipMap: Record<string, Array<{ usage: SysMLNodeSpec; definition: SysMLNodeSpec }>> = {};

    // Find all composition/aggregation relationships
    model.relationships.forEach((rel) => {
      if (rel.type === 'composition' || rel.type === 'aggregation') {
        // rel.source is the owner (definition, part-usage, or state-machine)
        // rel.target is the owned part-usage or state-usage
        const usageNode = model.nodes.find((n) => n.spec.id === rel.target);
        if (!usageNode) return;

        // Find the definition relationship from usage to its definition
        const defRel = model.relationships.find(
          (r) => r.type === 'definition' && r.source === usageNode.spec.id
        );
        if (!defRel) return;

        const definition = model.nodes.find((n) => n.spec.id === defRel.target);
        if (!definition) return;

        if (!ownershipMap[rel.source]) {
          ownershipMap[rel.source] = [];
        }
        ownershipMap[rel.source].push({ usage: usageNode, definition });
      }
    });

    // Recursive function to get children for any node (definition, part-usage, or state-machine)
    const getChildren = (nodeId: string): Array<{ usage: SysMLNodeSpec; definition: SysMLNodeSpec; children: any[]; actions?: any[] }> => {
      const directChildren = ownershipMap[nodeId] || [];
      return directChildren.map(({ usage, definition }) => {
        // Extract actions if this is a state-usage or state-definition
        let actions: any[] | undefined;
        if (usage.kind === 'state-usage' || usage.kind === 'state-definition') {
          actions = [];
          if (usage.spec.entryAction) {
            actions.push({ type: 'entry', value: usage.spec.entryAction });
          }
          if (usage.spec.doActivity) {
            actions.push({ type: 'do', value: usage.spec.doActivity });
          }
          if (usage.spec.exitAction) {
            actions.push({ type: 'exit', value: usage.spec.exitAction });
          }
        }

        return {
          usage,
          definition,
          children: getChildren(usage.spec.id), // Recursively get children of the usage
          actions
        };
      });
    };

    // Collect all action IDs referenced by states in a state machine
    const getReferencedActionIds = (nodeId: string, visited = new Set<string>()): Set<string> => {
      if (visited.has(nodeId)) return new Set();
      visited.add(nodeId);

      const actionIds = new Set<string>();
      const children = ownershipMap[nodeId] || [];

      children.forEach(({ usage }) => {
        // Check if this is a state with action references
        if (usage.kind === 'state-usage' || usage.kind === 'state-definition') {
          // Check both spec and root level for actions (they might be in either location)
          const actions = [
            usage.spec.entryAction,
            usage.spec.doActivity,
            usage.spec.exitAction,
            (usage as any).entryAction,
            (usage as any).doActivity,
            (usage as any).exitAction,
          ];

          actions.forEach((action) => {
            if (action && typeof action === 'object' && action.actionId) {
              actionIds.add(action.actionId);
            }
          });
        }

        // Recursively check children
        const childActionIds = getReferencedActionIds(usage.spec.id, visited);
        childActionIds.forEach(id => actionIds.add(id));
      });

      return actionIds;
    };

    // Group definitions by kind
    const tree: Record<string, Array<{ node: SysMLNodeSpec; children: any[]; actions?: any[]; actionDefinitions?: SysMLNodeSpec[] }>> = {};

    model.nodes.forEach((node) => {
      // Show definition types and state-machines at the root level
      if (node.kind.endsWith('-definition') || node.kind === 'state-machine') {
        if (!tree[node.kind]) {
          tree[node.kind] = [];
        }

        // Extract actions if this is a state-definition
        let actions: any[] | undefined;
        if (node.kind === 'state-definition') {
          actions = [];
          if (node.spec.entryAction) {
            actions.push({ type: 'entry', value: node.spec.entryAction });
          }
          if (node.spec.doActivity) {
            actions.push({ type: 'do', value: node.spec.doActivity });
          }
          if (node.spec.exitAction) {
            actions.push({ type: 'exit', value: node.spec.exitAction });
          }
        }

        // For state machines, collect referenced action definitions
        let actionDefinitions: SysMLNodeSpec[] | undefined;
        if (node.kind === 'state-machine') {
          const referencedIds = getReferencedActionIds(node.spec.id);
          if (referencedIds.size > 0) {
            actionDefinitions = model.nodes.filter(n =>
              (n.kind === 'action-definition' || n.kind === 'action-usage') &&
              referencedIds.has(n.spec.id)
            );
          }
        }

        tree[node.kind].push({
          node,
          children: getChildren(node.spec.id),
          actions,
          actionDefinitions
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
    // Close any existing context menu first
    setContextMenu(null);
    // Use setTimeout to allow the click event to finish propagating before opening
    setTimeout(() => {
      setContextMenu({ x: e.clientX, y: e.clientY, node });
    }, 0);
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

  const handleDelete = (node: SysMLNodeSpec) => {
    setDeleteConfirm({ node });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    const node = deleteConfirm.node;
    setDeleteConfirm(null);

    try {
      await mutations.deleteElement.mutateAsync(node.spec.id);
      // Clear clipboard if deleted node was in it
      if (clipboard?.node.spec.id === node.spec.id) {
        setClipboard(null);
      }
    } catch (error) {
      console.error('Delete error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      setErrorMessage(`Failed to delete element: ${errorMsg}\n\nPlease check your network connection and try again.`);
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
                                  {/* Show state machine references for action definitions */}
                                  {(node.kind === 'action-definition' || node.kind === 'action-usage') &&
                                   actionToStateMachinesMap.has(node.spec.id) && (
                                    <span style={styles.actionStateMachineRef}>
                                      ← {actionToStateMachinesMap.get(node.spec.id)!.join(', ')}
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
                        {items.map(({ node, children, actions, actionDefinitions }) => {
                          const isNodeExpanded = expandedNodes.has(node.spec.id);
                          const hasChildren = children.length > 0;
                          const hasActions = actions && actions.length > 0;
                          const hasActionDefinitions = actionDefinitions && actionDefinitions.length > 0;
                          const hasExpandable = hasChildren || hasActions || hasActionDefinitions;
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
                                  {hasExpandable ? (
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

                              {/* Actions, action definitions, and children when expanded */}
                              {isNodeExpanded && (hasActions || hasActionDefinitions || hasChildren) && (
                                <>
                                  {/* Render root-level node actions if this is a state-definition */}
                                  {hasActions && (
                                    <div style={styles.treeChildren}>
                                      {actions.map((action: any, idx: number) => {
                                        const isRef = typeof action.value === 'object' && action.value.actionName;
                                        const displayValue = isRef ? action.value.actionName : action.value;
                                        const ActionIcon = action.type === 'entry' ? LogIn : action.type === 'do' ? Zap : LogOut;

                                        return (
                                          <div
                                            key={`${node.spec.id}-action-${idx}`}
                                            style={styles.treeActionItem}
                                            title={isRef ? `References action: ${displayValue}` : `Text action: ${displayValue}`}
                                          >
                                            <ActionIcon size={14} style={styles.actionIcon} />
                                            <span style={styles.actionType}>{action.type}:</span>
                                            {isRef && <span style={styles.actionReference}>→</span>}
                                            <span style={isRef ? styles.actionNameRef : styles.actionNameText}>
                                              {displayValue}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Render action definitions referenced by this state machine */}
                                  {hasActionDefinitions && (
                                    <div style={styles.treeChildren}>
                                      {actionDefinitions.map((actionNode) => {
                                        const actionIsEditing = editingNode?.id === actionNode.spec.id;
                                        const actionIsHovered = hoveredNode === actionNode.spec.id;
                                        const ActionNodeIcon = getNodeIcon(actionNode.kind);

                                        return (
                                          <div
                                            key={actionNode.spec.id}
                                            style={{
                                              ...styles.treeActionDefinitionItem,
                                              ...(actionIsHovered ? styles.treeActionDefinitionItemHover : {}),
                                            }}
                                            draggable={!actionIsEditing}
                                            onDragStart={(e) => {
                                              e.dataTransfer.setData('application/sysml-element', JSON.stringify({
                                                id: actionNode.spec.id,
                                                kind: actionNode.kind,
                                                name: actionNode.spec.name || actionNode.spec.id
                                              }));
                                              e.dataTransfer.effectAllowed = 'copy';
                                            }}
                                            onContextMenu={(e) => handleContextMenu(e, actionNode)}
                                            onMouseEnter={() => setHoveredNode(actionNode.spec.id)}
                                            onMouseLeave={() => setHoveredNode(null)}
                                          >
                                            <ActionNodeIcon size={14} style={styles.actionDefinitionIcon} />
                                            {actionIsEditing && editingNode ? (
                                              <input
                                                type="text"
                                                style={styles.renameInput}
                                                value={editingNode.name}
                                                onChange={(e) => setEditingNode({ id: editingNode.id, name: e.target.value })}
                                                onBlur={() => handleRenameSubmit(actionNode.spec.id, editingNode.name)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    handleRenameSubmit(actionNode.spec.id, editingNode.name);
                                                  } else if (e.key === 'Escape') {
                                                    setEditingNode(null);
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <span style={styles.actionDefinitionName}>
                                                {actionNode.spec.name || actionNode.spec.id}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Owned parts/states (children) - recursively rendered */}
                                  {hasChildren && (
                                <div style={styles.treeChildren}>
                                  {children.map(({ usage, definition, children: nestedChildren, actions }) => {
                                    const renderPartUsage = (
                                      childUsage: typeof usage,
                                      childDef: typeof definition,
                                      childNested: typeof nestedChildren,
                                      childActions: typeof actions,
                                      depth: number = 0
                                    ): React.ReactNode => {
                                      const childHasNested = childNested && childNested.length > 0;
                                      const childHasActions = childActions && childActions.length > 0;
                                      const childHasExpandable = childHasNested || childHasActions;
                                      const childIsExpanded = expandedNodes.has(childUsage.spec.id);
                                      const childIsEditing = editingNode?.id === childUsage.spec.id;
                                      const childIsHovered = hoveredNode === childUsage.spec.id;

                                      return (
                                        <div key={childUsage.spec.id}>
                                          <div
                                            style={{
                                              ...styles.treeChildItem,
                                              paddingLeft: `${depth * 16}px`,
                                              ...(childIsHovered ? styles.treeChildItemHover : {}),
                                            }}
                                            draggable={!childIsEditing}
                                            onDragStart={(e) => {
                                              e.dataTransfer.setData('application/sysml-element', JSON.stringify({
                                                id: childUsage.spec.id,
                                                kind: childUsage.kind,
                                                name: childUsage.spec.name || childUsage.spec.id
                                              }));
                                              e.dataTransfer.effectAllowed = 'copy';
                                            }}
                                            onContextMenu={(e) => handleContextMenu(e, childUsage)}
                                            onMouseEnter={() => setHoveredNode(childUsage.spec.id)}
                                            onMouseLeave={() => setHoveredNode(null)}
                                          >
                                            {childHasExpandable ? (
                                              <span
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleNode(childUsage.spec.id);
                                                }}
                                                style={{ cursor: 'pointer', marginRight: '4px' }}
                                              >
                                                {childIsExpanded ? (
                                                  <ChevronDown size={12} />
                                                ) : (
                                                  <ChevronRight size={12} />
                                                )}
                                              </span>
                                            ) : (
                                              <span style={{ width: '12px', display: 'inline-block', marginRight: '4px' }} />
                                            )}
                                            {childIsEditing && editingNode ? (
                                              <input
                                                type="text"
                                                style={styles.renameInput}
                                                value={editingNode.name}
                                                onChange={(e) => setEditingNode({ id: editingNode.id, name: e.target.value })}
                                                onBlur={() => handleRenameSubmit(childUsage.spec.id, editingNode.name)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    handleRenameSubmit(childUsage.spec.id, editingNode.name);
                                                  } else if (e.key === 'Escape') {
                                                    setEditingNode(null);
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <>
                                                <span style={styles.treePartName}>
                                                  {childUsage.spec.name || childUsage.spec.id}
                                                </span>
                                                <span style={styles.treePartType}>
                                                  : {childDef.spec.name || childDef.spec.id}
                                                </span>
                                                {childUsage.spec.multiplicity && (
                                                  <span style={styles.treePartMultiplicity}>
                                                    [{childUsage.spec.multiplicity}]
                                                  </span>
                                                )}
                                              </>
                                            )}
                                          </div>

                                          {/* Render actions and nested children when expanded */}
                                          {childIsExpanded && (childHasActions || childHasNested) && (
                                            <>
                                              {/* Render actions if this is a state */}
                                              {childHasActions && (
                                                <div style={styles.treeChildren}>
                                                  {childActions.map((action: any, idx: number) => {
                                                    const isRef = typeof action.value === 'object' && action.value.actionName;
                                                    const displayValue = isRef ? action.value.actionName : action.value;
                                                    const ActionIcon = action.type === 'entry' ? LogIn : action.type === 'do' ? Zap : LogOut;

                                                    return (
                                                      <div
                                                        key={`${childUsage.spec.id}-action-${idx}`}
                                                        style={{
                                                          ...styles.treeActionItem,
                                                          paddingLeft: `${(depth + 1) * 16}px`,
                                                        }}
                                                        title={isRef ? `References action: ${displayValue}` : `Text action: ${displayValue}`}
                                                      >
                                                        <ActionIcon size={14} style={styles.actionIcon} />
                                                        <span style={styles.actionType}>{action.type}:</span>
                                                        {isRef && <span style={styles.actionReference}>→</span>}
                                                        <span style={isRef ? styles.actionNameRef : styles.actionNameText}>
                                                          {displayValue}
                                                        </span>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}

                                              {/* Render nested children (recursive) */}
                                              {childHasNested && (
                                                <div style={styles.treeChildren}>
                                                  {childNested.map((nested: any) =>
                                                    renderPartUsage(nested.usage, nested.definition, nested.children, nested.actions, depth + 1)
                                                  )}
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      );
                                    };

                                    return renderPartUsage(usage, definition, nestedChildren, actions, 0);
                                  })}
                                </div>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <ConfirmModal
          title="Delete Element"
          message={`Are you sure you want to delete "${deleteConfirm.node.spec.name || deleteConfirm.node.spec.id}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Error Modal */}
      {errorMessage && (
        <ConfirmModal
          title="Error"
          message={errorMessage}
          confirmLabel="OK"
          cancelLabel="Close"
          variant="warning"
          onConfirm={() => setErrorMessage(null)}
          onCancel={() => setErrorMessage(null)}
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
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#ddd',
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
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#ccc',
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
  actionStateMachineRef: {
    fontSize: '11px',
    color: '#007bff',
    fontStyle: 'italic',
    marginLeft: '8px',
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
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  treeChildItemHover: {
    backgroundColor: '#f5f5f5',
  },
  treePartName: {
    fontWeight: 500,
    flexShrink: 0,
  },
  treePartType: {
    color: '#666',
    fontStyle: 'italic',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flexShrink: 1,
  },
  treePartMultiplicity: {
    color: '#888',
    fontSize: '11px',
    flexShrink: 0,
  },
  renameInput: {
    flex: 1,
    padding: '2px 4px',
    fontSize: '13px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#007bff',
    borderRadius: '2px',
    outline: 'none',
  },
  treeActionItem: {
    padding: '6px 8px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#666',
    backgroundColor: '#fafafa',
    borderLeft: '2px solid #e0e0e0',
    marginLeft: '8px',
  },
  actionIcon: {
    flexShrink: 0,
    color: '#666',
  },
  actionType: {
    fontWeight: 500,
    color: '#555',
    flexShrink: 0,
  },
  actionReference: {
    color: '#007bff',
    fontWeight: 600,
    flexShrink: 0,
  },
  actionNameRef: {
    color: '#007bff',
    fontWeight: 500,
  },
  actionNameText: {
    color: '#666',
    fontStyle: 'italic',
  },
  treeActionDefinitionItem: {
    padding: '6px 8px',
    fontSize: '12px',
    cursor: 'pointer',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#333',
    backgroundColor: '#f0f8ff',
    borderLeft: '2px solid #007bff',
    marginLeft: '8px',
    transition: 'background-color 0.15s ease',
  },
  treeActionDefinitionItemHover: {
    backgroundColor: '#e6f2ff',
  },
  actionDefinitionIcon: {
    flexShrink: 0,
    color: '#007bff',
  },
  actionDefinitionName: {
    fontWeight: 500,
    color: '#333',
  },
};
