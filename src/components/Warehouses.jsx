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

  const [creating, setCreating] = useState(false);
  const [addingItem, setAddingItem] = useState(null);   // warehouse id
  const [restock, setRestock] = useState(null);          // { whId, itemId, name }

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

  // ---- built-in warehouses (consolidated read + restock) ----
  const builtins = [
    { key: 'cartonTypes', title: tr(L, 'الكراتين', 'Cartoni', 'Cartons'), unit: 'piece' },
    { key: 'covers', title: tr(L, 'الغطاءات', 'Coperchi', 'Covers'), unit: 'piece' },
    { key: 'baskets', title: tr(L, 'الجراكن', 'Taniche', 'Jerricans'), unit: 'piece' },
    { key: 'pastaBoxes', title: tr(L, 'علب الباستا', 'Scatole pasta', 'Pasta Boxes'), unit: 'piece' },
    { key: 'pastaLids', title: tr(L, 'أغطية الباستا', 'Coperchi pasta', 'Pasta Lids'), unit: 'piece' },
    { key: 'pastaLiquids', title: tr(L, 'سوائل الباستا', 'Liquidi pasta', 'Pasta Liquids'), unit: 'liter' },
  ];
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
        if (arr.length === 0) return null;
        const threshold = b.key === 'pastaLiquids' ? (state.settings.lowStockPasta || 10) : (state.settings.lowStock || 5);
        return (
          <div className="card" key={b.key}>
            <h3 style={{ margin: 0 }}>{b.title}</h3>
            <table style={{ marginTop: 12 }}>
              <thead><tr><th>{tr(L, 'الصنف', 'Articolo', 'Item')}</th><th>{tr(L, 'المخزون', 'Giacenza', 'Stock')}</th>{isAdmin && <th>{T.actions}</th>}</tr></thead>
              <tbody>
                {arr.map(it => (
                  <Item key={it.id} name={it.name} size={it.size} stock={it.stock}
                    low={(it.lowStock != null ? (it.stock || 0) <= it.lowStock : (it.stock || 0) <= threshold)}
                    unit={b.unit}
                    onRestock={() => setRestock({ builtinKey: b.key, itemId: it.id, name: it.name, unit: b.unit })} />
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {creating && <CreateWarehouseModal L={L} T={T} onClose={() => setCreating(false)} onSave={createWarehouse} />}
      {addingItem && <WhItemModal L={L} T={T} onClose={() => setAddingItem(null)} onSave={(item) => addItem(addingItem, item)} />}
      {restock && (
        <RestockModal L={L} T={T} name={restock.name} unit={restock.unit}
          onClose={() => setRestock(null)}
          onSave={(qty, reason) => {
            if (restock.builtinKey) restockBuiltin(restock.builtinKey, restock.itemId, qty, reason);
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
        <label>{tr(L, 'وحدة التعامل', 'Unità di misura', 'Handling unit')}</label>
        <div className="row" style={{ gap: 8 }}>
          {[['liter', tr(L, 'باللتر', 'A litri', 'By liter')], ['piece', tr(L, 'بالقطعة', 'A pezzi', 'By piece')], ['carton', tr(L, 'بالكرتونة', 'A cartoni', 'By carton')]].map(([u, lbl]) => (
            <button key={u} className={unit === u ? 'primary' : 'ghost'} style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setUnit(u)}>{lbl}</button>
          ))}
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { if (!name.trim()) { toast(tr(L, 'الاسم مطلوب', 'Il nome è obbligatorio', 'Name required'), true); return; } onSave(name.trim(), unit); }}>{T.save}</button>
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
        <div className="field"><label>{tr(L, 'الحجم/الوصف', 'Misura/descrizione', 'Size/desc')}</label><input value={f.size} onChange={e => set('size', e.target.value)} placeholder="1L / 5kg ..." /></div>
        <div className="field"><label>{tr(L, 'المخزون الابتدائي', 'Stock iniziale', 'Initial stock')}</label><input type="number" value={f.stock} onChange={e => set('stock', e.target.value)} /></div>
        <div className="field"><label>{tr(L, 'هادر %', 'Scarto %', 'Waste %')}</label><input type="number" value={f.waste} onChange={e => set('waste', e.target.value)} /></div>
        <div className="field"><label>{tr(L, 'حد التحذير', 'Soglia avviso', 'Low-stock')}</label><input type="number" value={f.lowStock} onChange={e => set('lowStock', e.target.value)} /></div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { if (!f.name.trim()) { toast(tr(L, 'الاسم مطلوب', 'Il nome è obbligatorio', 'Name required'), true); return; } onSave({ id: uid(), name: f.name.trim(), size: f.size.trim(), stock: Number(f.stock) || 0, lowStock: Number(f.lowStock) || 0, waste: Number(f.waste) || 0 }); }}>{T.save}</button>
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
