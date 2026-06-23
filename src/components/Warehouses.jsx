import { useState } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { I18N } from '../i18n';
import { uid } from '../helpers';
import Modal from './Modal';

const tr = (L, ar, it, en) => (L === 'ar' ? ar : L === 'it' ? it : en);
const unitLabel = (L, u) => (u === 'liter' ? tr(L, 'لتر', 'Litri', 'Liters') : u === 'carton' ? tr(L, 'كرتونة', 'Cartoni', 'Cartons') : tr(L, 'قطعة', 'Pezzi', 'Pieces'));

export default function Warehouses() {
  const { state, update, addLog } = useStore();
  const T = I18N[state.lang];
  const L = state.lang;
  const toast = useToast();
  const isAdmin = state.role === 'admin';

  // Custom warehouse state
  const [creating, setCreating] = useState(false);
  const [addingItem, setAddingItem] = useState(null);
  const [restock, setRestock] = useState(null);

  // Built-in add modals
  const [addingCover, setAddingCover] = useState(false);
  const [addingBasket, setAddingBasket] = useState(false);
  const [addingCarton, setAddingCarton] = useState(false);
  const [addingPastaBox, setAddingPastaBox] = useState(false);
  const [addingPastaLid, setAddingPastaLid] = useState(false);
  const [editingPastaLiquid, setEditingPastaLiquid] = useState(null); // null | false | liquid obj

  // ---- custom warehouse ops ----
  const warehouses = state.warehouses || [];
  const saveWh = (next) => update({ warehouses: next });

  const createWarehouse = (name, unit) => {
    saveWh([...warehouses, { id: uid(), name, unit, items: [] }]);
    addLog({ type: 'warehouse_created', name, by: state.role });
    toast(T.success_added);
    setCreating(false);
  };
  const deleteWarehouse = (id) => {
    if (!confirm(T.confirm_delete)) return;
    saveWh(warehouses.filter(w => w.id !== id));
    toast(T.deleted);
  };
  const addItem = (whId, item) => {
    saveWh(warehouses.map(w => w.id !== whId ? w : { ...w, items: [...(w.items || []), item] }));
    addLog({ type: 'warehouse_item_added', name: item.name, by: state.role });
    toast(T.success_added);
    setAddingItem(null);
  };
  const deleteItem = (whId, itemId) => {
    if (!confirm(T.confirm_delete)) return;
    saveWh(warehouses.map(w => w.id !== whId ? w : { ...w, items: (w.items || []).filter(i => i.id !== itemId) }));
    toast(T.deleted);
  };
  const restockItem = (whId, itemId, qty, reason) => {
    const wh = warehouses.find(w => w.id === whId);
    const item = wh?.items.find(i => i.id === itemId);
    saveWh(warehouses.map(w => w.id !== whId ? w : { ...w, items: w.items.map(i => i.id !== itemId ? i : { ...i, stock: (i.stock || 0) + qty }) }));
    addLog({ type: 'warehouse_stock_add', warehouse: wh?.name, name: item?.name, qty, reason, by: state.role });
    toast(T.success_added);
    setRestock(null);
  };

  // ---- built-in ops ----
  const deleteCover = (id) => { if (!confirm(T.confirm_delete)) return; update({ covers: state.covers.filter(c => c.id !== id) }); toast(T.deleted); };
  const deleteBasket = (id) => { if (!confirm(T.confirm_delete)) return; update({ baskets: state.baskets.filter(b => b.id !== id) }); toast(T.deleted); };
  const deleteCarton = (id) => { if (!confirm(T.confirm_delete)) return; update({ cartonTypes: (state.cartonTypes || []).filter(c => c.id !== id) }); toast(T.deleted); };
  const deletePastaBox = (id) => { if (!confirm(T.confirm_delete)) return; update({ pastaBoxes: (state.pastaBoxes || []).filter(p => p.id !== id) }); toast(T.deleted); };
  const deletePastaLid = (id) => { if (!confirm(T.confirm_delete)) return; update({ pastaLids: (state.pastaLids || []).filter(p => p.id !== id) }); toast(T.deleted); };
  const deletePastaLiquid = (id) => { if (!confirm(T.confirm_delete)) return; update({ pastaLiquids: (state.pastaLiquids || []).filter(p => p.id !== id) }); toast(T.deleted); };

  const restockBuiltin = (key, itemId, qty, reason) => {
    const arr = state[key] || [];
    const item = arr.find(i => i.id === itemId);
    update({ [key]: arr.map(i => i.id !== itemId ? i : { ...i, stock: (i.stock || 0) + qty }) });
    addLog({ type: `${key}_stock_add`, id: itemId, name: item?.name, qty, reason, by: state.role });
    toast(T.success_added);
    setRestock(null);
  };

  const Item = ({ name, size, stock, low, unit, onRestock, onDelete }) => (
    <tr>
      <td style={{ fontWeight: 600 }}>{name}{size ? <span className="size-chip" style={{ marginInlineStart: 6 }}>{size}</span> : null}</td>
      <td>
        <span className="mono" style={{ fontWeight: 700, color: low ? 'var(--red)' : 'var(--green)' }}>{(stock || 0).toLocaleString()}</span>
        <span className="smallmuted" style={{ marginInlineStart: 4 }}>{unitLabel(L, unit)}</span>
        {low && <span className="badge bad" style={{ marginInlineStart: 6 }}>⚠️ {tr(L, 'منخفض', 'Basso', 'Low')}</span>}
      </td>
      {isAdmin && (
        <td>
          <div className="row" style={{ gap: 6 }}>
            <button style={{ fontSize: 12, padding: '4px 10px' }} onClick={onRestock}>+ {tr(L, 'تعبئة', 'Rifornisci', 'Restock')}</button>
            {onDelete && <button className="danger ghost" style={{ padding: '4px 8px' }} onClick={onDelete}>✕</button>}
          </div>
        </td>
      )}
    </tr>
  );

  // built-in warehouse definitions with add handler
  const builtins = [
    {
      key: 'cartonTypes', icon: '📦', title: tr(L, 'الكراتين', 'Cartoni', 'Cartons'), unit: 'piece',
      addLabel: tr(L, 'إضافة كرتونة', 'Aggiungi cartone', 'Add Carton'), onAdd: () => setAddingCarton(true),
      renderRow: (it) => <Item key={it.id} name={it.name} size={it.size} stock={it.stock} low={(it.stock || 0) <= (it.lowStock || 0)} unit="piece"
        onRestock={() => setRestock({ builtinKey: 'cartonTypes', itemId: it.id, name: it.name, unit: 'piece' })} onDelete={isAdmin ? () => deleteCarton(it.id) : null} />,
    },
    {
      key: 'covers', icon: '🎩', title: tr(L, 'الغطاءات', 'Coperchi', 'Covers'), unit: 'piece',
      addLabel: tr(L, 'إضافة غطاء', 'Aggiungi coperchio', 'Add Cover'), onAdd: () => setAddingCover(true),
      renderRow: (it) => <Item key={it.id} name={it.name} size={it.size} stock={it.stock} low={(it.stock || 0) <= (state.settings.lowStock || 5)} unit="piece"
        onRestock={() => setRestock({ builtinKey: 'covers', itemId: it.id, name: it.name, unit: 'piece' })} onDelete={isAdmin ? () => deleteCover(it.id) : null} />,
    },
    {
      key: 'baskets', icon: '🪣', title: tr(L, 'الجراكن', 'Taniche', 'Jerricans'), unit: 'piece',
      addLabel: tr(L, 'إضافة جركن', 'Aggiungi tanica', 'Add Jerrican'), onAdd: () => setAddingBasket(true),
      renderRow: (it) => <Item key={it.id} name={it.name} size={it.size} stock={it.stock} low={(it.stock || 0) <= (state.settings.lowStock || 5)} unit="piece"
        onRestock={() => setRestock({ builtinKey: 'baskets', itemId: it.id, name: it.name, unit: 'piece' })} onDelete={isAdmin ? () => deleteBasket(it.id) : null} />,
    },
    {
      key: 'pastaBoxes', icon: '📦', title: tr(L, 'علب الباستا', 'Scatole pasta', 'Pasta Boxes'), unit: 'piece',
      addLabel: tr(L, 'إضافة علبة', 'Aggiungi scatola', 'Add Box'), onAdd: () => setAddingPastaBox(true),
      renderRow: (it) => <Item key={it.id} name={it.name} size={it.size} stock={it.stock} low={(it.stock || 0) <= (state.settings.lowStock || 5)} unit="piece"
        onRestock={() => setRestock({ builtinKey: 'pastaBoxes', itemId: it.id, name: it.name, unit: 'piece' })} onDelete={isAdmin ? () => deletePastaBox(it.id) : null} />,
    },
    {
      key: 'pastaLids', icon: '🔴', title: tr(L, 'أغطية الباستا', 'Coperchi pasta', 'Pasta Lids'), unit: 'piece',
      addLabel: tr(L, 'إضافة غطاء', 'Aggiungi coperchio', 'Add Lid'), onAdd: () => setAddingPastaLid(true),
      renderRow: (it) => <Item key={it.id} name={it.name} size={it.size} stock={it.stock} low={(it.stock || 0) <= (state.settings.lowStock || 5)} unit="piece"
        onRestock={() => setRestock({ builtinKey: 'pastaLids', itemId: it.id, name: it.name, unit: 'piece' })} onDelete={isAdmin ? () => deletePastaLid(it.id) : null} />,
    },
    {
      key: 'pastaLiquids', icon: '🧪', title: tr(L, 'سوائل الباستا', 'Liquidi pasta', 'Pasta Liquids'), unit: 'liter',
      addLabel: tr(L, 'إضافة سائل', 'Aggiungi liquido', 'Add Liquid'), onAdd: () => setEditingPastaLiquid(false),
      renderRow: (it) => (
        <tr key={it.id}>
          <td style={{ fontWeight: 600 }}>{it.name}</td>
          <td>
            <span className="mono" style={{ fontWeight: 700, color: (it.stock || 0) <= (state.settings.lowStockPasta || 10) ? 'var(--red)' : 'var(--green)' }}>{(it.stock || 0).toLocaleString()}</span>
            <span className="smallmuted" style={{ marginInlineStart: 4 }}>L</span>
          </td>
          {isAdmin && (
            <td>
              <div className="row" style={{ gap: 6 }}>
                <button style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setRestock({ builtinKey: 'pastaLiquids', itemId: it.id, name: it.name, unit: 'liter' })}>+ {tr(L, 'تعبئة', 'Rifornisci', 'Restock')}</button>
                <button className="ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setEditingPastaLiquid(it)}>⚙️</button>
                <button className="danger ghost" style={{ padding: '4px 8px' }} onClick={() => deletePastaLiquid(it.id)}>✕</button>
              </div>
            </td>
          )}
        </tr>
      ),
    },
  ];

  return (
    <>
      <h2 style={{ margin: '0 0 12px', fontSize: 20, color: 'var(--brand)' }}>📦 {tr(L, 'المخازن', 'Magazzini', 'Warehouses')}</h2>
      {isAdmin && (
        <button className="primary" onClick={() => setCreating(true)}
          style={{ width: '100%', padding: '14px', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          ➕ {tr(L, 'إضافة مخزن جديد', 'Aggiungi nuovo magazzino', 'Add New Warehouse')}
        </button>
      )}

      {/* Custom warehouses */}
      {warehouses.map(wh => {
        const low = (it) => (it.lowStock || 0) > 0 && (it.stock || 0) <= it.lowStock;
        return (
          <div className="card" key={wh.id}>
            <div className="flex-between">
              <h3 style={{ margin: 0 }}>📦 {wh.name} <span className="smallmuted" style={{ fontSize: 12 }}>· {unitLabel(L, wh.unit)}</span></h3>
              {isAdmin && (
                <div className="row" style={{ gap: 6 }}>
                  <button onClick={() => setAddingItem(wh.id)}>+ {tr(L, 'صنف', 'Articolo', 'Item')}</button>
                  <button className="danger ghost" style={{ fontSize: 12 }} onClick={() => deleteWarehouse(wh.id)}>🗑️</button>
                </div>
              )}
            </div>
            {(wh.items || []).length === 0 ? (
              <div className="empty">{tr(L, 'لا توجد أصناف', 'Nessun articolo', 'No items')}</div>
            ) : (
              <table style={{ marginTop: 12 }}>
                <thead><tr><th>{tr(L, 'الصنف', 'Articolo', 'Item')}</th><th>{tr(L, 'المخزون', 'Giacenza', 'Stock')}</th>{isAdmin && <th>{T.actions}</th>}</tr></thead>
                <tbody>
                  {wh.items.map(it => (
                    <Item key={it.id} name={it.name} size={it.size} stock={it.stock} low={low(it)} unit={wh.unit}
                      onRestock={() => setRestock({ whId: wh.id, itemId: it.id, name: it.name, unit: wh.unit })}
                      onDelete={() => deleteItem(wh.id, it.id)} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* Built-in warehouses */}
      <h3 style={{ marginTop: 18, color: 'var(--muted)' }}>{tr(L, 'مخازن النظام', 'Magazzini di sistema', 'System Warehouses')}</h3>
      {builtins.map(b => {
        const arr = state[b.key] || [];
        return (
          <div className="card" key={b.key}>
            <div className="flex-between" style={{ marginBottom: arr.length > 0 ? 0 : 4 }}>
              <h3 style={{ margin: 0 }}>{b.icon} {b.title}</h3>
              {isAdmin && <button className="primary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={b.onAdd}>+ {b.addLabel}</button>}
            </div>
            {arr.length === 0 ? (
              <div className="empty">{tr(L, 'لا توجد أصناف', 'Nessun articolo', 'No items')}</div>
            ) : (
              <table style={{ marginTop: 12 }}>
                <thead><tr><th>{tr(L, 'الصنف', 'Articolo', 'Item')}</th><th>{tr(L, 'المخزون', 'Giacenza', 'Stock')}</th>{isAdmin && <th>{T.actions}</th>}</tr></thead>
                <tbody>{arr.map(it => b.renderRow(it))}</tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* Sponges / Sponge Lids (Pasta Abrasiva) */}
      {(state.pastaStock?.sponges > 0 || state.pastaStock?.spongeLids > 0 || isAdmin) && (
        <div className="card">
          <h3 style={{ margin: '0 0 12px' }}>🧽 {tr(L, 'خامات الباستا الكاشطة', 'Materie prime pasta abrasiva', 'Abrasive Pasta Materials')}</h3>
          <div className="grid cols-2" style={{ gap: 12 }}>
            {[['sponges', tr(L, 'الإسفنج', 'Spugne', 'Sponges'), '🧽'], ['spongeLids', tr(L, 'أغطية الإسفنج', 'Coperchi spugna', 'Sponge Lids'), '🧢']].map(([field, label, icon]) => (
              <div className="card" key={field} style={{ margin: 0, padding: 12, textAlign: 'center', background: 'var(--panel)' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--yellow)', marginBottom: 8 }}>{(state.pastaStock?.[field] || 0).toLocaleString()}</div>
                {isAdmin && (
                  <button style={{ fontSize: 11, padding: '3px 8px', width: '100%' }}
                    onClick={() => setRestock({ spongeField: field, name: label, unit: 'piece' })}>
                    + {tr(L, 'إضافة', 'Aggiungi', 'Add')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {creating && <CreateWarehouseModal L={L} T={T} onClose={() => setCreating(false)} onSave={createWarehouse} />}
      {addingItem && <WhItemModal L={L} T={T} onClose={() => setAddingItem(null)} onSave={(item) => addItem(addingItem, item)} />}

      {addingCarton && <CartonModal L={L} T={T} onClose={() => setAddingCarton(false)}
        onSave={c => { update({ cartonTypes: [...(state.cartonTypes || []), c] }); addLog({ type: 'carton_added', name: c.name, by: state.role }); toast(T.success_added); setAddingCarton(false); }} />}

      {addingCover && <CoverModal L={L} T={T} onClose={() => setAddingCover(false)}
        onSave={c => { update({ covers: [...state.covers, c] }); toast(T.success_added); setAddingCover(false); }} />}

      {addingBasket && <BasketModal L={L} T={T} onClose={() => setAddingBasket(false)}
        onSave={b => { update({ baskets: [...state.baskets, b] }); toast(T.success_added); setAddingBasket(false); }} />}

      {addingPastaBox && <PastaMaterialModal L={L} T={T}
        title={tr(L, 'إضافة علبة باستا', 'Aggiungi scatola pasta', 'Add Pasta Box')}
        onClose={() => setAddingPastaBox(false)}
        onSave={b => { update({ pastaBoxes: [...(state.pastaBoxes || []), b] }); toast(T.success_added); setAddingPastaBox(false); }} />}

      {addingPastaLid && <PastaMaterialModal L={L} T={T}
        title={tr(L, 'إضافة غطاء باستا', 'Aggiungi coperchio pasta', 'Add Pasta Lid')}
        onClose={() => setAddingPastaLid(false)}
        onSave={b => { update({ pastaLids: [...(state.pastaLids || []), b] }); toast(T.success_added); setAddingPastaLid(false); }} />}

      {editingPastaLiquid !== null && (
        <PastaLiquidModal L={L} T={T} existing={editingPastaLiquid || null}
          onClose={() => setEditingPastaLiquid(null)}
          onSave={liq => {
            if (editingPastaLiquid) update({ pastaLiquids: (state.pastaLiquids || []).map(p => p.id === liq.id ? liq : p) });
            else update({ pastaLiquids: [...(state.pastaLiquids || []), liq] });
            toast(T.success_added); setEditingPastaLiquid(null);
          }} />
      )}

      {restock && (
        <RestockModal L={L} T={T} name={restock.name} unit={restock.unit}
          onClose={() => setRestock(null)}
          onSave={(qty, reason) => {
            if (restock.spongeField) {
              const ps = state.pastaStock || { sponges: 0, spongeLids: 0 };
              update({ pastaStock: { ...ps, [restock.spongeField]: (ps[restock.spongeField] || 0) + qty } });
              addLog({ type: 'pasta_stock_add', material: restock.spongeField, qty, reason, by: state.role });
              toast(T.success_added); setRestock(null);
            } else if (restock.builtinKey) restockBuiltin(restock.builtinKey, restock.itemId, qty, reason);
            else restockItem(restock.whId, restock.itemId, qty, reason);
          }} />
      )}
    </>
  );
}

function CreateWarehouseModal({ L, T, onClose, onSave }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('piece');
  return (
    <Modal onClose={onClose} maxWidth={380}>
      <h3>📦 {tr(L, 'إضافة مخزن جديد', 'Nuovo magazzino', 'New Warehouse')}</h3>
      <div className="field">
        <label>{tr(L, 'اسم المخزن', 'Nome magazzino', 'Warehouse name')}</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={tr(L, 'مثال: مواد خام', 'es: Materie prime', 'e.g. Raw materials')} />
      </div>
      <div className="field">
        <label>{tr(L, 'وحدة التعامل', 'Unità di misura', 'Unit')}</label>
        <div className="row" style={{ gap: 8 }}>
          {[['liter', tr(L, 'لتر', 'Litri', 'Liters')], ['piece', tr(L, 'قطعة', 'Pezzi', 'Pieces')], ['carton', tr(L, 'كرتونة', 'Cartoni', 'Cartons')]].map(([u, lbl]) => (
            <button key={u} className={unit === u ? 'primary' : 'ghost'} style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setUnit(u)}>{lbl}</button>
          ))}
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { if (!name.trim()) { toast(tr(L, 'الاسم مطلوب', 'Nome obbligatorio', 'Name required'), true); return; } onSave(name.trim(), unit); }}>{T.save}</button>
      </div>
    </Modal>
  );
}

function WhItemModal({ L, T, onClose, onSave }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', size: '', stock: 0, lowStock: 0, waste: 0 });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  return (
    <Modal onClose={onClose} maxWidth={420}>
      <h3>+ {tr(L, 'إضافة صنف', 'Aggiungi articolo', 'Add Item')}</h3>
      <div className="grid cols-2">
        <div className="field"><label>{tr(L, 'الاسم', 'Nome', 'Name')}</label><input autoFocus value={f.name} onChange={e => set('name', e.target.value)} /></div>
        <div className="field"><label>{tr(L, 'الحجم', 'Misura', 'Size')}</label><input value={f.size} onChange={e => set('size', e.target.value)} placeholder="1L / 5kg ..." /></div>
        <div className="field"><label>{tr(L, 'المخزون الابتدائي', 'Stock iniziale', 'Initial stock')}</label><input type="number" value={f.stock} onChange={e => set('stock', e.target.value)} /></div>
        <div className="field"><label>{tr(L, 'هادر %', 'Scarto %', 'Waste %')}</label><input type="number" value={f.waste} onChange={e => set('waste', e.target.value)} /></div>
        <div className="field"><label>{tr(L, 'حد التحذير', 'Soglia avviso', 'Low-stock')}</label><input type="number" value={f.lowStock} onChange={e => set('lowStock', e.target.value)} /></div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { if (!f.name.trim()) { toast(tr(L, 'الاسم مطلوب', 'Nome obbligatorio', 'Name required'), true); return; } onSave({ id: uid(), name: f.name.trim(), size: f.size.trim(), stock: Number(f.stock) || 0, lowStock: Number(f.lowStock) || 0, waste: Number(f.waste) || 0 }); }}>{T.save}</button>
      </div>
    </Modal>
  );
}

function RestockModal({ L, T, name, unit, onClose, onSave }) {
  const toast = useToast();
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('');
  return (
    <Modal onClose={onClose} maxWidth={340}>
      <h3>+ {tr(L, 'تعبئة', 'Rifornisci', 'Restock')} — {name}</h3>
      <div className="field"><label>{T.qty} ({unitLabel(L, unit)})</label>
        <input autoFocus type="number" value={qty} onChange={e => setQty(Number(e.target.value) || 0)} /></div>
      <div className="field"><label>{T.reason}</label>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder={T.reason} /></div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { if (qty > 0) onSave(qty, reason); else toast('—', true); }}>{T.confirm}</button>
      </div>
    </Modal>
  );
}

function CartonModal({ L, T, onClose, onSave }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', size: '', stock: 0, lowStock: 0, waste: 0 });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  return (
    <Modal onClose={onClose} maxWidth={420}>
      <h3>📦 {tr(L, 'إضافة نوع كرتونة', 'Aggiungi tipo cartone', 'Add Carton Type')}</h3>
      <div className="grid cols-2">
        <div className="field"><label>{tr(L, 'اسم الكرتونة', 'Nome cartone', 'Carton Name')}</label><input autoFocus value={f.name} onChange={e => set('name', e.target.value)} placeholder={tr(L, 'كرتونة...', 'Cartone...', 'Carton...')} /></div>
        <div className="field"><label>{tr(L, 'الحجم', 'Misura', 'Size')}</label><input value={f.size} onChange={e => set('size', e.target.value)} placeholder="1L / 5L ..." /></div>
        <div className="field"><label>{tr(L, 'المخزون الابتدائي', 'Stock iniziale', 'Initial Stock')}</label><input type="number" value={f.stock} onChange={e => set('stock', e.target.value)} /></div>
        <div className="field"><label>{tr(L, 'هادر %', 'Scarto %', 'Waste %')}</label><input type="number" value={f.waste} onChange={e => set('waste', e.target.value)} /></div>
        <div className="field"><label>{tr(L, 'حد التحذير', 'Soglia avviso', 'Low-Stock')}</label><input type="number" value={f.lowStock} onChange={e => set('lowStock', e.target.value)} /></div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { if (!f.name.trim()) { toast(tr(L, 'الاسم مطلوب', 'Nome obbligatorio', 'Name required'), true); return; } onSave({ id: uid(), name: f.name.trim(), size: f.size.trim(), stock: Number(f.stock) || 0, lowStock: Number(f.lowStock) || 0, waste: Number(f.waste) || 0 }); }}>{T.save}</button>
      </div>
    </Modal>
  );
}

function CoverModal({ L, T, onClose, onSave }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', coverType: 'front', color: '', size: '', stock: 0 });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const autoName = () => [f.color, f.size, f.coverType === 'front' ? T.front_cover : T.back_cover].filter(Boolean).join(' - ');
  return (
    <Modal onClose={onClose} maxWidth={400}>
      <h3>🎩 {tr(L, 'إضافة غطاء', 'Aggiungi coperchio', 'Add Cover')}</h3>
      <div className="grid cols-2">
        <div className="field"><label>{T.color}</label><input autoFocus value={f.color} onChange={e => set('color', e.target.value)} placeholder="nero / blu ..." /></div>
        <div className="field"><label>{T.size}</label><input value={f.size} onChange={e => set('size', e.target.value)} placeholder="5L / 10L ..." /></div>
        <div className="field"><label>{T.cover_type}</label>
          <select value={f.coverType} onChange={e => set('coverType', e.target.value)}>
            <option value="front">{T.front_cover}</option><option value="back">{T.back_cover}</option>
          </select>
        </div>
        <div className="field"><label>{T.initial_stock} ({T.pieces})</label><input type="number" value={f.stock} onChange={e => set('stock', e.target.value)} /></div>
        <div className="field" style={{ gridColumn: '1/-1' }}><label>{T.cover_name} ({tr(L, 'اختياري', 'opzionale', 'optional')})</label><input value={f.name} onChange={e => set('name', e.target.value)} placeholder={autoName() || `${T.cover_name}...`} /></div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { const n = f.name.trim() || autoName(); if (!n) { toast('—', true); return; } onSave({ id: uid(), name: n, coverType: f.coverType, color: f.color.trim(), size: f.size.trim(), stock: Number(f.stock) || 0 }); }}>{T.save}</button>
      </div>
    </Modal>
  );
}

function BasketModal({ L, T, onClose, onSave }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', color: '', size: '', stock: 0 });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const autoName = () => [f.color, f.size].filter(Boolean).join(' - ');
  return (
    <Modal onClose={onClose} maxWidth={400}>
      <h3>🪣 {tr(L, 'إضافة جركن', 'Aggiungi tanica', 'Add Jerrican')}</h3>
      <div className="grid cols-2">
        <div className="field"><label>{T.color}</label><input autoFocus value={f.color} onChange={e => set('color', e.target.value)} placeholder="Normale / con beccuccio ..." /></div>
        <div className="field"><label>{T.size}</label><input value={f.size} onChange={e => set('size', e.target.value)} placeholder="5L / 10L ..." /></div>
        <div className="field"><label>{T.initial_stock} ({T.pieces})</label><input type="number" value={f.stock} onChange={e => set('stock', e.target.value)} /></div>
        <div className="field"><label>{T.basket_name} ({tr(L, 'اختياري', 'opzionale', 'optional')})</label><input value={f.name} onChange={e => set('name', e.target.value)} placeholder={autoName() || `${T.basket_name}...`} /></div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { const n = f.name.trim() || autoName(); if (!n) { toast('—', true); return; } onSave({ id: uid(), name: n, color: f.color.trim(), size: f.size.trim(), stock: Number(f.stock) || 0 }); }}>{T.save}</button>
      </div>
    </Modal>
  );
}

function PastaMaterialModal({ L, T, title, onClose, onSave }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', color: '', size: '', stock: 0 });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const autoName = () => [f.color, f.size].filter(Boolean).join(' - ');
  return (
    <Modal onClose={onClose} maxWidth={400}>
      <h3>{title}</h3>
      <div className="grid cols-2">
        <div className="field"><label>{T.color}</label><input autoFocus value={f.color} onChange={e => set('color', e.target.value)} placeholder="nero / blu ..." /></div>
        <div className="field"><label>{T.size}</label><input value={f.size} onChange={e => set('size', e.target.value)} placeholder="5L / 10L ..." /></div>
        <div className="field"><label>{T.stock_count}</label><input type="number" value={f.stock} onChange={e => set('stock', e.target.value)} /></div>
        <div className="field"><label>{tr(L, 'الاسم (اختياري)', 'Nome (opzionale)', 'Name (optional)')}</label><input value={f.name} onChange={e => set('name', e.target.value)} placeholder={autoName() || '...'} /></div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { const n = f.name.trim() || autoName(); if (!n) { toast('—', true); return; } onSave({ id: uid(), name: n, color: f.color.trim(), size: f.size.trim(), stock: Number(f.stock) || 0 }); }}>{T.save}</button>
      </div>
    </Modal>
  );
}

function PastaLiquidModal({ L, T, existing, onClose, onSave }) {
  const toast = useToast();
  const [name, setName] = useState(existing?.name || '');
  const [stock, setStock] = useState(existing?.stock ?? 0);
  const [prepNotes, setPrepNotes] = useState(existing?.prepNotes || '');
  const [recipe, setRecipe] = useState((existing?.recipe || []).map(r => ({ id: r.id || uid(), name: r.name, ratio: r.ratio })));

  const addIng = () => setRecipe(r => [...r, { id: uid(), name: '', ratio: '' }]);
  const updIng = (id, f, v) => setRecipe(r => r.map(x => x.id === id ? { ...x, [f]: v } : x));
  const remIng = (id) => setRecipe(r => r.filter(x => x.id !== id));

  const handleSave = () => {
    if (!name.trim()) { toast(tr(L, 'الاسم مطلوب', 'Nome obbligatorio', 'Name required'), true); return; }
    onSave({ id: existing?.id || uid(), name: name.trim(), stock: existing ? (existing.stock || 0) : (Number(stock) || 0), prepNotes: prepNotes.trim(), recipe: recipe.filter(r => r.name.trim() && Number(r.ratio) > 0).map(r => ({ id: r.id, name: r.name.trim(), ratio: Number(r.ratio) })) });
  };

  return (
    <Modal onClose={onClose} maxWidth={500}>
      <h3>🧪 {existing ? tr(L, 'تعديل سائل', 'Modifica liquido', 'Edit Liquid') : tr(L, 'إضافة سائل جديد', 'Aggiungi nuovo liquido', 'Add New Liquid')}</h3>
      <div className="grid cols-2" style={{ marginBottom: 12 }}>
        <div className="field"><label>{tr(L, 'اسم السائل', 'Nome liquido', 'Liquid Name')}</label><input autoFocus value={name} onChange={e => setName(e.target.value)} /></div>
        {!existing && <div className="field"><label>{tr(L, 'المخزون الابتدائي (لتر)', 'Stock iniziale (L)', 'Initial Stock (L)')}</label><input type="number" value={stock} onChange={e => setStock(e.target.value)} /></div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontWeight: 'bold' }}>🧪 {tr(L, 'المكونات (لكل لتر)', 'Ingredienti (per 1L)', 'Ingredients (per 1L)')}</label>
        <button className="primary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={addIng}>+ {tr(L, 'مكون', 'Ingrediente', 'Ingredient')}</button>
      </div>
      {recipe.map((ing, idx) => (
        <div key={ing.id || idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <input className="input-sm" style={{ flex: 2 }} placeholder={tr(L, 'اسم المكون', 'Nome ingrediente', 'Ingredient')} value={ing.name} onChange={e => updIng(ing.id, 'name', e.target.value)} />
          <input className="input-sm" type="number" step="any" style={{ flex: 1, minWidth: 80 }} placeholder={tr(L, 'النسبة', 'Proporzione', 'Ratio')} value={ing.ratio} onChange={e => updIng(ing.id, 'ratio', e.target.value)} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', width: 40 }}>L/L</span>
          <button className="ghost" style={{ color: 'var(--red)', padding: '4px 8px' }} onClick={() => remIng(ing.id)}>✕</button>
        </div>
      ))}
      <div className="field" style={{ marginTop: 12 }}>
        <label style={{ fontWeight: 'bold' }}>📝 {tr(L, 'خطوات التحضير', 'Passaggi preparazione', 'Preparation Steps')}</label>
        <textarea value={prepNotes} onChange={e => setPrepNotes(e.target.value)} style={{ minHeight: 70 }} placeholder={tr(L, 'خطوات للكيميائي...', 'Passaggi per il chimico...', 'Steps for chemist...')} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={handleSave}>{T.save}</button>
      </div>
    </Modal>
  );
}
