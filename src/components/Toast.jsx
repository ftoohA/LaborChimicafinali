import { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, err = false) => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, err }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {createPortal(
        <div style={{ position: 'fixed', bottom: 20, insetInlineEnd: 20, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {toasts.map(t => (
            <div key={t.id} className={`toast${t.err ? ' err' : ''}`}>{t.msg}</div>
          ))}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
