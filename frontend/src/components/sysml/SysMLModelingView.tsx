import { useState, useRef, useCallback } from 'react';
import DiagramSelector from './DiagramSelector';
import DiagramManager from './DiagramManager';
import ModelBrowser from './ModelBrowser';
import SysMLToolbar, { type ToolbarMode } from './SysMLToolbar';
import SysMLCanvas from './SysMLCanvas';
import { useDiagram } from '../../lib/DiagramContext';

export default function SysMLModelingView() {
  const [toolbarMode, setToolbarMode] = useState<ToolbarMode>('select');
  const [toolbarData, setToolbarData] = useState<{ kind?: string; type?: string }>();
  const [showDiagramManager, setShowDiagramManager] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const { selectedDiagram } = useDiagram();

  // Refs to store undo/redo functions from canvas
  const undoRef = useRef<(() => void) | null>(null);
  const redoRef = useRef<(() => void) | null>(null);

  const handleModeChange = (mode: ToolbarMode, data?: { kind?: string; type?: string }) => {
    setToolbarMode(mode);
    setToolbarData(data);
  };

  const handleUndoRedoChange = useCallback((newCanUndo: boolean, newCanRedo: boolean) => {
    setCanUndo(newCanUndo);
    setCanRedo(newCanRedo);
  }, []);

  const handleUndo = useCallback(() => {
    undoRef.current?.();
  }, []);

  const handleRedo = useCallback(() => {
    redoRef.current?.();
  }, []);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <h1 style={styles.title}>SysML Modeler</h1>
          <div style={styles.subtitle}>Neo4j-powered SysML v2 modeling tool</div>
        </div>
        <div style={styles.headerActions}>
          <DiagramSelector />
          {selectedDiagram && (
            <button style={styles.manageButton} onClick={() => setShowDiagramManager(true)}>
              Manage Elements
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        {/* Model Browser (Left Panel) */}
        <div style={styles.sidebar}>
          <ModelBrowser />
        </div>

        {/* Canvas (Right Panel) - Toolbar now floats inside canvas */}
        <div style={styles.canvas}>
          <SysMLCanvas
            toolbarMode={toolbarMode}
            toolbarData={toolbarData}
            onUndoRedoChange={handleUndoRedoChange}
            undoRedoRef={(undo, redo) => {
              undoRef.current = undo;
              redoRef.current = redo;
            }}
          />
          {/* Floating Toolbar */}
          <SysMLToolbar
            onModeChange={handleModeChange}
            currentMode={toolbarMode}
            currentData={toolbarData}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </div>
      </div>

      {/* Diagram Manager Modal */}
      {showDiagramManager && <DiagramManager onClose={() => setShowDiagramManager(false)} />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '2px solid #ddd',
    backgroundColor: '#fff',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  manageButton: {
    padding: '8px 16px',
    fontSize: '14px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#28a745',
    borderRadius: '4px',
    backgroundColor: '#28a745',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 600,
  },
  logo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#333',
    margin: 0,
  },
  subtitle: {
    fontSize: '12px',
    color: '#666',
    fontWeight: 400,
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '300px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fafafa',
    borderRight: '1px solid #ddd',
  },
  canvas: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
};
