import { useState, useRef } from 'react';
import { useStore } from '../store';
import { I18N } from '../i18n';
import { uid, todayStr, netHours } from '../helpers';
import Modal from './Modal';
import { useToast } from './Toast';

const tr = (lang, ar, it, en) => (lang === 'ar' ? ar : lang === 'it' ? it : en);

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
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
  const [pinPrompt, setPinPrompt] = useState(null); // { workerId, action }

  const isAdmin = state.role === 'admin';
  const workers = state.workers || [];
  const records = state.attendance || [];
  const recFor = (wid) => records.find(r => r.workerId === wid && r.date === today);

  const breaksToday = (state.breaks || {})[today] || {};
  const setBreak = (workerId, value) => {
    update({ breaks: { ...(state.breaks || {}), [today]: { ...breaksToday, [workerId]: value } } });
  };

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

  // Require the worker's secret PIN before capturing the selfie (if a PIN is set)
  const requestPunch = (workerId, action) => {
    const w = workers.find(x => x.id === workerId);
    if (w && w.pin) setPinPrompt({ workerId, action });
    else startCapture(workerId, action);
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

  // Manual edit: set in/out/lunch in ONE update (avoids the stale-overwrite bug)
  const applyManual = (workerId, inTime, outTime, lunch) => {
    const recs = records.map(r => ({ ...r }));
    let rec = recs.find(r => r.workerId === workerId && r.date === today);
    if (!rec) { rec = { id: uid(), workerId, date: today }; recs.push(rec); }
    if (inTime) rec.clockIn = `${today}T${inTime}:00`;
    if (outTime) rec.clockOut = `${today}T${outTime}:00`;
    rec.lunch = Number(lunch) || 0;
    rec.manual = true;
    update({ attendance: recs });
    addLog({ type: 'clock_out', workerId, manual: true, by: state.role });
    toast(T.success_added);
    setManual(null);
  };

  // total worked hours today (rounded, minus lunch)
  const totalHours = workers.reduce((sum, w) => sum + (netHours(recFor(w.id)) || 0), 0);

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
              const h = netHours(r);
              const status = !r || !r.clockIn ? 'none' : !r.clockOut ? 'in' : 'done';
              return (
                <div className="inv-card" key={w.id} style={{ borderColor: status === 'in' ? 'var(--green)' : 'var(--line)' }}>
                  <div className="row" style={{ gap: 10, marginBottom: 8 }}>
                    {w.photo
                      ? <img src={w.photo} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--line)' }} />
                      : <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--panel2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👤</div>}
                    <div>
                      <div style={{ fontWeight: 700 }}>{w.name}</div>
                      {breaksToday[w.id] && <div className="smallmuted">🍽️ {breaksToday[w.id]}</div>}
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
                    {h != null ? `${h.toFixed(1)} ${tr(L, 'ساعة', 'ore', 'h')}` : ''}
                    {r?.lunch > 0 && <span className="smallmuted" style={{ fontSize: 10 }}> 🍽️ −{r.lunch}h</span>}
                    {r?.manual && <span className="smallmuted"> ({tr(L, 'يدوي', 'manuale', 'manual')})</span>}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {status !== 'done' && (
                      <button className="primary" style={{ flex: 1, fontSize: 12 }}
                        onClick={() => requestPunch(w.id, status === 'none' ? 'in' : 'out')}>
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

      {/* ── Daily break schedule (separate, changes each day) ── */}
      {workers.length > 0 && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 2 }}>
            <h3 style={{ margin: 0 }}>🍽️ {tr(L, 'جدول الراحات', 'Orari pause', 'Break Schedule')}</h3>
            <span className="smallmuted">{today}</span>
          </div>
          <p className="smallmuted" style={{ marginTop: 4 }}>{tr(L, 'يتغيّر كل يوم حسب الشغل', 'Cambia ogni giorno secondo il lavoro', 'Changes daily based on work')}</p>
          <table>
            <thead>
              <tr>
                <th>{tr(L, 'العامل', 'Operaio', 'Worker')}</th>
                <th>🍽️ {tr(L, 'وقت الراحة', 'Orario pausa', 'Break time')}</th>
              </tr>
            </thead>
            <tbody>
              {workers.map(w => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 600 }}>{w.name}</td>
                  <td>
                    {isAdmin
                      ? <input className="input-sm" value={breaksToday[w.id] || ''} onChange={e => setBreak(w.id, e.target.value)} placeholder="12:00 - 12:30" style={{ width: 150 }} />
                      : <span className="mono">{breaksToday[w.id] || '—'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {manual && (
        <ManualModal L={L} T={T} worker={manual} rec={recFor(manual.id)} today={today}
          onClose={() => setManual(null)}
          onSave={(inTime, outTime, lunch) => applyManual(manual.id, inTime, outTime, lunch)} />
      )}

      {pinPrompt && (() => {
        const w = workers.find(x => x.id === pinPrompt.workerId);
        return (
          <PinModal L={L} T={T} worker={w}
            onClose={() => setPinPrompt(null)}
            onConfirm={(entered) => {
              if (entered === (w?.pin || '')) {
                const a = pinPrompt; setPinPrompt(null); startCapture(a.workerId, a.action);
              } else {
                toast(tr(L, 'الرقم السري غلط', 'Codice errato', 'Wrong PIN'), true);
              }
            }} />
        );
      })()}
    </>
  );
}

function PinModal({ L, T, worker, onClose, onConfirm }) {
  const [pin, setPin] = useState('');
  return (
    <Modal onClose={onClose} maxWidth={300}>
      <h3>🔒 {worker?.name}</h3>
      <div className="field">
        <label>{tr(L, 'أدخل رقمك السري', 'Inserisci il tuo codice', 'Enter your PIN')}</label>
        <input autoFocus type="password" value={pin} onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onConfirm(pin)}
          placeholder="••••" style={{ textAlign: 'center', fontSize: 18, letterSpacing: 3 }} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => onConfirm(pin)}>{T.confirm}</button>
      </div>
    </Modal>
  );
}

