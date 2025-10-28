import { useState, useEffect } from 'react';
import { useSysMLDiagrams, useSysMLViewpoints, useDiagramMutations } from '../../hooks/useSysMLApi';
import { useDiagram } from '../../lib/DiagramContext';

export default function DiagramSelector() {
  const { data: diagrams, isLoading: diagramsLoading } = useSysMLDiagrams();
  const { data: viewpoints, isLoading: viewpointsLoading } = useSysMLViewpoints();
  const { selectedDiagram, selectedDiagramId, setDiagram } = useDiagram();
  const { createDiagram } = useDiagramMutations();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDiagramName, setNewDiagramName] = useState('');
  const [newDiagramViewpoint, setNewDiagramViewpoint] = useState('');

  // Auto-select diagram from localStorage when diagrams load
  useEffect(() => {
    if (diagrams && selectedDiagramId && !selectedDiagram) {
      const savedDiagram = diagrams.find((d) => d.id === selectedDiagramId);
      if (savedDiagram) {
        console.log('[DEBUG] Auto-selecting saved diagram:', savedDiagram.name);
        setDiagram(savedDiagram);
      }
    }
  }, [diagrams, selectedDiagramId, selectedDiagram, setDiagram]);

  const handleCreateDiagram = async () => {
    if (!newDiagramName || !newDiagramViewpoint) return;

    try {
      const diagram = await createDiagram.mutateAsync({
        name: newDiagramName,
        viewpointId: newDiagramViewpoint,
      });

      setDiagram(diagram);
      setShowCreateForm(false);
      setNewDiagramName('');
      setNewDiagramViewpoint('');
    } catch (error) {
      console.error('Failed to create diagram:', error);
    }
  };

  if (diagramsLoading || viewpointsLoading) {
    return <div style={styles.container}>Loading diagrams...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.row}>
        <label style={styles.label}>Diagram:</label>
        <select
          style={styles.select}
          value={selectedDiagram?.id || selectedDiagramId || ''}
          onChange={(e) => {
            const diagramId = e.target.value;
            if (!diagramId) {
              setDiagram(null);
            } else {
              // Set a minimal diagram object - SysMLCanvas will fetch the full data
              const diagram = diagrams?.find((d) => d.id === diagramId);
              if (diagram) {
                setDiagram(diagram);
              }
            }
          }}
        >
          <option value="">Select a diagram...</option>
          {diagrams?.map((diagram) => {
            const viewpoint = viewpoints?.find((v) => v.id === diagram.viewpointId);
            return (
              <option key={diagram.id} value={diagram.id}>
                {diagram.name} ({viewpoint?.name || diagram.viewpointId})
              </option>
            );
          })}
        </select>
        <button style={styles.button} onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? 'Cancel' : 'New Diagram'}
        </button>
      </div>

      {showCreateForm && (
        <div style={styles.createForm}>
          <input
            style={styles.input}
            type="text"
            placeholder="Diagram name"
            value={newDiagramName}
            onChange={(e) => setNewDiagramName(e.target.value)}
          />
          <select
            style={styles.select}
            value={newDiagramViewpoint}
            onChange={(e) => setNewDiagramViewpoint(e.target.value)}
          >
            <option value="">Select viewpoint...</option>
            {viewpoints?.map((vp) => (
              <option key={vp.id} value={vp.id}>
                {vp.name}
              </option>
            ))}
          </select>
          <button
            style={styles.button}
            onClick={handleCreateDiagram}
            disabled={!newDiagramName || !newDiagramViewpoint || createDiagram.isPending}
          >
            {createDiagram.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      {selectedDiagram && (
        <div style={styles.info}>
          {diagrams?.find((d) => d.id === selectedDiagram.id) && (
            <>
              <strong>{selectedDiagram.name}</strong> - {selectedDiagram.elementIds.length} elements
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px',
    backgroundColor: '#f9f9f9',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    fontWeight: 600,
    fontSize: '14px',
    minWidth: '60px',
  },
  select: {
    flex: 1,
    padding: '6px 12px',
    fontSize: '14px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#ccc',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
  button: {
    padding: '6px 12px',
    fontSize: '13px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#007bff',
    borderRadius: '4px',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 600,
  },
  createForm: {
    display: 'flex',
    gap: '8px',
    paddingTop: '8px',
    borderTop: '1px solid #ddd',
  },
  input: {
    flex: 1,
    padding: '6px 12px',
    fontSize: '14px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#ccc',
    borderRadius: '4px',
  },
  info: {
    fontSize: '12px',
    color: '#666',
    paddingTop: '4px',
  },
};
