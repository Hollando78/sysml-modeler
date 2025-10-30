import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Add listeners after a small delay to prevent immediate closing
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const adjustedX = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 10 : x;
      const adjustedY = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 10 : y;

      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y]);

  return (
    <div ref={menuRef} style={styles.container} data-context-menu="true">
      {items.map((item, index) => {
        if (item.separator) {
          return <div key={index} style={styles.separator} />;
        }

        return (
          <div
            key={index}
            style={{
              ...styles.item,
              ...(item.disabled ? styles.itemDisabled : {}),
            }}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f0f0f0';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
            }}
          >
            {item.icon && <span style={styles.icon}>{item.icon}</span>}
            <span style={styles.label}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    zIndex: 10000,
    minWidth: '160px',
    padding: '4px 0',
  },
  item: {
    padding: '8px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    userSelect: 'none',
  },
  itemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  icon: {
    display: 'flex',
    alignItems: 'center',
    width: '16px',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
  },
  separator: {
    height: '1px',
    backgroundColor: '#e0e0e0',
    margin: '4px 0',
  },
};
