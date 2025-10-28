import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Search } from 'lucide-react';
import { useSysMLModel } from '../../hooks/useSysMLApi';
import { useDiagram } from '../../lib/DiagramContext';
import { getNodeIcon } from '../../lib/sysml-diagram/icon-mappings';
import type { SysMLNodeSpec } from '../../types';

export default function ModelBrowser() {
  const { selectedDiagram } = useDiagram();
  const { data: model, isLoading, error } = useSysMLModel(selectedDiagram?.viewpointId);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set());

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

  const toggleKind = (kind: string) => {
    const newExpanded = new Set(expandedKinds);
    if (newExpanded.has(kind)) {
      newExpanded.delete(kind);
    } else {
      newExpanded.add(kind);
    }
    setExpandedKinds(newExpanded);
  };

  const formatKind = (kind: string) => {
    return kind
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
        {kindCount === 0 ? (
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
                      {nodes.map((node) => (
                        <div
                          key={node.spec.id}
                          style={styles.nodeItem}
                          title={node.spec.description || node.spec.documentation}
                        >
                          <span style={styles.nodeName}>{node.spec.name || node.spec.id}</span>
                          {node.spec.status && (
                            <span style={styles.nodeStatus}>{node.spec.status}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>
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
};
