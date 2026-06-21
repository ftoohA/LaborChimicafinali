import { useState } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { I18N, ADMIN_PASS, WORKER_PASS } from '../i18n';
import { uid } from '../helpers';
import Modal from './Modal';

export default function Admin() {
  const { state, update, addLog } = useStore();
  const T = I18N[state.lang];
  const toast = useToast();

  const [settings, setSettings] = useState({ ...state.settings });
  const [addingCover, setAddingCover] = useState(false);
  const [addingBasket, setAddingBasket] = useState(false);
  const [stockingCover, setStockingCover] = useState(null);
  const [stockingBasket, setStockingBasket] = useState(null);
  const [addingCompany, setAddingCompany] = useState(false);

  const setSetting = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const saveSettings = () => {
    update({ settings });
    addLog({ type: 'settings_updated', by: state.role });
    toast(T.success_added);
  };

  const deleteCover = (id) => {
    if (!confirm(T.confirm_delete)) return;
    update({ covers: state.covers.filter(c => c.id !== id) });
    toast(T.deleted);
  };

  const deleteBasket = (id) => {
    if (!confirm(T.confirm_delete)) return;
    update({ baskets: state.baskets.filter(b => b.id !== id) });
    toast(T.deleted);
  };

  const deleteCompany = (id) => {
    if (!confirm(T.confirm_delete)) return;
    update({ companies: state.companies.filter(c => c.id !== id) });
    toast(T.deleted);
  };

  const addCoverStock = (id, qty, reason) => {
    update({
      covers: state.covers.map(c =>
        c.id !== id ? c : { ...c, stock: (c.stock || 0) + qty }
      ),
    });
    addLog({ type: 'cover_stock_add', id, qty, reason, by: state.role });
    toast(T.success_added);
    setStockingCover(null);
  };

  const addBasketStock = (id, qty, reason) => {
    update({
      baskets: state.baskets.map(b =>
        b.id !== id ? b : { ...b, stock: (b.stock || 0) + qty }
      ),
    });
    addLog({ type: 'basket_stock_add', id, qty, reason, by: state.role });
    toast(T.success_added);
    setStockingBasket(null);
  };

  return (
    <>
      {/* Change Password */}
      <ChangePasswordCard T={T} state={state} update={update} toast={toast} />

      {/* Settings */}
      <div className="card">
        <h3>{T.settings}</h3>
        <div className="grid cols-4">
          {[
            ['wasteTicket', T.waste_ticket],
            ['wasteCap', T.waste_cap],
            ['wasteJerrican', T.waste_jerrican],
            ['lowStock', T.low_stock_threshold],
          ].map(([k, label]) => (
            <div className="field" key={k}>
              <label>{label}</label>
              <input type="number" step="0.1" value={settings[k]}
                onChange={e => setSetting(k, Number(e.target.value) || 0)} />
            </div>
          ))}
        </div>
        <button className="primary" onClick={saveSettings}>{T.save}</button>
      </div>

      {/* Covers */}
      <div className="card">
        <div className="flex-between">
          <h3 style={{ margin: 0 }}>🎩 {T.manage_covers}</h3>
          <button className="primary" onClick={() => setAddingCover(true)}>+ {T.add_cover}</button>
        </div>
        {state.covers.length === 0 ? (
          <div className="empty">{T.no_covers}</div>
        ) : (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>{T.cover_name}</th>
                <th>{T.cover_type}</th>
                <th>{T.color}</th>
                <th>{T.size}</th>
                <th>{T.stock_count}</th>
                <th>{T.actions}</th>
              </tr>
            </thead>
            <tbody>
              {state.covers.map(c => {
                const low = (c.stock || 0) < state.settings.lowStock * 20;
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>
                      <span className={`badge ${c.coverType === 'front' ? 'blue' : 'warn'}`}>
                        {c.coverType === 'front' ? T.front_cover : T.back_cover}
                      </span>
                    </td>
                    <td><span className="color-chip">{c.color || '—'}</span></td>
                    <td><span className="size-chip">{c.size || '—'}</span></td>
                    <td>
                      <span className={`mono ${low ? 'bad' : ''}`} style={{ fontWeight: 700, color: low ? 'var(--red)' : 'var(--green)' }}>
                        {(c.stock || 0).toLocaleString()}
                      </span>
                      <span className="smallmuted" style={{ marginInlineStart: 4 }}>{T.pieces}</span>
                    </td>
                    <td>
                      <div className="row">
                        <button style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setStockingCover(c)}>
                          + {T.add_cover_stock}
                        </button>
                        <button className="danger ghost" style={{ padding: '4px 8px' }} onClick={() => deleteCover(c.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Baskets */}
      <div className="card">
        <div className="flex-between">
          <h3 style={{ margin: 0 }}>🪣 {T.manage_baskets}</h3>
          <button className="primary" onClick={() => setAddingBasket(true)}>+ {T.add_basket}</button>
        </div>
        {state.baskets.length === 0 ? (
          <div className="empty">{T.no_baskets}</div>
        ) : (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>{T.basket_name}</th>
                <th>{T.color}</th>
                <th>{T.size}</th>
                <th>{T.stock_count}</th>
                <th>{T.actions}</th>
              </tr>
            </thead>
            <tbody>
              {state.baskets.map(b => {
                const low = (b.stock || 0) < state.settings.lowStock * 5;
                return (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{b.name}</td>
                    <td><span className="color-chip">{b.color || '—'}</span></td>
                    <td><span className="size-chip">{b.size || '—'}</span></td>
                    <td>
                      <span className="mono" style={{ fontWeight: 700, color: low ? 'var(--red)' : 'var(--green)' }}>
                        {(b.stock || 0).toLocaleString()}
                      </span>
                      <span className="smallmuted" style={{ marginInlineStart: 4 }}>{T.pieces}</span>
                    </td>
                    <td>
                      <div className="row">
                        <button style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setStockingBasket(b)}>
                          + {T.add_basket_stock}
                        </button>
                        <button className="danger ghost" style={{ padding: '4px 8px' }} onClick={() => deleteBasket(b.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
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

      {/* Modals */}
      {addingCover && (
        <CoverModal T={T} onClose={() => setAddingCover(false)}
          onSave={cover => { update({ covers: [...state.covers, cover] }); toast(T.success_added); setAddingCover(false); }} />
      )}
      {addingBasket && (
        <BasketModal T={T} onClose={() => setAddingBasket(false)}
          onSave={basket => { update({ baskets: [...state.baskets, basket] }); toast(T.success_added); setAddingBasket(false); }} />
      )}
      {stockingCover && (
        <AddStockModal T={T} title={`${T.add_cover_stock} — ${stockingCover.name}`}
          onClose={() => setStockingCover(null)}
          onSave={(qty, reason) => addCoverStock(stockingCover.id, qty, reason)} />
      )}
      {stockingBasket && (
        <AddStockModal T={T} title={`${T.add_basket_stock} — ${stockingBasket.name}`}
          onClose={() => setStockingBasket(null)}
          onSave={(qty, reason) => addBasketStock(stockingBasket.id, qty, reason)} />
      )}
      {addingCompany && (
        <CompanyModal T={T} onClose={() => setAddingCompany(false)}
          onSave={company => { update({ companies: [...state.companies, company] }); toast(T.success_added); setAddingCompany(false); }} />
      )}
    </>
  );
}

/* ---- Cover Modal ---- */
function CoverModal({ T, onClose, onSave }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', coverType: 'front', color: '', size: '', stock: 0 });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const autoName = () => {
    const parts = [f.color, f.size, f.coverType === 'front' ? T.front_cover : T.back_cover].filter(Boolean);
    return parts.join(' - ');
  };

  const handleSave = () => {
    const name = f.name.trim() || autoName();
    if (!name) { toast('—', true); return; }
    onSave({ id: uid(), name, coverType: f.coverType, color: f.color.trim(), size: f.size.trim(), stock: Number(f.stock) || 0 });
  };

  return (
    <Modal onClose={onClose} maxWidth={400}>
      <h3>{T.add_cover}</h3>
      <div className="grid cols-2">
        <div className="field">
          <label>{T.color}</label>
          <input autoFocus value={f.color} onChange={e => set('color', e.target.value)} placeholder="أحمر / أزرق ..." />
        </div>
        <div className="field">
          <label>{T.size}</label>
          <input value={f.size} onChange={e => set('size', e.target.value)} placeholder="5L / 10L ..." />
        </div>
        <div className="field">
          <label>{T.cover_type}</label>
          <select value={f.coverType} onChange={e => set('coverType', e.target.value)}>
            <option value="front">{T.front_cover}</option>
            <option value="back">{T.back_cover}</option>
          </select>
        </div>
        <div className="field">
          <label>{T.initial_stock} ({T.pieces})</label>
          <input type="number" value={f.stock} onChange={e => set('stock', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>{T.cover_name} ({T.no_cover.includes('بدون') ? 'اختياري - يُولَّد تلقائياً' : 'optional - auto-generated'})</label>
        <input value={f.name} onChange={e => set('name', e.target.value)}
          placeholder={autoName() || `${T.cover_name}...`} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={handleSave}>{T.save}</button>
      </div>
    </Modal>
  );
}

/* ---- Basket Modal ---- */
function BasketModal({ T, onClose, onSave }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', color: '', size: '', stock: 0 });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const autoName = () => [f.color, f.size].filter(Boolean).join(' - ');

  const handleSave = () => {
    const name = f.name.trim() || autoName();
    if (!name) { toast('—', true); return; }
    onSave({ id: uid(), name, color: f.color.trim(), size: f.size.trim(), stock: Number(f.stock) || 0 });
  };

  return (
    <Modal onClose={onClose} maxWidth={400}>
      <h3>{T.add_basket}</h3>
      <div className="grid cols-2">
        <div className="field">
          <label>{T.color}</label>
          <input autoFocus value={f.color} onChange={e => set('color', e.target.value)} placeholder="شفاف / أزرق ..." />
        </div>
        <div className="field">
          <label>{T.size}</label>
          <input value={f.size} onChange={e => set('size', e.target.value)} placeholder="5L / 10L ..." />
        </div>
        <div className="field">
          <label>{T.initial_stock} ({T.pieces})</label>
          <input type="number" value={f.stock} onChange={e => set('stock', e.target.value)} />
        </div>
        <div className="field">
          <label>{T.basket_name} (اختياري)</label>
          <input value={f.name} onChange={e => set('name', e.target.value)} placeholder={autoName() || `${T.basket_name}...`} />
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={handleSave}>{T.save}</button>
      </div>
    </Modal>
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

    if (expected && current !== expected) { setErr('كلمة المرور الحالية غلط'); return; }
    if (!next.trim()) { setErr('اكتب كلمة المرور الجديدة'); return; }
    if (next !== confirm) { setErr('كلمتا المرور مش متطابقتين'); return; }

    update(isAdmin ? { adminPass: next } : { workerPass: next });
    toast(T.success_added);
    setCurrent(''); setNext(''); setConfirm('');
  };

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <h3>🔑 تغيير كلمة المرور</h3>
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
          <label>كلمة المرور الحالية</label>
          <input type="password" placeholder="••••••" value={current}
            onChange={e => { setCurrent(e.target.value); setErr(''); }} />
        </div>
        <div className="field">
          <label>كلمة المرور الجديدة</label>
          <input type="password" placeholder="••••••" value={next}
            onChange={e => { setNext(e.target.value); setErr(''); }} />
        </div>
        <div className="field">
          <label>تأكيد كلمة المرور</label>
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

/* ---- Add Stock Modal (shared for cover & basket) ---- */
function AddStockModal({ T, title, onClose, onSave }) {
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('');
  return (
    <Modal onClose={onClose} maxWidth={360}>
      <h3>{title}</h3>
      <div className="field">
        <label>{T.qty} ({T.pieces})</label>
        <input autoFocus type="number" value={qty} onChange={e => setQty(Number(e.target.value) || 0)} />
      </div>
      <div className="field">
        <label>{T.reason}</label>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder={T.reason} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { if (qty > 0) onSave(qty, reason); }}>{T.confirm}</button>
      </div>
    </Modal>
  );
}
