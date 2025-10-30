import React, { useState, useMemo } from 'react';
import { X, Search, FileCode, Play } from 'lucide-react';
import type { SysMLActionReference } from '../../types';

interface ActionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (actionRef: SysMLActionReference) => void;
  availableActions: Array<{
    id: string;
    name: string;
    kind: 'action-definition' | 'action-usage';
    definition?: string; // For action-usages, shows their base definition
  }>;
  currentSelection?: SysMLActionReference;
}

export function ActionPicker({
  isOpen,
  onClose,
  onSelect,
  availableActions,
  currentSelection,
}: ActionPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'action-definition' | 'action-usage'>('all');

  const filteredActions = useMemo(() => {
    return availableActions.filter((action) => {
      const matchesSearch = action.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || action.kind === filterType;
      return matchesSearch && matchesType;
    });
  }, [availableActions, searchTerm, filterType]);

  const handleSelect = (action: typeof availableActions[0]) => {
    onSelect({
      actionId: action.id,
      actionType: action.kind,
      actionName: action.name,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Select Action</h2>
            <p style={styles.subtitle}>Choose an action definition or usage to reference</p>
          </div>
          <button style={styles.closeButton} onClick={onClose} title="Close">
            {React.createElement(X, { size: 20 })}
          </button>
        </div>

        {/* Search and Filter */}
        <div style={styles.controls}>
          <div style={styles.searchBox}>
            {React.createElement(Search, { size: 16, style: { color: '#999' } })}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search actions..."
              style={styles.searchInput}
              autoFocus
            />
          </div>
          <div style={styles.filterButtons}>
            <button
              style={{
                ...styles.filterButton,
                ...(filterType === 'all' ? styles.filterButtonActive : {}),
              }}
              onClick={() => setFilterType('all')}
            >
              All
            </button>
            <button
              style={{
                ...styles.filterButton,
                ...(filterType === 'action-definition' ? styles.filterButtonActive : {}),
              }}
              onClick={() => setFilterType('action-definition')}
            >
              Definitions
            </button>
            <button
              style={{
                ...styles.filterButton,
                ...(filterType === 'action-usage' ? styles.filterButtonActive : {}),
              }}
              onClick={() => setFilterType('action-usage')}
            >
              Usages
            </button>
          </div>
        </div>

        {/* Action List */}
        <div style={styles.actionList}>
          {filteredActions.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyText}>
                {searchTerm ? 'No actions match your search' : 'No actions available'}
              </p>
              <p style={styles.emptyHint}>
                Create action definitions or usages in the Behavior & Control viewpoint
              </p>
            </div>
          ) : (
            filteredActions.map((action) => (
              <div
                key={action.id}
                style={{
                  ...styles.actionItem,
                  ...(currentSelection?.actionId === action.id ? styles.actionItemSelected : {}),
                }}
                onClick={() => handleSelect(action)}
              >
                <div style={styles.actionIcon}>
                  {action.kind === 'action-definition'
                    ? React.createElement(FileCode, { size: 20 })
                    : React.createElement(Play, { size: 20 })}
                </div>
                <div style={styles.actionInfo}>
                  <div style={styles.actionName}>{action.name}</div>
                  <div style={styles.actionMeta}>
                    <span style={styles.actionKind}>
                      {action.kind === 'action-definition' ? 'Definition' : 'Usage'}
                    </span>
                    {action.kind === 'action-usage' && action.definition && (
                      <>
                        <span style={styles.dot}>•</span>
                        <span style={styles.actionDefinition}>: {action.definition}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000, // Higher than NodeEditor
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#333',
  },
  subtitle: {
    marginTop: '4px',
    marginBottom: 0,
    fontSize: '13px',
    color: '#666',
  },
  closeButton: {
    padding: '4px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#666',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
  },
  controls: {
    padding: '16px 24px',
    borderBottom: '1px solid #f0f0f0',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    marginBottom: '12px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
  },
  filterButtons: {
    display: 'flex',
    gap: '8px',
  },
  filterButton: {
    padding: '6px 12px',
    fontSize: '13px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: '#666',
  },
  filterButtonActive: {
    backgroundColor: '#007bff',
    color: 'white',
    borderColor: '#007bff',
  },
  actionList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
  },
  actionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    margin: '4px 0',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: 'white',
  },
  actionItemSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  actionIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: '#f5f5f5',
    color: '#007bff',
  },
  actionInfo: {
    flex: 1,
  },
  actionName: {
    fontSize: '15px',
    fontWeight: 500,
    color: '#333',
    marginBottom: '4px',
  },
  actionMeta: {
    fontSize: '13px',
    color: '#999',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  actionKind: {
    fontSize: '12px',
    padding: '2px 6px',
    borderRadius: '3px',
    backgroundColor: '#f0f0f0',
    color: '#666',
  },
  dot: {
    color: '#ccc',
  },
  actionDefinition: {
    color: '#666',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  emptyText: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '8px',
  },
  emptyHint: {
    fontSize: '13px',
    color: '#999',
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    padding: '8px 16px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
