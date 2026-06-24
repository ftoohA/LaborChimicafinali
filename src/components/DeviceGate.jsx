import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { getDeviceId } from '../helpers';

/*
  Device-level access control.
  - The very first device to ever open the system is auto-approved (the trusted one).
  - Any other device must request access and wait for the supervisor's approval.
  - Approved/pending lists live in Firestore, so approval is realtime.
*/
export default function DeviceGate({ children }) {
  const { state, update } = useStore();
  const deviceId = getDeviceId();
  const approved = state.approvedDevices || [];
  const pending = state.pendingDevices || [];
  const bootRef = useRef(false);

  const [name, setName] = useState('');

  const isApproved = approved.some(d => d.id === deviceId);
  const myPending = pending.find(d => d.id === deviceId);

  // Bootstrap: first device becomes the trusted device (also self-heals a full revoke)
  useEffect(() => {
    if (!state.loaded) return;
    if (approved.length === 0 && !bootRef.current) {
      bootRef.current = true;
      update({ approvedDevices: [{ id: deviceId, name: 'Dispositivo principale', ts: Date.now() }] });
    }
  }, [state.loaded, approved.length, deviceId, update]);

  // While the store loads, let the app show its own loader
  if (!state.loaded) return children;
  // Trusted (or during the brief bootstrap window) → let through
  if (isApproved || approved.length === 0) return children;

  const requestAccess = () => {
    const nm = name.trim() || 'Dispositivo';
    update({
      pendingDevices: [
        ...pending.filter(d => d.id !== deviceId),
        { id: deviceId, name: nm, ua: navigator.userAgent.slice(0, 140), ts: Date.now() },
      ],
    });
  };

  return (
    <div id="app">
      <div className="hazard" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '90vh', padding: 20 }}>
        <div className="card" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>🔒</div>
          <h2 style={{ margin: '0 0 8px', color: 'var(--brand)' }}>laborchimcica</h2>

          {myPending ? (
            <>
              <div style={{ fontSize: 40, margin: '10px 0' }}>⏳</div>
              <h3 style={{ margin: '0 0 8px' }}>In attesa di approvazione</h3>
              <p className="smallmuted" style={{ lineHeight: 1.6 }}>
                La richiesta di questo dispositivo è stata inviata al responsabile.
                Potrai accedere solo dopo l'approvazione. La pagina si aggiorna da sola.
              </p>
              <div style={{ marginTop: 14, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line)' }}>
                <div className="smallmuted" style={{ fontSize: 11 }}>Nome dispositivo</div>
                <div style={{ fontWeight: 700 }}>{myPending.name}</div>
              </div>
            </>
          ) : (
            <>
              <p className="smallmuted" style={{ marginBottom: 18, lineHeight: 1.6 }}>
                Questo dispositivo non è autorizzato. Invia una richiesta di accesso:
                il responsabile dovrà approvarla prima che tu possa entrare.
              </p>
              <div className="field" style={{ textAlign: 'start' }}>
                <label>Nome del dispositivo</label>
                <input
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && requestAccess()}
                  placeholder="es: Telefono Mario / PC ufficio"
                />
              </div>
              <button className="primary" style={{ width: '100%', marginTop: 8, padding: 12, fontSize: 16 }} onClick={requestAccess}>
                📨 Invia richiesta di accesso
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
