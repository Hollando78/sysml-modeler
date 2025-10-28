import { createContext, useContext, useState, ReactNode } from 'react';
import type { SysMLViewpoint } from '../types';

interface ViewpointContextType {
  selectedViewpoint: SysMLViewpoint | null;
  setViewpoint: (viewpoint: SysMLViewpoint | null) => void;
}

const ViewpointContext = createContext<ViewpointContextType | undefined>(undefined);

export function ViewpointProvider({ children }: { children: ReactNode }) {
  const [selectedViewpoint, setSelectedViewpoint] = useState<SysMLViewpoint | null>(null);

  const setViewpoint = (viewpoint: SysMLViewpoint | null) => {
    setSelectedViewpoint(viewpoint);
  };

  return (
    <ViewpointContext.Provider value={{ selectedViewpoint, setViewpoint }}>
      {children}
    </ViewpointContext.Provider>
  );
}

export function useViewpoint() {
  const context = useContext(ViewpointContext);
  if (context === undefined) {
    throw new Error('useViewpoint must be used within a ViewpointProvider');
  }
  return context;
}
