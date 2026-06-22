import { useState, useRef } from 'react';
import { useStore } from '../store';
import { I18N } from '../i18n';
import { uid, todayStr } from '../helpers';
import Modal from './Modal';
import { useToast } from './Toast';

const tr = (lang, ar, it, en) => (lang === 'ar' ? ar : lang === 'it' ? it : en);

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}
function hoursBetween(a, b) {
  if (!a || !b) return null;
  const ms = new Date(b) - new Date(a);
  return ms > 0 ? ms / 3600000 : 0;
}

export default function Attendance() {
  const { state, update, addLog } = useStore();
  const T = I18N[state.lang];
  const L = state.lang;
  const toast = useToast();
  const today = todayStr();
  const fileRef = useRef();
  const pendingRef = useRef(null); // { workerId, action }
  const [manual, setManual] = useState(null); // worker being edited manually

  const isAdmin = state.role === 'admin';
  const workers = state.workers || [];
  const records = state.attendance || [];
  const recFor = (wid) => records.find(r => r.workerId === wid && r.date === today);

  const downscale = (file, cb) => {
    if (file.size > 8 * 1024 * 1024) { toast(tr(L, 'الصورة كبيرة جداً', 'Immagine troppo grande', 'Image too large'), true); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 360;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', 0.7));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const startCapture = (workerId, action) => {
    pendingRef.current = { workerId, action };
    if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); }
  };

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !pendingRef.current) return;
    const { workerId, action } = pendingRef.current;
    downscale(file, (photo) => applyPunch(workerId, action, photo, false));
  };

  const applyPunch = (workerId, action, photo, isManual, isoOverride) => {
    const recs = records.map(r => ({ ...r }));
    let rec = recs.find(r => r.workerId === workerId && r.date === today);
    const now = isoOverride || new Date().toISOString();
    if (!rec) { rec = { id: uid(), workerId, date: today }; recs.push(rec); }
    if (action === 'in') { rec.clockIn = now; if (photo) rec.clockInPhoto = photo; }
    else { rec.clockOut = now; if (photo) rec.clockOutPhoto = photo; }
    if (isManual) rec.manual = true;
    update({ attendance: recs });
    addLog({ type: action === 'in' ? 'clock_in' : 'clock_out', workerId, manual: !!isManual, by: state.role });
    if (!isManual) toast(action === 'in' ? tr(L, 'تم تسجيل الدخول', 'Entrata registrata', 'Clocked in') : tr(L, 'تم تسجيل الخروج', 'Uscita registrata', 'Clocked out'));
  };

  // total hours today
  const totalHours = workers.reduce((sum, w) => {
    const r = recFor(w.id);
    const h = r ? hoursBetween(r.clockIn, r.clockOut) : null;
    return sum + (h || 0);
  }, 0);

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={onFile} />

      <div className="card">
        <div className="flex-between" style={{ marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>🕒 {tr(L, 'الحضور والانصراف', 'Presenze', 'Attendance')}</h3>
          <span className="smallmuted">{today} · {tr(L, 'إجمالي الساعات', 'Ore totali', 'Total hours')}: <strong style={{ color: 'var(--green)' }}>{totalHours.toFixed(1)}</strong></span>
        </div>
        {workers.length === 0 ? (
          <div className="empty">{tr(L, 'لا يوجد عمال. أضفهم من الإشراف.', 'Nessun operaio. Aggiungili da Supervisione.', 'No workers. Add them from Admin.')}</div>
        ) : (
          <div className="global-inv-grid" style={{ marginTop: 12 }}>
            {workers.map(w => {
              const r = recFor(w.id);
              const h = r ? hoursBetween(r.clockIn, r.clockOut) : null;
              const status = !r || !r.clockIn ? 'none' : !r.clockOut ? 'in' : 'done';
              return (
                <div className="inv-card" key={w.id} style={{ borderColor: status === 'in' ? 'var(--green)' : 'var(--line)' }}>
                  <div className="row" style={{ gap: 10, marginBottom: 8 }}>
                    {w.photo
                      ? <img src={w.photo} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--line)' }} />
                      : <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--panel2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👤</div>}
                    <div>
                      <div style={{ fontWeight: 700 }}>{w.name}</div>
                      <div className="smallmuted">{w.lunchTime || ''}</div>
                    </div>
                  </div>
                  <table style={{ fontSize: 13 }}>
                    <tbody>
                      <tr>
                        <td className="smallmuted">🟢 {tr(L, 'دخول', 'Entrata', 'In')}</td>
                        <td className="mono">{fmtTime(r?.clockIn)}</td>
                        <td>{r?.clockInPhoto && <img src={r.clockInPhoto} alt="" style={{ width: 26, height: 26, borderRadius: 4, objectFit: 'cover' }} />}</td>
                      </tr>
                      <tr>
                        <td className="smallmuted">🔴 {tr(L, 'خروج', 'Uscita', 'Out')}</td>
                        <td className="mono">{fmtTime(r?.clockOut)}</td>
                        <td>{r?.clockOutPhoto && <img src={r.clockOutPhoto} alt="" style={{ width: 26, height: 26, borderRadius: 4, objectFit: 'cover' }} />}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ textAlign: 'center', margin: '6px 0', fontWeight: 700, color: 'var(--green)' }}>
                    {h != null ? `${h.toFixed(1)} ${tr(L, 'ساعة', 'ore', 'h')}` : ''} {r?.manual && <span className="smallmuted">({tr(L, 'يدوي', 'manuale', 'manual')})</span>}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {status !== 'done' && (
                      <button className="primary" style={{ flex: 1, fontSize: 12 }}
                        onClick={() => startCapture(w.id, status === 'none' ? 'in' : 'out')}>
                        📸 {status === 'none' ? tr(L, 'دخول', 'Entrata', 'Clock In') : tr(L, 'خروج', 'Uscita', 'Clock Out')}
                      </button>
                    )}
                    {isAdmin && (
                      <button className="ghost" style={{ fontSize: 12 }} onClick={() => setManual(w)}>✏️ {tr(L, 'يدوي', 'Manuale', 'Manual')}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {manual && (
        <ManualModal L={L} T={T} worker={manual} rec={recFor(manual.id)} today={today}
          onClose={() => setManual(null)}
          onSave={(inTime, outTime) => {
            if (inTime) applyPunch(manual.id, 'in', null, true, `${today}T${inTime}:00`);
            if (outTime) applyPunch(manual.id, 'out', null, true, `${today}T${outTime}:00`);
            toast(T.success_added);
            setManual(null);
          }} />
      )}
    </>
  );
}

function ManualModal({ L, T, worker, rec, today, onClose, onSave }) {
  const toHM = (iso) => iso ? new Date(iso).toTimeString().slice(0, 5) : '';
  const [inT, setInT] = useState(toHM(rec?.clockIn));
  const [outT, setOutT] = useState(toHM(rec?.clockOut));
  return (
    <Modal onClose={onClose} maxWidth={340}>
      <h3>✏️ {tr(L, 'تعديل يدوي', 'Modifica manuale', 'Manual Edit')} — {worker.name}</h3>
      <div className="field">
        <label>🟢 {tr(L, 'وقت الدخول', 'Ora entrata', 'Clock In')}</label>
        <input type="time" value={inT} onChange={e => setInT(e.target.value)} />
      </div>
      <div className="field">
        <label>🔴 {tr(L, 'وقت الخروج', 'Ora uscita', 'Clock Out')}</label>
        <input type="time" value={outT} onChange={e => setOutT(e.target.value)} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => onSave(inT, outT)}>{T.save}</button>
      </div>
    </Modal>
  );
}
