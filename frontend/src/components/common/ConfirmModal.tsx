import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'info',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onConfirm, onCancel]);

  const variantStyles = {
    danger: {
      icon: AlertTriangle,
      iconColor: '#d32f2f',
      confirmBg: '#d32f2f',
      confirmHoverBg: '#c62828',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: '#f57c00',
      confirmBg: '#f57c00',
      confirmHoverBg: '#ef6c00',
    },
    info: {
      icon: AlertTriangle,
      iconColor: '#007bff',
      confirmBg: '#007bff',
      confirmHoverBg: '#0056b3',
    },
  };

  const variantConfig = variantStyles[variant];
  const Icon = variantConfig.icon;

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <div style={{ ...styles.iconContainer, backgroundColor: `${variantConfig.iconColor}20` }}>
              {React.createElement(Icon, {
                size: 24,
                color: variantConfig.iconColor
              })}
            </div>
            <h2 style={styles.title}>{title}</h2>
          </div>
          <button type="button" style={styles.closeButton} onClick={onCancel}>
            {React.createElement(X, { size: 20 })}
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          <p style={styles.message}>{message}</p>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button type="button" style={styles.cancelButton} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            style={{
              ...styles.confirmButton,
              backgroundColor: variantConfig.confirmBg,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = variantConfig.confirmHoverBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = variantConfig.confirmBg;
            }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    width: '90%',
    maxWidth: '450px',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '20px 24px 16px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },
  iconContainer: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#333',
  },
  closeButton: {
    padding: '4px',
    borderWidth: '0',
    borderStyle: 'none',
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#666',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  content: {
    padding: '20px 24px',
  },
  message: {
    margin: 0,
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.6',
  },
  footer: {
    padding: '12px 24px 20px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  cancelButton: {
    padding: '10px 20px',
    fontSize: '14px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#ddd',
    borderRadius: '6px',
    backgroundColor: 'white',
    color: '#333',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  confirmButton: {
    padding: '10px 20px',
    fontSize: '14px',
    borderWidth: '0',
    borderStyle: 'none',
    borderColor: 'transparent',
    borderRadius: '6px',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
};
