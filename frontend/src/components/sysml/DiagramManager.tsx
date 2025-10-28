import { useState } from 'react';
import { useSysMLModel, useDiagramMutations } from '../../hooks/useSysMLApi';
import { useDiagram } from '../../lib/DiagramContext';

interface DiagramManagerProps {
  onClose: () => void;
}

export default function DiagramManager({ onClose }: DiagramManagerProps) {
  const { selectedDiagram } = useDiagram();
  const { data: model } = useSysMLModel(selectedDiagram?.viewpointId);
  const { addElementsToDiagram, removeElementFromDiagram } = useDiagramMutations();
  const [selectedElements, setSelectedElements] = useState<string[]>([]);

  if (!selectedDiagram) {
    return null;
  }

  const handleAddElements = async () => {
    if (selectedElements.length === 0) return;

    try {
      await addElementsToDiagram.mutateAsync({
        diagramId: selectedDiagram.id,
        elementIds: selectedElements,
      });
      setSelectedElements([]);
    } catch (error) {
      console.error('Failed to add elements:', error);
    }
  };

  const handleRemoveElement = async (elementId: string) => {
    try {
      await removeElementFromDiagram.mutateAsync({
        diagramId: selectedDiagram.id,
        elementId,
      });
    } catch (error) {
      console.error('Failed to remove element:', error);
    }
  };

  const toggleElementSelection = (elementId: string) => {
    setSelectedElements((prev) =>
      prev.includes(elementId) ? prev.filter((id) => id !== elementId) : [...prev, elementId]
    );
  };

  // Get elements not in diagram
  const availableElements =
    model?.nodes.filter((node) => !selectedDiagram.elementIds.includes(node.spec.id)) || [];

  // Get elements in diagram
  const diagramElements =
    model?.nodes.filter((node) => selectedDiagram.elementIds.includes(node.spec.id)) || [];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Manage Diagram: {selectedDiagram.name}</h2>
          <button style={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div style={styles.content}>
          {/* Elements in diagram */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Elements in Diagram ({diagramElements.length})</h3>
            <div style={styles.list}>
              {diagramElements.length === 0 ? (
                <div style={styles.empty}>No elements in diagram yet</div>
              ) : (
                diagramElements.map((node) => (
                  <div key={node.spec.id} style={styles.item}>
                    <div>
                      <strong>{node.spec.name}</strong>
                      <span style={styles.kind}> ({node.kind})</span>
                    </div>
                    <button
                      style={styles.removeButton}
                      onClick={() => handleRemoveElement(node.spec.id)}
                      disabled={removeElementFromDiagram.isPending}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Available elements */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Available Elements ({availableElements.length})</h3>
            <div style={styles.list}>
              {availableElements.length === 0 ? (
                <div style={styles.empty}>All elements are in the diagram</div>
              ) : (
                availableElements.map((node) => (
                  <div key={node.spec.id} style={styles.item}>
                    <label style={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={selectedElements.includes(node.spec.id)}
                        onChange={() => toggleElementSelection(node.spec.id)}
                      />
                      <strong>{node.spec.name}</strong>
                      <span style={styles.kind}> ({node.kind})</span>
                    </label>
                  </div>
                ))
              )}
            </div>
            {availableElements.length > 0 && (
              <button
                style={styles.addButton}
                onClick={handleAddElements}
                disabled={selectedElements.length === 0 || addElementsToDiagram.isPending}
              >
                {addElementsToDiagram.isPending
                  ? 'Adding...'
                  : `Add ${selectedElements.length} element(s)`}
              </button>
            )}
          </div>
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
    width: '90%',
    maxWidth: '800px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #ddd',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '32px',
    cursor: 'pointer',
    color: '#666',
    lineHeight: 1,
  },
  content: {
    padding: '24px',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#333',
  },
  list: {
    border: '1px solid #ddd',
    borderRadius: '4px',
    maxHeight: '200px',
    overflow: 'auto',
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid #f0f0f0',
  },
  kind: {
    color: '#666',
    fontSize: '13px',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    flex: 1,
  },
  removeButton: {
    padding: '4px 12px',
    fontSize: '13px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#dc3545',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#dc3545',
    cursor: 'pointer',
  },
  addButton: {
    padding: '8px 16px',
    fontSize: '14px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#007bff',
    borderRadius: '4px',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 600,
    alignSelf: 'flex-start',
  },
  empty: {
    padding: '24px',
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
  },
};
