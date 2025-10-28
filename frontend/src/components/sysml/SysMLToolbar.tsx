import { useViewpointTypes } from '../../hooks/useSysMLApi';
import { useDiagram } from '../../lib/DiagramContext';

export type ToolbarMode = 'select' | 'create-node' | 'create-relationship';

interface SysMLToolbarProps {
  onModeChange: (mode: ToolbarMode, data?: { kind?: string; type?: string }) => void;
  currentMode: ToolbarMode;
}

export default function SysMLToolbar({ onModeChange, currentMode }: SysMLToolbarProps) {
  const { selectedDiagram } = useDiagram();
  const { data: types } = useViewpointTypes(selectedDiagram?.viewpointId);

  const formatKind = (kind: string) => {
    return kind
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (!selectedDiagram) {
    return (
      <div style={styles.container}>
        <div style={styles.message}>Select a diagram to see available tools</div>
      </div>
    );
  }

  if (!types || (types.nodeKinds.length === 0 && types.edgeKinds.length === 0)) {
    return (
      <div style={styles.container}>
        <div style={styles.message}>No tools available for this viewpoint</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Elements</div>
        <div style={styles.buttonGroup}>
          <button
            style={{
              ...styles.button,
              ...(currentMode === 'select' ? styles.buttonActive : {}),
            }}
            onClick={() => onModeChange('select')}
            title="Select and move elements"
          >
            Select
          </button>
          {types.nodeKinds.map((kind) => (
            <button
              key={kind}
              style={{
                ...styles.button,
                ...(currentMode === 'create-node' ? styles.buttonActive : {}),
              }}
              onClick={() => onModeChange('create-node', { kind })}
              title={`Create ${formatKind(kind)}`}
            >
              {formatKind(kind)}
            </button>
          ))}
        </div>
      </div>

      {types.edgeKinds.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Relationships</div>
          <div style={styles.buttonGroup}>
            {types.edgeKinds.map((type) => (
              <button
                key={type}
                style={{
                  ...styles.button,
                  ...(currentMode === 'create-relationship' ? styles.buttonActive : {}),
                }}
                onClick={() => onModeChange('create-relationship', { type })}
                title={`Create ${formatKind(type)} relationship`}
              >
                {formatKind(type)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px',
    borderBottom: '1px solid #ddd',
    backgroundColor: '#f9f9f9',
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
  },
  message: {
    color: '#666',
    fontSize: '14px',
    fontStyle: 'italic',
  },
  section: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#333',
    marginRight: '4px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  button: {
    padding: '6px 12px',
    fontSize: '13px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#ccc',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  buttonActive: {
    backgroundColor: '#007bff',
    color: 'white',
    borderColor: '#0056b3',
  },
};
