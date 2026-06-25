import { useState } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { I18N } from '../i18n';
import Modal from './Modal';
import WorkerProfileView from './WorkerProfileView';

const tr = (L, ar, it, en) => (L === 'ar' ? ar : L === 'it' ? it : en);

export default function WorkerProfile() {
  const { state, update } = useStore();
  const T = I18N[state.lang];
  const L = state.lang;
  const toast = useToast();

  // Which worker is authenticated for this session
  const [workerId, setWorkerId] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [changingPin, setChangingPin] = useState(false);

  const workers = state.workers || [];
  const worker = workerId ? workers.find(w => w.id === workerId) : null;

  const tryPin = () => {
    setPinErr('');
    const match = workers.find(w => w.pin && w.pin === pinInput.trim());
    if (match) { setWorkerId(match.id); setPinInput(''); }
    else setPinErr(tr(L, 'الرقم السري غلط', 'Codice errato', 'Wrong PIN'));
  };

  // --- PIN change ---
  const handlePinChange = (newPin) => {
    if (workers.some(w => w.id !== workerId && w.pin && w.pin === newPin)) {
      toast(tr(L, 'هذا الرقم السري مستخدم بالفعل', 'PIN già in uso', 'PIN already in use'), true);
      return; // keep modal open
    }
    update({ workers: workers.map(w => w.id === workerId ? { ...w, pin: newPin } : w) });
    toast(tr(L, 'تم تغيير الرقم السري', 'PIN aggiornato', 'PIN updated'));
    setChangingPin(false);
  };

  if (!workerId) {
    return (
      <div style={{ maxWidth: 380, margin: '40px auto' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
          <h2 style={{ margin: '0 0 8px', color: 'var(--brand)' }}>
            {tr(L, 'ملفي الشخصي', 'Il mio profilo', 'My Profile')}
          </h2>
          <p className="smallmuted" style={{ marginBottom: 20 }}>
            {tr(L, 'أدخل رقمك السري لعرض ملفك', 'Inserisci il tuo PIN per vedere il profilo', 'Enter your PIN to view your profile')}
          </p>
          <div className="field">
            <input
              autoFocus
              type="password"
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinErr(''); }}
              onKeyDown={e => e.key === 'Enter' && tryPin()}
              placeholder="••••"
              style={{ textAlign: 'center', fontSize: 24, letterSpacing: 6, fontWeight: 800, maxWidth: 200, margin: '0 auto' }}
            />
          </div>
          {pinErr && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }}>{pinErr}</div>}
          <button className="primary" style={{ marginTop: 14, width: '100%', fontSize: 16, padding: '12px' }} onClick={tryPin}>
            🔓 {tr(L, 'دخول', 'Accedi', 'Enter')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <WorkerProfileView worker={worker} actions={
        <>
          <button onClick={() => setChangingPin(true)}>🔒 {tr(L, 'تغيير PIN', 'Cambia PIN', 'Change PIN')}</button>
          <button className="ghost" onClick={() => setWorkerId(null)}>← {tr(L, 'خروج', 'Esci', 'Exit')}</button>
        </>
      } />

      {changingPin && (
        <ChangePinModal L={L} T={T}
          onClose={() => setChangingPin(false)}
          onSave={handlePinChange} />
      )}
    </>
  );
}

function ChangePinModal({ L, T, onClose, onSave }) {
  const toast = useToast();
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  return (
    <Modal onClose={onClose} maxWidth={320}>
      <h3>🔒 {tr(L, 'تغيير الرقم السري', 'Cambia PIN', 'Change PIN')}</h3>
      <div className="field">
        <label>{tr(L, 'الرقم السري الجديد', 'Nuovo PIN', 'New PIN')}</label>
        <input autoFocus type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" />
      </div>
      <div className="field">
        <label>{tr(L, 'تأكيد الرقم السري', 'Conferma PIN', 'Confirm PIN')}</label>
        <input type="password" value={pin2} onChange={e => setPin2(e.target.value)} placeholder="••••"
          onKeyDown={e => e.key === 'Enter' && (pin && pin === pin2 ? onSave(pin) : toast(tr(L, 'الأرقام غير متطابقة', 'PIN non corrispondono', 'PINs do not match'), true))} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => {
          if (!pin.trim()) { toast('—', true); return; }
          if (pin !== pin2) { toast(tr(L, 'الأرقام غير متطابقة', 'PIN non corrispondono', 'PINs do not match'), true); return; }
          onSave(pin.trim());
        }}>{T.save}</button>
      </div>
    </Modal>
  );
}
