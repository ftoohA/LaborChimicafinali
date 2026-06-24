import { useState, useRef } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { I18N, ADMIN_PASS, WORKER_PASS } from '../i18n';
import { uid, roundedHours } from '../helpers';
import Modal from './Modal';

export default function Admin() {
  const { state, update, addLog } = useStore();
  const T = I18N[state.lang];
  const toast = useToast();

  const [settings, setSettings] = useState({ ...state.settings });
  const [addingCompany, setAddingCompany] = useState(false);
  const [addingWorker, setAddingWorker] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);   // full edit modal
  const [editingWorkerPin, setEditingWorkerPin] = useState(null); // worker object

  const thisMonth = new Date().toISOString().slice(0, 7);
  const getMonthlyHours = (wid) => (state.attendance || [])
    .filter(r => r.workerId === wid && r.date && r.date.startsWith(thisMonth))
    .reduce((sum, r) => sum + (roundedHours(r.clockIn, r.clockOut) || 0), 0);

  const workers = state.workers || [];
  const getRating = (w) => (w.monthlyRatings?.[thisMonth] ?? 0);
  const setRating = (wid, stars) => {
    update({ workers: workers.map(w => w.id !== wid ? w : { ...w, monthlyRatings: { ...(w.monthlyRatings || {}), [thisMonth]: stars } }) });
    addLog({ type: 'worker_rated', workerId: wid, month: thisMonth, stars, by: state.role });
  };
  // Employee of the month = highest current-month rating
  const employeeOfMonth = workers.reduce((best, w) => {
    const r = getRating(w);
    return r > 0 && (!best || r > getRating(best)) ? w : best;
  }, null);

  const setSetting = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const saveSettings = () => {
    update({ settings });
    addLog({ type: 'settings_updated', by: state.role });
    toast(T.success_added);
  };

  const deleteCompany = (id) => {
    if (!confirm(T.confirm_delete)) return;
    update({ companies: state.companies.filter(c => c.id !== id) });
    toast(T.deleted);
  };

  const deleteWorker = (id) => {
    if (!confirm(T.confirm_delete)) return;
    update({ workers: (state.workers || []).filter(w => w.id !== id) });
    toast(T.deleted);
  };

  return (
    <>
      {/* Change Password */}
      <ChangePasswordCard T={T} state={state} update={update} toast={toast} />

      {/* Daily Code */}
      {(() => {
        const today = new Date().toISOString().slice(0, 10);
        const currentCode = (state.dailyCodes || {})[today] || '';
        return (
          <div className="card" style={{ borderColor: 'var(--yellow)', marginBottom: 16 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px 0' }}>
              🔑 {state.lang === 'ar' ? 'كود التأكيد اليومي' : state.lang === 'it' ? 'Codice conferma giornaliero' : 'Daily Confirmation Code'}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
              {state.lang === 'ar' ? 'هذا الكود يتغيّر كل يوم. يُستخدم لتأكيد أي عملية في البرنامج (بانكاله، تحضير سائل، إلخ). شاركه مع الموظفين خارج البرنامج.' :
               state.lang === 'it' ? 'Questo codice cambia ogni giorno. Viene utilizzato per confermare qualsiasi operazione (bancale, preparazione liquido, ecc.). Condividilo con i dipendenti fuori dall\'app.' :
               'This code changes daily. Used to confirm any program action (pallet, liquid prep, etc.). Share it with workers outside the app.'}
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                value={currentCode}
                onChange={e => update({ dailyCodes: { ...state.dailyCodes, [today]: e.target.value } })}
                placeholder={state.lang === 'ar' ? 'اكتب كود اليوم...' : state.lang === 'it' ? 'Scrivi il codice di oggi...' : 'Enter today\'s code...'}
                style={{ flex: 1, fontSize: 20, fontWeight: 800, textAlign: 'center', letterSpacing: 3, padding: '10px 16px', borderRadius: 8, border: '2px solid var(--yellow)', background: 'rgba(242,183,5,0.06)' }}
              />
              {currentCode && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--yellow)', letterSpacing: 4, fontFamily: 'monospace' }}>{currentCode}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{today}</div>
                </div>
              )}
            </div>
            {!currentCode && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, fontSize: 12, color: 'var(--red)' }}>
                ⚠️ {state.lang === 'ar' ? 'لم يتم تعيين كود لهذا اليوم! لن يتمكن الموظفون من تأكيد أي عملية.' :
                     state.lang === 'it' ? 'Nessun codice impostato per oggi! I dipendenti non potranno confermare operazioni.' :
                     'No code set for today! Workers cannot confirm any actions.'}
              </div>
            )}
          </div>
        );
      })()}

      {/* Settings */}
      <div className="card">
        <h3>{T.settings}</h3>
        <div className="grid cols-4">
          {[
            ['wasteTicket', T.waste_ticket],
            ['wasteCap', T.waste_cap],
            ['wasteJerrican', T.waste_jerrican],
            ['lowStock', T.low_stock_threshold],
            ['wastePastaBox', state.lang === 'ar' ? 'هادر علب الباستا %' : state.lang === 'it' ? 'Scarto scatole pasta %' : 'Pasta Box Waste %'],
            ['wastePastaLid', state.lang === 'ar' ? 'هادر أغطية الباستا %' : state.lang === 'it' ? 'Scarto coperchi pasta %' : 'Pasta Lid Waste %'],
            ['wastePastaSponge', state.lang === 'ar' ? 'هادر إسفنج الباستا %' : state.lang === 'it' ? 'Scarto spugna pasta %' : 'Pasta Sponge Waste %'],
            ['wastePastaSpongeLid', state.lang === 'ar' ? 'هادر غطاء إسفنج الباستا %' : state.lang === 'it' ? 'Scarto coperchio spugna %' : 'Pasta Sponge Lid Waste %'],
            ['wastePastaLiquid', state.lang === 'ar' ? 'هادر سائل الباستا %' : state.lang === 'it' ? 'Scarto liquido pasta %' : 'Pasta Liquid Waste %'],
            ['lowStockPasta', state.lang === 'ar' ? '⚠️ حد التحذير للباستا (كرتونة)' : state.lang === 'it' ? '⚠️ Soglia scorte pasta (cartoni)' : '⚠️ Pasta Low-Stock Threshold (cartons)'],
          ].map(([k, label]) => (
            <div className="field" key={k}>
              <label>{label}</label>
              <input type="number" step="0.1" value={settings[k] ?? ''}
                onChange={e => setSetting(k, Number(e.target.value) || 0)} />
            </div>
          ))}
        </div>
        <button className="primary" onClick={saveSettings}>{T.save}</button>
      </div>

      {/* Companies */}
      <div className="card">
        <div className="flex-between">
          <h3 style={{ margin: 0 }}>🏢 {T.manage_companies}</h3>
          <button className="primary" onClick={() => setAddingCompany(true)}>+ {T.add_company}</button>
        </div>
        {state.companies.length === 0 ? (
          <div className="empty">{T.no_companies}</div>
        ) : (
          <div className="grid cols-3" style={{ marginTop: 14 }}>
            {state.companies.map(c => (
              <div key={c.id} className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <button className="danger ghost" style={{ padding: '4px 8px', marginInlineStart: 8 }} onClick={() => deleteCompany(c.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Employee of the month */}
      {employeeOfMonth && (
        <div className="card" style={{ borderColor: 'var(--yellow)', background: 'rgba(242,183,5,0.05)' }}>
          <div className="row" style={{ gap: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 36 }}>🏆</div>
            {employeeOfMonth.photo
              ? <img src={employeeOfMonth.photo} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--yellow)' }} />
              : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--panel2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>👤</div>}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {state.lang === 'ar' ? `أفضل موظف لشهر ${thisMonth}` : state.lang === 'it' ? `Miglior operaio di ${thisMonth}` : `Employee of the month ${thisMonth}`}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{employeeOfMonth.name}</div>
              <div>{Array.from({ length: 5 }).map((_, i) => <span key={i} style={{ fontSize: 16, color: i < getRating(employeeOfMonth) ? 'var(--yellow)' : 'var(--line)' }}>★</span>)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Workers */}
      <div className="card">
        <div className="flex-between">
          <h3 style={{ margin: 0 }}>👥 {state.lang === 'ar' ? 'إدارة العمال' : state.lang === 'it' ? 'Gestione operai' : 'Manage Workers'}</h3>
          <button className="primary" onClick={() => setAddingWorker(true)}>
            + {state.lang === 'ar' ? 'إضافة عامل' : state.lang === 'it' ? 'Aggiungi operaio' : 'Add Worker'}
          </button>
        </div>
        {(!state.workers || state.workers.length === 0) ? (
          <div className="empty">{state.lang === 'ar' ? 'لا يوجد عمال بعد' : state.lang === 'it' ? 'Nessun operaio ancora' : 'No workers yet'}</div>
        ) : (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>{state.lang === 'ar' ? 'اسم العامل' : state.lang === 'it' ? 'Nome operaio' : 'Worker Name'}</th>
                <th>🔒 PIN</th>
                <th>⏱ {state.lang === 'ar' ? 'ساعات الشهر' : state.lang === 'it' ? 'Ore mensili' : 'Monthly hrs'}</th>
                <th>⭐ {state.lang === 'ar' ? 'تقييم الشهر' : state.lang === 'it' ? 'Voto mese' : 'Month rating'}</th>
                <th>{T.actions}</th>
              </tr>
            </thead>
            <tbody>
              {state.workers.map(w => {
                const hrs = getMonthlyHours(w.id);
                const rating = getRating(w);
                return (
                  <tr key={w.id}>
                    <td style={{ fontWeight: 600 }}>{w.name}</td>
                    <td className="mono">{w.pin || '—'}</td>
                    <td className="mono" style={{ fontWeight: 700, color: hrs > 0 ? 'var(--green)' : 'var(--muted)' }}>
                      {hrs.toFixed(1)}h
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 1 }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} title={`${i + 1}`} style={{ cursor: 'pointer', fontSize: 18, color: i < rating ? 'var(--yellow)' : 'var(--line)' }}
                            onClick={() => setRating(w.id, i + 1 === rating ? 0 : i + 1)}>★</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setEditingWorker(w)}>
                          ✏️ {state.lang === 'ar' ? 'تعديل' : state.lang === 'it' ? 'Modifica' : 'Edit'}
                        </button>
                        <button style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setEditingWorkerPin(w)}>
                          🔒 PIN
                        </button>
                        <button className="danger ghost" style={{ padding: '4px 8px' }} onClick={() => deleteWorker(w.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {addingCompany && (
        <CompanyModal T={T} onClose={() => setAddingCompany(false)}
          onSave={company => { update({ companies: [...state.companies, company] }); toast(T.success_added); setAddingCompany(false); }} />
      )}
      {addingWorker && (
        <WorkerModal T={T} lang={state.lang} onClose={() => setAddingWorker(false)}
          onSave={worker => { update({ workers: [...(state.workers || []), worker] }); toast(T.success_added); setAddingWorker(false); }} />
      )}
      {editingWorker && (
        <WorkerModal T={T} lang={state.lang} worker={editingWorker} onClose={() => setEditingWorker(null)}
          onSave={worker => { update({ workers: workers.map(w => w.id === worker.id ? worker : w) }); toast(T.success_added); setEditingWorker(null); }} />
      )}
      {editingWorkerPin && (
        <EditPinModal lang={state.lang} T={T} worker={editingWorkerPin} onClose={() => setEditingWorkerPin(null)}
          onSave={pin => { update({ workers: (state.workers || []).map(w => w.id === editingWorkerPin.id ? { ...w, pin } : w) }); toast(T.success_added); setEditingWorkerPin(null); }} />
      )}
    </>
  );
}

/* ---- Change Password Card ---- */
function ChangePasswordCard({ T, state, update, toast }) {
  const [tab, setTab]       = useState('admin'); // 'admin' | 'worker'
  const [current, setCurrent] = useState('');
  const [next, setNext]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr]       = useState('');

  const effectiveAdmin  = state.adminPass  || ADMIN_PASS;
  const effectiveWorker = state.workerPass || WORKER_PASS;

  const save = () => {
    setErr('');
    const isAdmin = tab === 'admin';
    const expected = isAdmin ? effectiveAdmin : effectiveWorker;

    if (expected && current !== expected) { setErr(state.lang === 'ar' ? 'كلمة المرور الحالية غلط' : state.lang === 'it' ? 'Password attuale errata' : 'Current password is wrong'); return; }
    if (!next.trim()) { setErr(state.lang === 'ar' ? 'اكتب كلمة المرور الجديدة' : state.lang === 'it' ? 'Inserisci la nuova password' : 'Enter the new password'); return; }
    if (next !== confirm) { setErr(state.lang === 'ar' ? 'كلمتا المرور مش متطابقتين' : state.lang === 'it' ? 'Le password non coincidono' : 'Passwords do not match'); return; }

    update(isAdmin ? { adminPass: next } : { workerPass: next });
    toast(T.success_added);
    setCurrent(''); setNext(''); setConfirm('');
  };

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <h3>🔑 {state.lang === 'ar' ? 'تغيير كلمة المرور' : state.lang === 'it' ? 'Cambia password' : 'Change Password'}</h3>
      <div className="row" style={{ marginBottom: 14, gap: 8 }}>
        {['admin', 'worker'].map(t => (
          <button key={t} className={tab === t ? 'primary' : 'ghost'} style={{ flex: 1 }}
            onClick={() => { setTab(t); setErr(''); setCurrent(''); setNext(''); setConfirm(''); }}>
            {t === 'admin' ? T.role_admin : T.role_worker}
          </button>
        ))}
      </div>
      <div className="grid cols-3">
        <div className="field">
          <label>{state.lang === 'ar' ? 'كلمة المرور الحالية' : state.lang === 'it' ? 'Password attuale' : 'Current Password'}</label>
          <input type="password" placeholder="••••••" value={current}
            onChange={e => { setCurrent(e.target.value); setErr(''); }} />
        </div>
        <div className="field">
          <label>{state.lang === 'ar' ? 'كلمة المرور الجديدة' : state.lang === 'it' ? 'Nuova password' : 'New Password'}</label>
          <input type="password" placeholder="••••••" value={next}
            onChange={e => { setNext(e.target.value); setErr(''); }} />
        </div>
        <div className="field">
          <label>{state.lang === 'ar' ? 'تأكيد كلمة المرور' : state.lang === 'it' ? 'Conferma password' : 'Confirm Password'}</label>
          <input type="password" placeholder="••••••" value={confirm}
            onKeyDown={e => e.key === 'Enter' && save()}
            onChange={e => { setConfirm(e.target.value); setErr(''); }} />
        </div>
      </div>
      {err && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{err}</div>}
      <button className="primary" onClick={save}>{T.save}</button>
    </div>
  );
}

/* ---- Company Modal ---- */
function CompanyModal({ T, onClose, onSave }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const handleSave = () => {
    if (!name.trim()) { toast('—', true); return; }
    onSave({ id: uid(), name: name.trim() });
  };
  return (
    <Modal onClose={onClose} maxWidth={360}>
      <h3>{T.add_company}</h3>
      <div className="field">
        <label>{T.company_name}</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder={T.company_name} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={handleSave}>{T.save}</button>
      </div>
    </Modal>
  );
}

/* ---- Worker Modal (add + edit) ---- */
function WorkerModal({ T, lang, worker, onClose, onSave }) {
  const toast = useToast();
  const tr = (ar, it, en) => (lang === 'ar' ? ar : lang === 'it' ? it : en);
  const isEdit = !!worker;
  const [name, setName] = useState(worker?.name || '');
  const [pin, setPin] = useState(worker?.pin || '');
  const [photo, setPhoto] = useState(worker?.photo || '');
  const [details, setDetails] = useState(worker?.details || '');
  const [codiceFiscale, setCodiceFiscale] = useState(worker?.codiceFiscale || '');
  const [idCardPhoto, setIdCardPhoto] = useState(worker?.idCardPhoto || '');
  const [documents, setDocuments] = useState(worker?.documents || []);
  const photoRef = useRef();
  const idRef = useRef();
  const docRef = useRef();

  // shared image compressor (max edge px, jpeg quality)
  const compress = (file, max, cb) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', 0.72));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const addDoc = (file) => compress(file, 1000, (img) => setDocuments(d => [...d, { id: uid(), name: file.name?.slice(0, 40) || '', image: img }]));
  const delDoc = (id) => setDocuments(d => d.filter(x => x.id !== id));

  const handleSave = () => {
    if (!name.trim()) { toast(tr('الاسم مطلوب', 'Il nome è obbligatorio', 'Name is required'), true); return; }
    onSave({
      ...(worker || {}),
      id: worker?.id || uid(),
      name: name.trim(), pin: pin.trim(), photo, details: details.trim(),
      codiceFiscale: codiceFiscale.trim(), idCardPhoto, documents,
    });
  };

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <h3>{isEdit ? tr('تعديل العامل', 'Modifica operaio', 'Edit Worker') : tr('إضافة عامل جديد', 'Aggiungi nuovo operaio', 'Add New Worker')}</h3>
      <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => compress(e.target.files?.[0], 300, setPhoto)} />
      <input ref={idRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => compress(e.target.files?.[0], 1000, setIdCardPhoto)} />
      <input ref={docRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { addDoc(e.target.files?.[0]); e.target.value = ''; }} />

      <div className="row" style={{ gap: 12, marginBottom: 12, alignItems: 'center' }}>
        {photo
          ? <img src={photo} alt="" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--line)' }} />
          : <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--panel2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>👤</div>}
        <button onClick={() => photoRef.current?.click()}>📷 {tr('صورة العامل', 'Foto operaio', 'Worker Photo')}</button>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 12 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>{tr('اسم العامل', 'Nome operaio', 'Worker Name')}</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={tr('أحمد محمد...', 'Mario Rossi...', 'Mario Rossi...')} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>🔒 {tr('الرقم السري', 'Codice segreto', 'Secret PIN')}</label>
          <input value={pin} onChange={e => setPin(e.target.value)} placeholder={tr('مثال: 1234', 'es: 1234', 'e.g. 1234')} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>🆔 {tr('الكود الضريبي / رقم الهوية', 'Codice fiscale', 'Tax code / ID no.')}</label>
          <input value={codiceFiscale} onChange={e => setCodiceFiscale(e.target.value)} placeholder="RSSMRA80A01H501U" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>🪪 {tr('صورة البطاقة', "Foto carta d'identità", 'ID card photo')}</label>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            {idCardPhoto && <img src={idCardPhoto} alt="" style={{ width: 46, height: 30, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)' }} />}
            <button type="button" style={{ fontSize: 12 }} onClick={() => idRef.current?.click()}>📷 {tr('رفع', 'Carica', 'Upload')}</button>
            {idCardPhoto && <button type="button" className="danger ghost" style={{ fontSize: 12 }} onClick={() => setIdCardPhoto('')}>✕</button>}
          </div>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>{tr('تفاصيل (اختياري)', 'Dettagli (opzionale)', 'Details (optional)')}</label>
        <textarea value={details} onChange={e => setDetails(e.target.value)} style={{ minHeight: 50 }} placeholder={tr('تليفون، عنوان، ملاحظات...', 'Telefono, indirizzo, note...', 'Phone, address, notes...')} />
      </div>

      {/* Document images */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontWeight: 700 }}>📎 {tr('مستندات وصور خاصة بالعامل', 'Documenti / foto operaio', 'Worker documents / photos')}</label>
        <button type="button" className="primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => docRef.current?.click()}>
          + {tr('صورة', 'Immagine', 'Image')}
        </button>
      </div>
      {documents.length === 0 ? (
        <div className="empty" style={{ padding: 10, fontSize: 12 }}>{tr('لا توجد مستندات', 'Nessun documento', 'No documents')}</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {documents.map(doc => (
            <div key={doc.id} style={{ position: 'relative', width: 80 }}>
              <img src={doc.image} alt={doc.name} title={doc.name} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />
              <button type="button" className="danger" style={{ position: 'absolute', top: -6, insetInlineEnd: -6, borderRadius: '50%', width: 22, height: 22, padding: 0, fontSize: 12 }} onClick={() => delDoc(doc.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={handleSave}>{T.save}</button>
      </div>
    </Modal>
  );
}

/* ---- Edit PIN Modal ---- */
function EditPinModal({ lang, T, worker, onClose, onSave }) {
  const toast = useToast();
  const [pin, setPin] = useState(worker.pin || '');
  const tr = (ar, it, en) => (lang === 'ar' ? ar : lang === 'it' ? it : en);
  return (
    <Modal onClose={onClose} maxWidth={340}>
      <h3>🔒 {tr('تغيير الرقم السري', 'Cambia PIN', 'Change PIN')} — {worker.name}</h3>
      <div className="field">
        <label>{tr('الرقم السري الجديد', 'Nuovo PIN', 'New PIN')}</label>
        <input autoFocus value={pin} onChange={e => setPin(e.target.value)} placeholder={tr('مثال: 1234', 'es: 1234', 'e.g. 1234')} onKeyDown={e => e.key === 'Enter' && (pin.trim() ? onSave(pin.trim()) : toast('—', true))} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { if (pin.trim()) onSave(pin.trim()); else toast('—', true); }}>{T.save}</button>
      </div>
    </Modal>
  );
}

