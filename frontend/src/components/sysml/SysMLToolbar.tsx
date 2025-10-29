import React, { useState } from 'react';
import { useViewpointTypes } from '../../hooks/useSysMLApi';
import { useDiagram } from '../../lib/DiagramContext';
import { getNodeIcon, getEdgeIcon, uiActionIcons } from '../../lib/sysml-diagram/icon-mappings';
import { GripVertical } from 'lucide-react';

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
  const [isDocked] = useState(true); // TODO: Add drag functionality to undock

  const formatKind = (kind: string) => {
    return kind
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (!selectedDiagram) {
    return (
      <div style={{ ...styles.container, ...(isDocked ? styles.docked : styles.floating) }}>
        <div style={styles.header}>
          {React.createElement(GripVertical, { size: 16, style: styles.gripIcon })}
          <span style={styles.headerTitle}>Tools</span>
        </div>
        <div style={styles.message}>Select a diagram</div>
      </div>
    );
  }

  if (!types || (types.nodeKinds.length === 0 && types.edgeKinds.length === 0)) {
    return (
      <div style={{ ...styles.container, ...(isDocked ? styles.docked : styles.floating) }}>
        <div style={styles.header}>
          {React.createElement(GripVertical, { size: 16, style: styles.gripIcon })}
          <span style={styles.headerTitle}>Tools</span>
        </div>
        <div style={styles.message}>No tools available</div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, ...(isDocked ? styles.docked : styles.floating) }}>
      {/* Header with grip */}
      <div style={styles.header}>
        {React.createElement(GripVertical, { size: 16, style: styles.gripIcon })}
        <span style={styles.headerTitle}>Tools</span>
      </div>

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
          <span>Undo</span>
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
          <span>Redo</span>
        </button>
      </div>

      <div style={styles.separator} />

      {/* Select Button */}
      <div style={styles.section}>
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
      </div>

      <div style={styles.separator} />

      {/* Elements Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Elements</div>
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
              {React.createElement(Icon, { size: 16, style: styles.icon })}
              <span>{formatKind(kind)}</span>
            </button>
          );
        })}
      </div>

      {/* Relationships Section */}
      {types.edgeKinds.length > 0 && (
        <>
          <div style={styles.separator} />
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Relationships</div>
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
                  {React.createElement(Icon, { size: 16, style: styles.icon })}
                  <span>{formatKind(type)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '220px',
    maxWidth: '220px',
    maxHeight: 'calc(100vh - 180px)',
    overflowY: 'auto',
  },
  docked: {
    position: 'absolute',
    left: '12px',
    top: '12px',
    zIndex: 100,
  },
  floating: {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1000,
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#f9f9f9',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'grab',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px',
  },
  gripIcon: {
    color: '#999',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#333',
    flex: 1,
  },
  message: {
    padding: '12px',
    color: '#666',
    fontSize: '13px',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '4px 8px',
    marginBottom: '4px',
  },
  separator: {
    height: '1px',
    backgroundColor: '#e0e0e0',
    margin: '0 8px',
  },
  button: {
    padding: '8px 12px',
    fontSize: '13px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    textAlign: 'left',
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
