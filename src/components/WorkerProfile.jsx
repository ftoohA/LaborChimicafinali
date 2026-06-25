import { useState } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { I18N } from '../i18n';
import { roundedHours } from '../helpers';
import Modal from './Modal';

const tr = (L, ar, it, en) => (L === 'ar' ? ar : L === 'it' ? it : en);

const DAYS = {
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  it: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}

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
  const [viewingDoc, setViewingDoc] = useState(null);

  const workers = state.workers || [];
  const worker = workerId ? workers.find(w => w.id === workerId) : null;

  const tryPin = () => {
    setPinErr('');
    const match = workers.find(w => w.pin && w.pin === pinInput.trim());
    if (match) { setWorkerId(match.id); setPinInput(''); }
    else setPinErr(tr(L, 'الرقم السري غلط', 'Codice errato', 'Wrong PIN'));
  };

  // All attendance records for this worker
  const records = (state.attendance || [])
    .filter(r => r.workerId === workerId)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Monthly hours (current month)
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyHrs = records
    .filter(r => r.date.startsWith(thisMonth))
    .reduce((s, r) => s + (roundedHours(r.clockIn, r.clockOut) || 0), 0);

  // Total all-time hours
  const totalHrs = records.reduce((s, r) => s + (roundedHours(r.clockIn, r.clockOut) || 0), 0);

  // Current-month rating (set by supervisor), falls back to legacy single grade
  const monthRating = worker?.monthlyRatings?.[thisMonth] ?? worker?.grade ?? 0;

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
      {/* Header card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {worker?.photo
            ? <img src={worker.photo} alt="" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--brand)' }} />
            : <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--panel2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>👤</div>}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{worker?.name}</div>
            {worker?.codiceFiscale && (
              <div className="smallmuted mono" style={{ marginTop: 2, fontSize: 12 }}>🆔 {worker.codiceFiscale}</div>
            )}
            {worker?.details && <div className="smallmuted" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{worker.details}</div>}
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="smallmuted" style={{ fontSize: 12 }}>{tr(L, `تقييم ${thisMonth}:`, `Voto ${thisMonth}:`, `Rating ${thisMonth}:`)}</span>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ fontSize: 18, color: i < monthRating ? 'var(--yellow)' : 'var(--line)' }}>★</span>
              ))}
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexShrink: 0 }}>
            <button onClick={() => setChangingPin(true)}>🔒 {tr(L, 'تغيير PIN', 'Cambia PIN', 'Change PIN')}</button>
            <button className="ghost" onClick={() => setWorkerId(null)}>← {tr(L, 'خروج', 'Esci', 'Exit')}</button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid cols-3" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="num" style={{ color: 'var(--green)' }}>{monthlyHrs.toFixed(1)}h</div>
          <div className="lbl">{tr(L, 'ساعات هذا الشهر', 'Ore questo mese', 'This month')}</div>
        </div>
        <div className="stat">
          <div className="num">{totalHrs.toFixed(1)}h</div>
          <div className="lbl">{tr(L, 'إجمالي الساعات', 'Ore totali', 'Total hours')}</div>
        </div>
        <div className="stat">
          <div className="num">{records.filter(r => r.date.startsWith(thisMonth)).length}</div>
          <div className="lbl">{tr(L, 'أيام هذا الشهر', 'Giorni questo mese', 'Days this month')}</div>
        </div>
      </div>

      {/* ID card + documents */}
      {(worker?.idCardPhoto || (worker?.documents || []).length > 0) && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 12px' }}>📎 {tr(L, 'المستندات والصور', 'Documenti e foto', 'Documents & Photos')}</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {worker?.idCardPhoto && (
              <div style={{ textAlign: 'center' }}>
                <img src={worker.idCardPhoto} alt="" onClick={() => setViewingDoc(worker.idCardPhoto)}
                  style={{ width: 130, height: 86, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer' }} />
                <div className="smallmuted" style={{ fontSize: 11, marginTop: 4 }}>🪪 {tr(L, 'البطاقة', "Carta d'identità", 'ID card')}</div>
              </div>
            )}
            {(worker?.documents || []).map(doc => (
              <div key={doc.id} style={{ textAlign: 'center' }}>
                <img src={doc.image} alt={doc.name} onClick={() => setViewingDoc(doc.image)}
                  style={{ width: 100, height: 86, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer' }} />
                {doc.name && <div className="smallmuted" style={{ fontSize: 11, marginTop: 4, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance history */}
      <div className="card">
        <h3 style={{ margin: '0 0 12px' }}>📅 {tr(L, 'سجل الحضور', 'Storico presenze', 'Attendance History')}</h3>
        {records.length === 0 ? (
          <div className="empty">{tr(L, 'لا يوجد سجلات بعد', 'Nessun record ancora', 'No records yet')}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{tr(L, 'التاريخ', 'Data', 'Date')}</th>
                <th>{tr(L, 'اليوم', 'Giorno', 'Day')}</th>
                <th>🟢 {tr(L, 'دخول', 'Entrata', 'In')}</th>
                <th>🔴 {tr(L, 'خروج', 'Uscita', 'Out')}</th>
                <th>📸 {tr(L, 'الصور', 'Foto', 'Photos')}</th>
                <th>{tr(L, 'الساعات', 'Ore', 'Hours')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const h = roundedHours(r.clockIn, r.clockOut);
                const dayIdx = r.date ? new Date(r.date + 'T12:00:00').getDay() : null;
                const thumb = (src, ring) => (
                  <img src={src} alt="" onClick={() => setViewingDoc(src)}
                    style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, border: `2px solid ${ring}`, cursor: 'pointer' }} />
                );
                return (
                  <tr key={r.id}>
                    <td className="mono">{r.date}</td>
                    <td className="smallmuted">{dayIdx != null ? (DAYS[L] || DAYS.en)[dayIdx] : '—'}</td>
                    <td className="mono">{fmtTime(r.clockIn)}</td>
                    <td className="mono">{fmtTime(r.clockOut)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {r.clockInPhoto ? thumb(r.clockInPhoto, 'var(--green)') : null}
                        {r.clockOutPhoto ? thumb(r.clockOutPhoto, 'var(--red)') : null}
                        {!r.clockInPhoto && !r.clockOutPhoto && <span className="smallmuted">—</span>}
                      </div>
                    </td>
                    <td>
                      <span className="mono" style={{ fontWeight: 700, color: h ? 'var(--green)' : 'var(--muted)' }}>
                        {h != null ? `${h.toFixed(1)}h` : '—'}
                      </span>
                      {r.manual && <span className="smallmuted" style={{ fontSize: 10, marginInlineStart: 4 }}>✏️</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* PIN change modal */}
      {changingPin && (
        <ChangePinModal L={L} T={T}
          onClose={() => setChangingPin(false)}
          onSave={handlePinChange} />
      )}

      {/* Document lightbox */}
      {viewingDoc && (
        <div onClick={() => setViewingDoc(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, cursor: 'zoom-out' }}>
          <img src={viewingDoc} alt="" style={{ maxWidth: '95%', maxHeight: '95%', borderRadius: 8 }} />
        </div>
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
