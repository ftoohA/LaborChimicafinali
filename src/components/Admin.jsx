import { useState, useRef } from 'react';
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
  const [addingWorker, setAddingWorker] = useState(false);
  const [stockingPasta, setStockingPasta] = useState(null); // 'sponges' | 'spongeLids'
  const [editingPastaLiquid, setEditingPastaLiquid] = useState(null);
  const [stockingPastaLiquid, setStockingPastaLiquid] = useState(null);
  const [addingPastaBox, setAddingPastaBox] = useState(false);
  const [addingPastaLid, setAddingPastaLid] = useState(false);
  const [stockingPastaBox, setStockingPastaBox] = useState(null);
  const [stockingPastaLid, setStockingPastaLid] = useState(null);
  const [addingCarton, setAddingCarton] = useState(false);
  const [stockingCarton, setStockingCarton] = useState(null);

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

  const deleteWorker = (id) => {
    if (!confirm(T.confirm_delete)) return;
    update({ workers: (state.workers || []).filter(w => w.id !== id) });
    toast(T.deleted);
  };

  const deletePastaBox = (id) => {
    if (!confirm(state.lang === 'ar' ? 'هل أنت متأكد من الحذف؟' : state.lang === 'it' ? 'Sei sicuro di eliminare?' : 'Are you sure?')) return;
    update({ pastaBoxes: (state.pastaBoxes || []).filter(pb => pb.id !== id) });
    toast(state.lang === 'ar' ? 'تم الحذف' : state.lang === 'it' ? 'Eliminato' : 'Deleted');
  };

  const deletePastaLid = (id) => {
    if (!confirm(state.lang === 'ar' ? 'هل أنت متأكد من الحذف؟' : state.lang === 'it' ? 'Sei sicuro di eliminare?' : 'Are you sure?')) return;
    update({ pastaLids: (state.pastaLids || []).filter(pl => pl.id !== id) });
    toast(state.lang === 'ar' ? 'تم الحذف' : state.lang === 'it' ? 'Eliminato' : 'Deleted');
  };

  const addPastaBoxStock = (id, qty, reason) => {
    update({
      pastaBoxes: (state.pastaBoxes || []).map(pb =>
        pb.id !== id ? pb : { ...pb, stock: (pb.stock || 0) + qty }
      )
    });
    addLog({ type: 'pasta_box_stock_add', id, qty, reason, by: state.role });
    setStockingPastaBox(null);
  };

  const addPastaLidStock = (id, qty, reason) => {
    update({
      pastaLids: (state.pastaLids || []).map(pl =>
        pl.id !== id ? pl : { ...pl, stock: (pl.stock || 0) + qty }
      )
    });
    addLog({ type: 'pasta_lid_stock_add', id, qty, reason, by: state.role });
    setStockingPastaLid(null);
  };

  const addPastaStock = (field, qty, reason) => {
    const currentStock = state.pastaStock || { sponges: 0, spongeLids: 0 };
    update({
      pastaStock: {
        ...currentStock,
        [field]: (currentStock[field] || 0) + qty
      }
    });
    addLog({ type: 'pasta_stock_add', material: field, qty, reason, by: state.role });
    toast(T.success_added);
    setStockingPasta(null);
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

  const deletePastaLiquid = (id) => {
    if (!confirm(T.confirm_delete)) return;
    update({ pastaLiquids: (state.pastaLiquids || []).filter(pl => pl.id !== id) });
    toast(T.deleted);
  };

  const addCartonStock = (id, qty, reason) => {
    update({
      cartonTypes: (state.cartonTypes || []).map(c =>
        c.id !== id ? c : { ...c, stock: (c.stock || 0) + qty }
      ),
    });
    addLog({ type: 'carton_stock_add', id, qty, reason, by: state.role });
    toast(T.success_added);
    setStockingCarton(null);
  };

  const deleteCarton = (id) => {
    if (!confirm(T.confirm_delete)) return;
    update({ cartonTypes: (state.cartonTypes || []).filter(c => c.id !== id) });
    toast(T.deleted);
  };

  const saveCarton = (carton) => {
    update({ cartonTypes: [...(state.cartonTypes || []), carton] });
    addLog({ type: 'carton_added', name: carton.name, by: state.role });
    toast(T.success_added);
    setAddingCarton(false);
  };

  const addPastaLiquidStock = (id, qty, reason) => {
    update({
      pastaLiquids: (state.pastaLiquids || []).map(pl =>
        pl.id !== id ? pl : { ...pl, stock: (pl.stock || 0) + qty }
      ),
    });
    addLog({ type: 'pasta_liquid_stock_add', id, qty, reason, by: state.role });
    toast(T.success_added);
    setStockingPastaLiquid(null);
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
                <th>🔒 {state.lang === 'ar' ? 'الرقم السري' : state.lang === 'it' ? 'Codice' : 'PIN'}</th>
                <th>{T.actions}</th>
              </tr>
            </thead>
            <tbody>
              {state.workers.map(w => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 600 }}>{w.name}</td>
                  <td className="mono">{w.pin || '—'}</td>
                  <td>
                    <button className="danger ghost" style={{ padding: '4px 8px' }} onClick={() => deleteWorker(w.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Carton Warehouse */}
      <div className="card">
        <div className="flex-between">
          <h3 style={{ margin: 0 }}>📦 {state.lang === 'ar' ? 'مخزن الكراتين' : state.lang === 'it' ? 'Magazzino cartoni' : 'Carton Warehouse'}</h3>
          <button className="primary" onClick={() => setAddingCarton(true)}>+ {state.lang === 'ar' ? 'إضافة نوع كرتونة' : state.lang === 'it' ? 'Aggiungi tipo cartone' : 'Add Carton Type'}</button>
        </div>
        {(!state.cartonTypes || state.cartonTypes.length === 0) ? (
          <div className="empty">{state.lang === 'ar' ? 'لا توجد كراتين مضافة' : state.lang === 'it' ? 'Nessun cartone aggiunto' : 'No cartons added'}</div>
        ) : (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>{state.lang === 'ar' ? 'اسم الكرتونة' : state.lang === 'it' ? 'Nome cartone' : 'Carton Name'}</th>
                <th>{state.lang === 'ar' ? 'الحجم' : state.lang === 'it' ? 'Misura' : 'Size'}</th>
                <th>{state.lang === 'ar' ? 'المخزون' : state.lang === 'it' ? 'Stock' : 'Stock'}</th>
                <th>{state.lang === 'ar' ? 'هادر %' : state.lang === 'it' ? 'Scarto %' : 'Waste %'}</th>
                <th>{state.lang === 'ar' ? 'حد التحذير' : state.lang === 'it' ? 'Soglia avviso' : 'Low-Stock'}</th>
                <th>{T.actions}</th>
              </tr>
            </thead>
            <tbody>
              {(state.cartonTypes || []).map(c => {
                const low = (c.stock || 0) <= (c.lowStock || 0);
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td><span className="size-chip">{c.size || '—'}</span></td>
                    <td>
                      <span className="mono" style={{ fontWeight: 700, color: low ? 'var(--red)' : 'var(--green)' }}>
                        {(c.stock || 0).toLocaleString()}
                      </span>
                      {low && <span className="badge bad" style={{ marginInlineStart: 6 }}>⚠️ {state.lang === 'ar' ? 'منخفض' : state.lang === 'it' ? 'Basso' : 'Low'}</span>}
                    </td>
                    <td className="mono">{c.waste || 0}%</td>
                    <td className="mono">{c.lowStock || 0}</td>
                    <td>
                      <div className="row">
                        <button style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setStockingCarton(c)}>
                          + {state.lang === 'ar' ? 'إضافة مخزون' : state.lang === 'it' ? 'Aggiungi stock' : 'Add Stock'}
                        </button>
                        <button className="danger ghost" style={{ padding: '4px 8px' }} onClick={() => deleteCarton(c.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pasta Materials Stock */}
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>🧪 {state.lang === 'ar' ? 'مخزون خامات الباستا (Pasta Abrasiva)' : state.lang === 'it' ? 'Magazzino materie prime (Pasta Abrasiva)' : 'Pasta Abrasiva Materials Stock'}</h3>
        <div className="grid cols-2" style={{ gap: 12 }}>
          {[
            ['sponges', state.lang === 'ar' ? 'الإسفنج (Sponges)' : state.lang === 'it' ? 'Spugne' : 'Sponges', '🧽'],
            ['spongeLids', state.lang === 'ar' ? 'أغطية الإسفنج' : state.lang === 'it' ? 'Coperchi spugna' : 'Sponge Lids', '🧢'],
          ].map(([field, label, icon]) => {
            const stockVal = state.pastaStock?.[field] || 0;
            return (
              <div className="card" key={field} style={{ margin: 0, padding: 12, textAlign: 'center', background: 'var(--panel)' }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--yellow)', marginBottom: 8 }}>
                  {stockVal.toLocaleString()}
                </div>
                <button 
                  style={{ fontSize: 11, padding: '3px 8px', width: '100%' }}
                  onClick={() => setStockingPasta(field)}
                >
                  + {state.lang === 'ar' ? 'إضافة كمية' : state.lang === 'it' ? 'Aggiungi quantità' : 'Add Stock'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pasta Boxes */}
      <div className="card">
        <div className="flex-between">
          <h3 style={{ margin: 0 }}>📦 {state.lang === 'ar' ? 'إدارة علب الباستا' : state.lang === 'it' ? 'Gestione scatole pasta' : 'Manage Pasta Boxes'}</h3>
          <button className="primary" onClick={() => setAddingPastaBox(true)}>+ {state.lang === 'ar' ? 'إضافة علبة' : state.lang === 'it' ? 'Aggiungi scatola' : 'Add Box'}</button>
        </div>
        {(!state.pastaBoxes || state.pastaBoxes.length === 0) ? (
          <div className="empty">{state.lang === 'ar' ? 'لا توجد علب مضافة' : state.lang === 'it' ? 'Nessuna scatola aggiunta' : 'No boxes added'}</div>
        ) : (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>{state.lang === 'ar' ? 'اسم العلبة' : state.lang === 'it' ? 'Nome scatola' : 'Box Name'}</th>
                <th>{T.color}</th>
                <th>{T.size}</th>
                <th>{T.stock_count}</th>
                <th>{T.actions}</th>
              </tr>
            </thead>
            <tbody>
              {(state.pastaBoxes || []).map(pb => {
                const low = (pb.stock || 0) < state.settings.lowStock * 20;
                return (
                  <tr key={pb.id}>
                    <td style={{ fontWeight: 600 }}>{pb.name}</td>
                    <td><span className="color-chip">{pb.color || '—'}</span></td>
                    <td><span className="size-chip">{pb.size || '—'}</span></td>
                    <td>
                      <span className={`mono ${low ? 'bad' : ''}`} style={{ fontWeight: 700, color: low ? 'var(--red)' : 'var(--green)' }}>
                        {(pb.stock || 0).toLocaleString()}
                      </span>
                      <span className="smallmuted" style={{ marginInlineStart: 4 }}>{T.pieces}</span>
                    </td>
                    <td>
                      <div className="row">
                        <button style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setStockingPastaBox(pb)}>
                          + {state.lang === 'ar' ? 'إضافة مخزون' : state.lang === 'it' ? 'Aggiungi stock' : 'Add Stock'}
                        </button>
                        <button className="danger ghost" style={{ padding: '4px 8px' }} onClick={() => deletePastaBox(pb.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pasta Lids */}
      <div className="card">
        <div className="flex-between">
          <h3 style={{ margin: 0 }}>🔴 {state.lang === 'ar' ? 'إدارة أغطية الباستا' : state.lang === 'it' ? 'Gestione coperchi pasta' : 'Manage Pasta Lids'}</h3>
          <button className="primary" onClick={() => setAddingPastaLid(true)}>+ {state.lang === 'ar' ? 'إضافة غطاء' : state.lang === 'it' ? 'Aggiungi coperchio' : 'Add Lid'}</button>
        </div>
        {(!state.pastaLids || state.pastaLids.length === 0) ? (
          <div className="empty">{state.lang === 'ar' ? 'لا توجد أغطية مضافة' : state.lang === 'it' ? 'Nessun coperchio aggiunto' : 'No lids added'}</div>
        ) : (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>{state.lang === 'ar' ? 'اسم الغطاء' : state.lang === 'it' ? 'Nome coperchio' : 'Lid Name'}</th>
                <th>{T.color}</th>
                <th>{T.size}</th>
                <th>{T.stock_count}</th>
                <th>{T.actions}</th>
              </tr>
            </thead>
            <tbody>
              {(state.pastaLids || []).map(pl => {
                const low = (pl.stock || 0) < state.settings.lowStock * 20;
                return (
                  <tr key={pl.id}>
                    <td style={{ fontWeight: 600 }}>{pl.name}</td>
                    <td><span className="color-chip">{pl.color || '—'}</span></td>
                    <td><span className="size-chip">{pl.size || '—'}</span></td>
                    <td>
                      <span className={`mono ${low ? 'bad' : ''}`} style={{ fontWeight: 700, color: low ? 'var(--red)' : 'var(--green)' }}>
                        {(pl.stock || 0).toLocaleString()}
                      </span>
                      <span className="smallmuted" style={{ marginInlineStart: 4 }}>{T.pieces}</span>
                    </td>
                    <td>
                      <div className="row">
                        <button style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setStockingPastaLid(pl)}>
                          + {state.lang === 'ar' ? 'إضافة مخزون' : state.lang === 'it' ? 'Aggiungi stock' : 'Add Stock'}
                        </button>
                        <button className="danger ghost" style={{ padding: '4px 8px' }} onClick={() => deletePastaLid(pl.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pasta Liquids Stock */}
      <div className="card">
        <div className="flex-between">
          <h3 style={{ margin: 0 }}>🧪 {state.lang === 'ar' ? 'إدارة سوائل الباستا (Liquids)' : state.lang === 'it' ? 'Gestione liquidi pasta' : 'Manage Pasta Liquids'}</h3>
          <button className="primary" onClick={() => setEditingPastaLiquid(false)}>
            + {state.lang === 'ar' ? 'إضافة سائل باستا' : state.lang === 'it' ? 'Aggiungi liquido pasta' : 'Add Pasta Liquid'}
          </button>
        </div>
        {(!state.pastaLiquids || state.pastaLiquids.length === 0) ? (
          <div className="empty" style={{ marginTop: 14 }}>
            {state.lang === 'ar' ? 'لا توجد سوائل باستا مضافة بعد.' : state.lang === 'it' ? 'Nessun liquido pasta aggiunto ancora.' : 'No pasta liquids added yet.'}
          </div>
        ) : (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>{state.lang === 'ar' ? 'اسم السائل' : state.lang === 'it' ? 'Nome liquido' : 'Liquid Name'}</th>
                <th>{state.lang === 'ar' ? 'المخزون الحالي' : state.lang === 'it' ? 'Stock attuale' : 'Current Stock'}</th>
                <th>{state.lang === 'ar' ? 'المكونات (لكل 1 لتر)' : state.lang === 'it' ? 'Ingredienti (per 1L)' : 'Ingredients (per 1L)'}</th>
                <th>{state.lang === 'ar' ? 'خطوات التحضير اليدوية' : state.lang === 'it' ? 'Passaggi di preparazione' : 'Handwritten Steps'}</th>
                <th>{T.actions}</th>
              </tr>
            </thead>
            <tbody>
              {state.pastaLiquids.map(pl => (
                <tr key={pl.id}>
                  <td style={{ fontWeight: 600 }}>{pl.name}</td>
                  <td>
                    <span className="mono" style={{ fontWeight: 800, color: 'var(--yellow)', fontSize: 16 }}>
                      {(pl.stock || 0).toLocaleString()}
                    </span>
                    <span className="smallmuted" style={{ marginInlineStart: 4 }}>{state.lang === 'ar' ? 'لتر' : 'L'}</span>
                  </td>
                  <td>
                    {(!pl.recipe || pl.recipe.length === 0) ? (
                      <span className="smallmuted">—</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
                        {pl.recipe.map((ing, idx) => (
                          <div key={idx}>
                            • {ing.name}: <span className="mono" style={{ color: 'var(--green)' }}>{ing.ratio} {state.lang === 'ar' ? 'لتر/لتر' : 'L/L'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ maxWidth: 200, fontSize: 12 }}>
                    {pl.prepNotes ? (
                      <div style={{ whiteSpace: 'pre-wrap', maxHeight: 80, overflowY: 'auto', background: 'var(--panel)', padding: 6, borderRadius: 4 }}>
                        {pl.prepNotes}
                      </div>
                    ) : (
                      <span className="smallmuted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <button 
                        style={{ fontSize: 12, padding: '4px 10px' }} 
                        onClick={() => setStockingPastaLiquid(pl)}
                      >
                        + {state.lang === 'ar' ? 'تعبئة' : state.lang === 'it' ? 'Rifornisci' : 'Restock'}
                      </button>
                      <button 
                        className="ghost" 
                        style={{ fontSize: 12, padding: '4px 10px' }} 
                        onClick={() => setEditingPastaLiquid(pl)}
                      >
                        ⚙️
                      </button>
                      <button 
                        className="danger ghost" 
                        style={{ padding: '4px 8px' }} 
                        onClick={() => deletePastaLiquid(pl.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
      {addingWorker && (
        <WorkerModal 
          T={T} 
          lang={state.lang}
          onClose={() => setAddingWorker(false)}
          onSave={worker => { 
            update({ workers: [...(state.workers || []), worker] }); 
            toast(T.success_added); 
            setAddingWorker(false); 
          }} 
        />
      )}
      {stockingPasta && (
        <AddStockModal 
          T={T} 
          title={`${T.add_stock} — ${
            stockingPasta === 'sponges' ? (state.lang === 'ar' ? 'الإسفنج (Sponges)' : state.lang === 'it' ? 'Spugne' : 'Sponges') :
            (state.lang === 'ar' ? 'أغطية الإسفنج' : state.lang === 'it' ? 'Coperchi spugna' : 'Sponge Lids')
          }`}
          onClose={() => setStockingPasta(null)}
          onSave={(qty, reason) => addPastaStock(stockingPasta, qty, reason)} 
        />
      )}
      {editingPastaLiquid !== null && (
        <PastaLiquidModal
          existing={editingPastaLiquid || null}
          T={T}
          lang={state.lang}
          onClose={() => setEditingPastaLiquid(null)}
          onSave={liquid => {
            if (editingPastaLiquid) {
              update({ pastaLiquids: (state.pastaLiquids || []).map(pl => pl.id === liquid.id ? liquid : pl) });
            } else {
              update({ pastaLiquids: [...(state.pastaLiquids || []), liquid] });
            }
            toast(T.success_added);
            setEditingPastaLiquid(null);
          }}
        />
      )}
      {stockingPastaLiquid && (
        <AddStockModal
          T={T}
          title={`${state.lang === 'ar' ? 'تعبئة سائل باستا' : state.lang === 'it' ? 'Rifornisci liquido pasta' : 'Restock Pasta Liquid'} — ${stockingPastaLiquid.name}`}
          onClose={() => setStockingPastaLiquid(null)}
          onSave={(qty, reason) => addPastaLiquidStock(stockingPastaLiquid.id, qty, reason)}
        />
      )}
      {addingPastaBox && (
        <PastaMaterialModal 
          T={T} 
          lang={state.lang} 
          title={state.lang === 'ar' ? 'إضافة علبة باستا جديدة' : state.lang === 'it' ? 'Aggiungi nuova scatola pasta' : 'Add New Pasta Box'}
          labelName={state.lang === 'ar' ? 'اسم العلبة' : state.lang === 'it' ? 'Nome scatola' : 'Box Name'}
          onClose={() => setAddingPastaBox(false)}
          onSave={box => {
            update({ pastaBoxes: [...(state.pastaBoxes || []), box] });
            toast(T.success_added);
            setAddingPastaBox(false);
          }}
        />
      )}
      {addingPastaLid && (
        <PastaMaterialModal 
          T={T} 
          lang={state.lang} 
          title={state.lang === 'ar' ? 'إضافة غطاء باستا جديد' : state.lang === 'it' ? 'Aggiungi nuovo coperchio pasta' : 'Add New Pasta Lid'}
          labelName={state.lang === 'ar' ? 'اسم الغطاء' : state.lang === 'it' ? 'Nome coperchio' : 'Lid Name'}
          onClose={() => setAddingPastaLid(false)}
          onSave={lid => {
            update({ pastaLids: [...(state.pastaLids || []), lid] });
            toast(T.success_added);
            setAddingPastaLid(false);
          }}
        />
      )}
      {stockingPastaBox && (
        <AddStockModal 
          T={T} 
          title={`${state.lang === 'ar' ? 'تعبئة مخزون علب الباستا' : state.lang === 'it' ? 'Rifornisci scatole pasta' : 'Restock Pasta Box'} — ${stockingPastaBox.name}`}
          onClose={() => setStockingPastaBox(null)}
          onSave={(qty, reason) => addPastaBoxStock(stockingPastaBox.id, qty, reason)}
        />
      )}
      {stockingPastaLid && (
        <AddStockModal 
          T={T} 
          title={`${state.lang === 'ar' ? 'تعبئة مخزون أغطية الباستا' : state.lang === 'it' ? 'Rifornisci coperchi pasta' : 'Restock Pasta Lid'} — ${stockingPastaLid.name}`}
          onClose={() => setStockingPastaLid(null)}
          onSave={(qty, reason) => addPastaLidStock(stockingPastaLid.id, qty, reason)}
        />
      )}
      {addingCarton && (
        <CartonModal lang={state.lang} T={T} onClose={() => setAddingCarton(false)} onSave={saveCarton} />
      )}
      {stockingCarton && (
        <AddStockModal
          T={T}
          title={`${state.lang === 'ar' ? 'إضافة مخزون كرتونة' : state.lang === 'it' ? 'Aggiungi stock cartone' : 'Add Carton Stock'} — ${stockingCarton.name}`}
          onClose={() => setStockingCarton(null)}
          onSave={(qty, reason) => addCartonStock(stockingCarton.id, qty, reason)}
        />
      )}
    </>
  );
}

/* ---- Pasta Liquid Modal ---- */
function PastaLiquidModal({ existing, T, lang, onClose, onSave }) {
  const toast = useToast();
  const [name, setName] = useState(existing?.name || '');
  const [stock, setStock] = useState(existing?.stock ?? 0);
  const [prepNotes, setPrepNotes] = useState(existing?.prepNotes || '');
  const [recipe, setRecipe] = useState(
    (existing?.recipe || []).map(r => ({ id: r.id || uid(), name: r.name, ratio: r.ratio }))
  );

  const addIngredient = () => {
    setRecipe(r => [...r, { id: uid(), name: '', ratio: '' }]);
  };

  const updateIngredient = (id, field, value) => {
    setRecipe(r => r.map(x => x.id === id ? { ...x, [field]: value } : x));
  };

  const removeIngredient = (id) => {
    setRecipe(r => r.filter(x => x.id !== id));
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast(lang === 'ar' ? 'الاسم مطلوب' : lang === 'it' ? 'Il nome è obbligatorio' : 'Name is required', true);
      return;
    }
    const cleanedRecipe = recipe
      .filter(r => r.name.trim() && Number(r.ratio) > 0)
      .map(r => ({
        id: r.id,
        name: r.name.trim(),
        ratio: Number(r.ratio) || 0
      }));

    onSave({
      id: existing?.id || uid(),
      name: name.trim(),
      stock: Number(stock) || 0,
      prepNotes: prepNotes.trim(),
      recipe: cleanedRecipe
    });
  };

  return (
    <Modal onClose={onClose} maxWidth={500}>
      <h3>{existing ? (lang === 'ar' ? 'تعديل سائل باستا' : lang === 'it' ? 'Modifica liquido pasta' : 'Edit Pasta Liquid') : (lang === 'ar' ? 'إضافة سائل باستا جديد' : lang === 'it' ? 'Aggiungi nuovo liquido pasta' : 'Add New Pasta Liquid')}</h3>
      
      <div className="grid cols-2" style={{ marginBottom: 12 }}>
        <div className="field">
          <label>{lang === 'ar' ? 'اسم السائل' : lang === 'it' ? 'Nome liquido' : 'Liquid Name'}</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={lang === 'ar' ? 'باستا بيضاء...' : 'Pasta bianca...'} />
        </div>
        {!existing && (
          <div className="field">
            <label>{lang === 'ar' ? 'المخزون الابتدائي (لتر)' : lang === 'it' ? 'Stock iniziale (litri)' : 'Initial Stock (Liters)'}</label>
            <input type="number" value={stock} onChange={e => setStock(e.target.value)} />
          </div>
        )}
      </div>

      {/* Recipe */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 12 }}>
        <label style={{ fontWeight: 'bold' }}>🧪 {lang === 'ar' ? 'مكونات السائل ونسب التحضير (لكل 1 لتر)' : lang === 'it' ? 'Ingredienti e proporzioni (per 1 litro)' : 'Ingredients & Ratio (per 1 Liter)'}</label>
        <button type="button" className="primary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={addIngredient}>
          + {lang === 'ar' ? 'إضافة مكون' : lang === 'it' ? 'Aggiungi ingrediente' : 'Add Ingredient'}
        </button>
      </div>

      {recipe.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', fontStyle: 'italic', margin: '8px 0' }}>
          {lang === 'ar' ? 'لا توجد مكونات مضافة لطريقة التحضير بعد.' : lang === 'it' ? 'Nessun ingrediente aggiunto a questa ricetta.' : 'No ingredients added for this liquid yet.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {recipe.map((ing, idx) => (
            <div key={ing.id || idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="input-sm"
                style={{ flex: 2 }}
                placeholder={lang === 'ar' ? "اسم المكون (مثال: ماء)" : lang === 'it' ? "Nome ingrediente (es: acqua)" : "Ingredient name"}
                value={ing.name}
                onChange={e => updateIngredient(ing.id || idx, 'name', e.target.value)}
              />
              <input
                className="input-sm"
                type="number"
                step="any"
                style={{ flex: 1, minWidth: 80 }}
                placeholder={lang === 'ar' ? "النسبة" : lang === 'it' ? "Proporzione" : "Ratio"}
                value={ing.ratio}
                onChange={e => updateIngredient(ing.id || idx, 'ratio', e.target.value)}
              />
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', width: 45 }}>{lang === 'ar' ? 'لتر/لتر' : 'L/L'}</span>
              <button
                type="button"
                className="ghost"
                style={{ color: 'var(--red)', padding: '4px 8px' }}
                onClick={() => removeIngredient(ing.id || idx)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Handwritten instructions prepNotes */}
      <div className="field" style={{ marginTop: 14 }}>
        <label style={{ fontWeight: 'bold' }}>📝 {lang === 'ar' ? 'خطوات التحضير اليدوية (للكيميائي)' : lang === 'it' ? 'Passaggi di preparazione (per il chimico)' : 'Handwritten Preparation Steps (for Chemist)'}</label>
        <textarea
          value={prepNotes}
          onChange={e => setPrepNotes(e.target.value)}
          placeholder={lang === 'ar' ? 'اكتب خطوات التحضير بالتفصيل هنا ليقرأها الكيميائي...' : lang === 'it' ? 'Scrivi qui i passaggi dettagliati per il chimico...' : 'Write detailed manual steps for the chemist here...'}
          style={{ minHeight: 80 }}
        />
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={handleSave}>{T.save}</button>
      </div>
    </Modal>
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
          <input autoFocus value={f.color} onChange={e => set('color', e.target.value)} placeholder="nero / blu ..." />
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
          <input autoFocus value={f.color} onChange={e => set('color', e.target.value)} placeholder="Normale /con beccuccio ..." />
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
          <label>{T.basket_name} ("Opzionale")</label>
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

/* ---- Carton Modal ---- */
function CartonModal({ T, lang, onClose, onSave }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', size: '', stock: 0, lowStock: 0, waste: 0 });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const handleSave = () => {
    if (!f.name.trim()) {
      toast(lang === 'ar' ? 'الاسم مطلوب' : lang === 'it' ? 'Il nome è obbligatorio' : 'Name is required', true);
      return;
    }
    onSave({
      id: uid(),
      name: f.name.trim(),
      size: f.size.trim(),
      stock: Number(f.stock) || 0,
      lowStock: Number(f.lowStock) || 0,
      waste: Number(f.waste) || 0,
    });
  };

  return (
    <Modal onClose={onClose} maxWidth={420}>
      <h3>📦 {lang === 'ar' ? 'إضافة نوع كرتونة' : lang === 'it' ? 'Aggiungi tipo cartone' : 'Add Carton Type'}</h3>
      <div className="grid cols-2">
        <div className="field">
          <label>{lang === 'ar' ? 'اسم الكرتونة' : lang === 'it' ? 'Nome cartone' : 'Carton Name'}</label>
          <input autoFocus value={f.name} onChange={e => set('name', e.target.value)} placeholder={lang === 'ar' ? 'كرتونة...' : 'Cartone...'} />
        </div>
        <div className="field">
          <label>{lang === 'ar' ? 'الحجم (مثال: 1L)' : lang === 'it' ? 'Misura (es: 1L)' : 'Size (e.g. 1L)'}</label>
          <input value={f.size} onChange={e => set('size', e.target.value)} placeholder="1L / 5L ..." />
        </div>
        <div className="field">
          <label>{lang === 'ar' ? 'المخزون الابتدائي' : lang === 'it' ? 'Stock iniziale' : 'Initial Stock'}</label>
          <input type="number" value={f.stock} onChange={e => set('stock', e.target.value)} />
        </div>
        <div className="field">
          <label>{lang === 'ar' ? 'هادر %' : lang === 'it' ? 'Scarto %' : 'Waste %'}</label>
          <input type="number" value={f.waste} onChange={e => set('waste', e.target.value)} />
        </div>
        <div className="field">
          <label>{lang === 'ar' ? 'حد التحذير' : lang === 'it' ? 'Soglia avviso' : 'Low-Stock Threshold'}</label>
          <input type="number" value={f.lowStock} onChange={e => set('lowStock', e.target.value)} />
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={handleSave}>{T.save}</button>
      </div>
    </Modal>
  );
}

/* ---- Worker Modal ---- */
function WorkerModal({ T, lang, onClose, onSave }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [photo, setPhoto] = useState('');
  const [details, setDetails] = useState('');
  const fileRef = useRef();

  const handlePhoto = (file) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 300;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      setPhoto(canvas.toDataURL('image/jpeg', 0.75));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast(lang === 'ar' ? 'الاسم مطلوب' : lang === 'it' ? 'Il nome è obbligatorio' : 'Name is required', true);
      return;
    }
    onSave({ id: uid(), name: name.trim(), pin: pin.trim(), photo, details: details.trim() });
  };

  return (
    <Modal onClose={onClose} maxWidth={380}>
      <h3>{lang === 'ar' ? 'إضافة عامل جديد' : lang === 'it' ? 'Aggiungi nuovo operaio' : 'Add New Worker'}</h3>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handlePhoto(e.target.files && e.target.files[0])} />
      <div className="row" style={{ gap: 12, marginBottom: 12, alignItems: 'center' }}>
        {photo
          ? <img src={photo} alt="" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--line)' }} />
          : <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--panel2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>👤</div>}
        <button onClick={() => fileRef.current && fileRef.current.click()}>📷 {lang === 'ar' ? 'صورة العامل' : lang === 'it' ? 'Foto operaio' : 'Worker Photo'}</button>
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>{lang === 'ar' ? 'اسم العامل' : lang === 'it' ? 'Nome operaio' : 'Worker Name'}</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={lang === 'ar' ? 'أحمد محمد...' : 'Mario Rossi...'} />
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>🔒 {lang === 'ar' ? 'الرقم السري (لتسجيل الوقت)' : lang === 'it' ? 'Codice segreto (per timbratura)' : 'Secret PIN (for time tracking)'}</label>
        <input value={pin} onChange={e => setPin(e.target.value)} placeholder={lang === 'ar' ? 'مثال: 1234' : 'es: 1234'} />
      </div>
      <div className="field" style={{ marginBottom: 16 }}>
        <label>{lang === 'ar' ? 'تفاصيل (اختياري)' : lang === 'it' ? 'Dettagli (opzionale)' : 'Details (optional)'}</label>
        <textarea value={details} onChange={e => setDetails(e.target.value)} style={{ minHeight: 50 }} placeholder={lang === 'ar' ? 'تليفون، عنوان، ملاحظات...' : lang === 'it' ? 'Telefono, indirizzo, note...' : 'Phone, address, notes...'} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={handleSave}>{T.save}</button>
      </div>
    </Modal>
  );
}

/* ---- Pasta Material Modal ---- */
function PastaMaterialModal({ T, lang, title, labelName, onClose, onSave }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', color: '', size: '', stock: 0 });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const autoName = () => {
    const parts = [f.color, f.size].filter(Boolean);
    return parts.join(' - ');
  };

  const handleSave = () => {
    const name = f.name.trim() || autoName();
    if (!name) { toast('—', true); return; }
    onSave({ id: uid(), name, color: f.color.trim(), size: f.size.trim(), stock: Number(f.stock) || 0 });
  };

  return (
    <Modal onClose={onClose} maxWidth={400}>
      <h3>{title}</h3>
      <div className="grid cols-2">
        <div className="field">
          <label>{T.color}</label>
          <input autoFocus value={f.color} onChange={e => set('color', e.target.value)} placeholder="nero / blu ..." />
        </div>
        <div className="field">
          <label>{T.size}</label>
          <input value={f.size} onChange={e => set('size', e.target.value)} placeholder="5L / 10L ..." />
        </div>
        <div className="field">
          <label>{T.stock_count}</label>
          <input type="number" value={f.stock} onChange={e => set('stock', e.target.value)} />
        </div>
        <div className="field">
          <label>{labelName} ({lang === 'ar' ? 'اختياري' : lang === 'it' ? 'opzionale' : 'optional'})</label>
          <input value={f.name} onChange={e => set('name', e.target.value)} placeholder={autoName() || `${labelName}...`} />
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={handleSave}>{T.save}</button>
      </div>
    </Modal>
  );
}
