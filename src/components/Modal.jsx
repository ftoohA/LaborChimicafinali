import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ children, onClose, maxWidth = 480 }) {
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  return createPortal(
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal" style={{ maxWidth }}>
        {children}
      </div>
    </div>,
    document.body
  );
}
