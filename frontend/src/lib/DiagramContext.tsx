import { createContext, useContext, useState, ReactNode } from 'react';
import type { SysMLDiagram } from '../types';

interface DiagramContextType {
  selectedDiagram: SysMLDiagram | null;
  selectedDiagramId: string | null;
  setDiagram: (diagram: SysMLDiagram | null) => void;
}

const DiagramContext = createContext<DiagramContextType | undefined>(undefined);

export function DiagramProvider({ children }: { children: ReactNode }) {
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(() => {
    // Load from localStorage on initial mount
    return localStorage.getItem('selectedDiagramId');
  });
  const [selectedDiagram, setSelectedDiagram] = useState<SysMLDiagram | null>(null);

  const setDiagram = (diagram: SysMLDiagram | null) => {
    console.log('[DEBUG] Setting selected diagram:', diagram?.id, diagram?.name);
    setSelectedDiagram(diagram);
    setSelectedDiagramId(diagram?.id || null);

    // Persist to localStorage
    if (diagram?.id) {
      localStorage.setItem('selectedDiagramId', diagram.id);
    } else {
      localStorage.removeItem('selectedDiagramId');
    }
  };

  return (
    <DiagramContext.Provider value={{ selectedDiagram, selectedDiagramId, setDiagram }}>
      {children}
    </DiagramContext.Provider>
  );
}

export function useDiagram() {
  const context = useContext(DiagramContext);
  if (context === undefined) {
    throw new Error('useDiagram must be used within a DiagramProvider');
  }
  return context;
}