function ManualModal({ L, T, worker, rec, today, onClose, onSave }) {
  const toHM = (iso) => iso ? new Date(iso).toTimeString().slice(0, 5) : '';
  const [inT, setInT] = useState(toHM(rec?.clockIn));
  const [outT, setOutT] = useState(toHM(rec?.clockOut));
  const [lunch, setLunch] = useState(rec?.lunch ?? 0);

  // Live preview of worked hours (rounded session minus lunch)
  const round = (ci, co) => {
    if (!ci || !co) return null;
    const ms = new Date(`${today}T${co}:00`) - new Date(`${today}T${ci}:00`);
    if (ms <= 0) return 0;
    const mins = ms / 60000, full = Math.floor(mins / 60), rem = mins % 60;
    return full + (rem > 45 ? 1 : rem > 20 ? 0.5 : 0);
  };
  const gross = round(inT, outT);
  const net = gross == null ? null : Math.max(0, gross - (Number(lunch) || 0));

  return (
    <Modal onClose={onClose} maxWidth={360}>
      <h3>✏️ {tr(L, 'تعديل يدوي', 'Modifica manuale', 'Manual Edit')} — {worker.name}</h3>
      <div className="grid cols-2">
        <div className="field">
          <label>🟢 {tr(L, 'وقت الدخول', 'Ora entrata', 'Clock In')}</label>
          <input type="time" value={inT} onChange={e => setInT(e.target.value)} />
        </div>
        <div className="field">
          <label>🔴 {tr(L, 'وقت الخروج', 'Ora uscita', 'Clock Out')}</label>
          <input type="time" value={outT} onChange={e => setOutT(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>🍽️ {tr(L, 'ساعات الغداء (تُخصم)', 'Ore pausa pranzo (sottratte)', 'Lunch hours (deducted)')}</label>
        <input type="number" step="0.5" min="0" value={lunch} onChange={e => setLunch(e.target.value)} placeholder="0 / 0.5 / 1" />
      </div>
      {net != null && (
        <div style={{ textAlign: 'center', margin: '4px 0 10px', fontSize: 13 }}>
          {tr(L, 'صافي ساعات العمل', 'Ore nette', 'Net hours')}:{' '}
          <strong style={{ color: 'var(--green)' }}>{net.toFixed(1)}h</strong>
          {Number(lunch) > 0 && <span className="smallmuted"> ({gross.toFixed(1)} − {Number(lunch)})</span>}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => onSave(inT, outT, lunch)}>{T.save}</button>
      </div>
    </Modal>
  );
}
