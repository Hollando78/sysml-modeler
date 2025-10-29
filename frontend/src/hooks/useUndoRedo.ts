import { useState, useCallback, useEffect } from 'react';

export interface UndoRedoAction {
  type: 'create-node' | 'delete-node' | 'move-node' | 'create-edge' | 'delete-edge' | 'add-to-diagram' | 'remove-from-diagram' | 'create-composition';
  data: any;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
  description: string;
}

interface UseUndoRedoOptions {
  maxHistorySize?: number;
}

export function useUndoRedo(options: UseUndoRedoOptions = {}) {
  const { maxHistorySize = 50 } = options;

  const [history, setHistory] = useState<UndoRedoAction[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  const canUndo = currentIndex >= 0;
  const canRedo = currentIndex < history.length - 1;

  const addAction = useCallback((action: UndoRedoAction) => {
    setHistory((prev) => {
      // Remove any actions after the current index (they're in the "redone" state)
      const newHistory = prev.slice(0, currentIndex + 1);

      // Add the new action
      newHistory.push(action);

      // Limit history size
      if (newHistory.length > maxHistorySize) {
        return newHistory.slice(newHistory.length - maxHistorySize);
      }

      return newHistory;
    });

    setCurrentIndex((prev) => {
      const newIndex = prev + 1;
      // If we're at max history, the index doesn't increase
      return newIndex >= maxHistorySize ? maxHistorySize - 1 : newIndex;
    });
  }, [currentIndex, maxHistorySize]);

  const undo = useCallback(async () => {
    if (!canUndo) return;

    const action = history[currentIndex];
    console.log('[UNDO] Undoing action:', action.description);

    try {
      await action.undo();
      setCurrentIndex((prev) => prev - 1);
    } catch (error) {
      console.error('[UNDO] Error undoing action:', error);
    }
  }, [canUndo, currentIndex, history]);

  const redo = useCallback(async () => {
    if (!canRedo) return;

    const action = history[currentIndex + 1];
    console.log('[REDO] Redoing action:', action.description);

    try {
      await action.redo();
      setCurrentIndex((prev) => prev + 1);
    } catch (error) {
      console.error('[REDO] Error redoing action:', error);
    }
  }, [canRedo, currentIndex, history]);

  const clear = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      if (modifier && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (modifier && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    addAction,
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
    history,
    currentIndex,
  };
}
