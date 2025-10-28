import { ReactFlowProvider } from 'reactflow';
import { DiagramProvider } from './lib/DiagramContext';
import SysMLModelingView from './components/sysml/SysMLModelingView';

function App() {
  return (
    <DiagramProvider>
      <ReactFlowProvider>
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
          <SysMLModelingView />
        </div>
      </ReactFlowProvider>
    </DiagramProvider>
  );
}

export default App;
