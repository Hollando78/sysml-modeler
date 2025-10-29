import React from 'react';
import { useViewpointTypes } from '../../hooks/useSysMLApi';
import { useDiagram } from '../../lib/DiagramContext';
import { getNodeIcon, getEdgeIcon, uiActionIcons } from '../../lib/sysml-diagram/icon-mappings';

export type ToolbarMode = 'select' | 'create-node' | 'create-relationship';

interface SysMLToolbarProps {
  onModeChange: (mode: ToolbarMode, data?: { kind?: string; type?: string }) => void;
  currentMode: ToolbarMode;
  currentData?: { kind?: string; type?: string };
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export default function SysMLToolbar({ onModeChange, currentMode, currentData, onUndo, onRedo, canUndo, canRedo }: SysMLToolbarProps) {
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
      {/* Undo/Redo Section */}
      <div style={styles.section}>
        <button
          style={{
            ...styles.button,
            ...((!canUndo) ? styles.buttonDisabled : {}),
          }}
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z / Cmd+Z)"
        >
          {React.createElement(uiActionIcons.undo, { size: 16, style: styles.icon })}
        </button>
        <button
          style={{
            ...styles.button,
            ...((!canRedo) ? styles.buttonDisabled : {}),
          }}
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y / Cmd+Shift+Z)"
        >
          {React.createElement(uiActionIcons.redo, { size: 16, style: styles.icon })}
        </button>
      </div>

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
            {React.createElement(uiActionIcons.select, { size: 16, style: styles.icon })}
            <span>Select</span>
          </button>
          {types.nodeKinds.map((kind) => {
            const Icon = getNodeIcon(kind);
            const isActive = currentMode === 'create-node' && currentData?.kind === kind;
            return (
              <button
                key={kind}
                style={{
                  ...styles.button,
                  ...(isActive ? styles.buttonActive : {}),
                }}
                onClick={() => onModeChange('create-node', { kind })}
                title={`Create ${formatKind(kind)}`}
              >
                <Icon size={16} style={styles.icon} />
                <span>{formatKind(kind)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {types.edgeKinds.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Relationships</div>
          <div style={styles.buttonGroup}>
            {types.edgeKinds.map((type) => {
              const Icon = getEdgeIcon(type);
              const isActive = currentMode === 'create-relationship' && currentData?.type === type;
              return (
                <button
                  key={type}
                  style={{
                    ...styles.button,
                    ...(isActive ? styles.buttonActive : {}),
                  }}
                  onClick={() => onModeChange('create-relationship', { type })}
                  title={`Create ${formatKind(type)} relationship`}
                >
                  <Icon size={16} style={styles.icon} />
                  <span>{formatKind(type)}</span>
                </button>
              );
            })}
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
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  icon: {
    flexShrink: 0,
  },
  buttonActive: {
    backgroundColor: '#007bff',
    color: 'white',
    borderColor: '#0056b3',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
