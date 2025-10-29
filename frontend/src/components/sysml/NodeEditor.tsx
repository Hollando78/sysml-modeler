import React, { useState } from 'react';
import type { SysMLNodeData } from '../../lib/sysml-diagram/types';
import { X, Save, Eye, EyeOff } from 'lucide-react';

interface NodeEditorProps {
  nodeData: SysMLNodeData;
  onClose: () => void;
  onSave: (updates: Partial<SysMLNodeData>) => void;
}

export default function NodeEditor({ nodeData, onClose, onSave }: NodeEditorProps) {
  const [name, setName] = useState(nodeData.name);
  const [stereotype, setStereotype] = useState(nodeData.stereotype || '');
  const [documentation, setDocumentation] = useState(nodeData.documentation || '');
  const [compartmentVisibility, setCompartmentVisibility] = useState<Record<number, boolean>>(() => {
    // Initialize all compartments as visible
    const visibility: Record<number, boolean> = {};
    nodeData.compartments?.forEach((_, index) => {
      visibility[index] = true;
    });
    return visibility;
  });

  const handleSave = () => {
    const updates: Partial<SysMLNodeData> = {
      name,
      stereotype: stereotype.trim() || undefined,
      documentation: documentation.trim() || undefined,
    };

    // Filter compartments based on visibility
    if (nodeData.compartments) {
      updates.compartments = nodeData.compartments.filter((_, index) => compartmentVisibility[index]);
    }

    onSave(updates);
    onClose();
  };

  const toggleCompartmentVisibility = (index: number) => {
    setCompartmentVisibility(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const formatKind = (kind: string) => {
    return kind
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Edit {formatKind(nodeData.kind)}</h2>
            <div style={styles.subtitle}>ID: {nodeData.id}</div>
          </div>
          <button style={styles.closeButton} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Name */}
          <div style={styles.field}>
            <label style={styles.label}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
              placeholder="Element name"
              autoFocus
            />
          </div>

          {/* Stereotype */}
          <div style={styles.field}>
            <label style={styles.label}>
              Stereotype
              <span style={styles.hint}> (optional, e.g., «block», «interface»)</span>
            </label>
            <input
              type="text"
              value={stereotype}
              onChange={(e) => setStereotype(e.target.value)}
              style={styles.input}
              placeholder="«stereotype»"
            />
          </div>

          {/* Documentation */}
          <div style={styles.field}>
            <label style={styles.label}>
              Documentation
              <span style={styles.hint}> (optional)</span>
            </label>
            <textarea
              value={documentation}
              onChange={(e) => setDocumentation(e.target.value)}
              style={styles.textarea}
              placeholder="Description of this element..."
              rows={4}
            />
          </div>

          {/* Compartment Visibility */}
          {nodeData.compartments && nodeData.compartments.length > 0 && (
            <div style={styles.field}>
              <label style={styles.label}>Compartments</label>
              <div style={styles.compartmentList}>
                {nodeData.compartments.map((compartment, index) => (
                  <div key={index} style={styles.compartmentItem}>
                    <button
                      style={styles.toggleButton}
                      onClick={() => toggleCompartmentVisibility(index)}
                      title={compartmentVisibility[index] ? 'Hide compartment' : 'Show compartment'}
                    >
                      {compartmentVisibility[index] ? (
                        <Eye size={16} />
                      ) : (
                        <EyeOff size={16} />
                      )}
                    </button>
                    <div style={styles.compartmentInfo}>
                      <div style={styles.compartmentTitle}>
                        {compartment.title || `Compartment ${index + 1}`}
                      </div>
                      <div style={styles.compartmentItems}>
                        {compartment.items.length} item(s)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Element Info */}
          <div style={styles.infoSection}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Kind:</span>
              <span style={styles.infoValue}>{formatKind(nodeData.kind)}</span>
            </div>
            {nodeData.elementKind && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Type:</span>
                <span style={styles.infoValue}>{nodeData.elementKind}</span>
              </div>
            )}
            {nodeData.baseDefinition && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Base Definition:</span>
                <span style={styles.infoValue}>{nodeData.baseDefinition}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button
            style={styles.saveButton}
            onClick={handleSave}
            disabled={!name.trim()}
          >
            <Save size={16} style={styles.buttonIcon} />
            <span>Save Changes</span>
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
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
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
  content: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
  field: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
  },
  hint: {
    fontWeight: 400,
    color: '#999',
    fontSize: '13px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  compartmentList: {
    border: '1px solid #ddd',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  compartmentItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    borderBottom: '1px solid #f0f0f0',
    gap: '12px',
  },
  toggleButton: {
    padding: '6px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    transition: 'all 0.2s',
  },
  compartmentInfo: {
    flex: 1,
  },
  compartmentTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
  },
  compartmentItems: {
    fontSize: '12px',
    color: '#999',
    marginTop: '2px',
  },
  infoSection: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
  },
  infoRow: {
    display: 'flex',
    marginBottom: '8px',
    fontSize: '13px',
  },
  infoLabel: {
    fontWeight: 500,
    color: '#666',
    minWidth: '140px',
  },
  infoValue: {
    color: '#333',
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
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
  saveButton: {
    padding: '8px 16px',
    fontSize: '14px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  },
  buttonIcon: {
    flexShrink: 0,
  },
};
