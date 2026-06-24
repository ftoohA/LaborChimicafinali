import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

const ConfirmCtx = createContext(null);

/*
  useConfirm() → async function.
  await confirm({ title, message, confirmText, cancelText, danger, icon, dailyCode })
  Resolves true if confirmed (and, when dailyCode is set, the typed code matches), else false.
*/
export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const resolver = useRef(null);

  const confirm = useCallback((options = {}) => {
    setCode(''); setErr('');
    setOpts(options);
    return new Promise((resolve) => { resolver.current = resolve; });
  }, []);

  const finish = (val) => {
    setOpts(null);
    const r = resolver.current; resolver.current = null;
    r && r(val);
  };

  const onConfirm = () => {
    if (opts?.dailyCode) {
      if (code.trim() !== String(opts.dailyCode)) {
        setErr(opts.codeError || 'Codice errato');
        return;
      }
    }
    finish(true);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {opts && createPortal(
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) finish(false); }}>
          <div className="modal" style={{ maxWidth: 380, textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 6 }}>{opts.icon || (opts.danger ? '🗑️' : '❓')}</div>
            {opts.title && <h3 style={{ margin: '0 0 8px' }}>{opts.title}</h3>}
            <p style={{ margin: '0 0 16px', color: 'var(--muted)', lineHeight: 1.6 }}>
              {opts.message || 'Sei sicuro?'}
            </p>

            {opts.dailyCode != null && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--yellow)', marginBottom: 6 }}>
                  {opts.codePrompt || 'Inserisci il codice giornaliero per confermare'}
                </p>
                <input
                  autoFocus
                  value={code}
                  onChange={e => { setCode(e.target.value); setErr(''); }}
                  onKeyDown={e => e.key === 'Enter' && onConfirm()}
                  placeholder="••••"
                  style={{ textAlign: 'center', fontSize: 18, fontWeight: 800, letterSpacing: 4, maxWidth: 180, margin: '0 auto' }}
                />
                {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }}>{err}</div>}
              </div>
            )}

            <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
              <button onClick={() => finish(false)} style={{ minWidth: 90 }}>
                {opts.cancelText || 'Annulla'}
              </button>
              <button
                className={opts.danger ? 'danger' : 'primary'}
                style={{ minWidth: 110 }}
                onClick={onConfirm}
                autoFocus={opts.dailyCode == null}
              >
                {opts.confirmText || (opts.danger ? 'Elimina' : 'Conferma')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);
