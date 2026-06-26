import { useState } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { I18N } from '../i18n';
import { uid } from '../helpers';
import { exportWarehousesExcel } from '../exportExcel';
import Modal from './Modal';

const tr = (L, ar, it, en) => (L === 'ar' ? ar : L === 'it' ? it : en);
const UNIT_LABELS = { liter: 'L', ml: 'ml', kg: 'kg', g: 'g', carton: 'cart.', piece: 'pz' };
const unitLabel = (L, u) => UNIT_LABELS[u] || tr(L, 'قطعة', 'Pezzi', 'Pieces');

export default function Warehouses() {
  const { state, update, addLog } = useStore();
  const T = I18N[state.lang];
  const L = state.lang;
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = state.role === 'admin';

  const askDelete = (name) => confirm({ danger: true, title: T.confirm_delete, message: name || '' });

  // Custom warehouse state
  const [creating, setCreating] = useState(false);
  const [restock, setRestock] = useState(null);
  const [restockTickets, setRestockTickets] = useState(null); // product whose labels are being topped up

  // Add a new label order to a product's stock (increments front/back)
  const addTickets = (productId, front, back, reason) => {
    update({ products: (state.products || []).map(p => p.id !== productId ? p : { ...p, stock: { ...p.stock, ticketsFront: (p.stock?.ticketsFront || 0) + front, ticketsBack: (p.stock?.ticketsBack || 0) + back } }) });
    const prod = (state.products || []).find(p => p.id === productId);
    addLog({ type: 'restock', product: prod?.code, reason: reason || 'etichette', by: state.role });
    toast(T.success_added);
    setRestockTickets(null);
  };

  // Built-in add modals
  const [addingCover, setAddingCover] = useState(false);
  const [addingBasket, setAddingBasket] = useState(false);
  const [addingCarton, setAddingCarton] = useState(false);
  const [addingPastaLid, setAddingPastaLid] = useState(false);
  const [editingPastaLiquid, setEditingPastaLiquid] = useState(null); // null | false | liquid obj

  // ---- custom warehouse ops ----
  const warehouses = state.warehouses || [];
  const saveWh = (next) => update({ warehouses: next });

  // Recipe ingredient options = non-piece warehouses (liquids/solids used in preparation)
  const prepOptions = warehouses.filter(w => w.unit !== 'piece').map(w => ({ warehouseId: w.id, name: w.name, unit: w.unit }));

  const createWarehouse = (data) => {
    saveWh([...warehouses, { id: uid(), name: data.name, unit: data.unit, stock: Number(data.stock) || 0, lowStock: Number(data.lowStock) || 0, notes: data.notes || '' }]);
    addLog({ type: 'warehouse_created', name: data.name, by: state.role });
    toast(T.success_added);
    setCreating(false);
  };
  const deleteWarehouse = async (wh) => {
    if (!(await askDelete(wh.name))) return;
    saveWh(warehouses.filter(w => w.id !== wh.id));
    toast(T.deleted);
  };
  const restockWarehouse = (id, qty, reason) => {
    const wh = warehouses.find(w => w.id === id);
    saveWh(warehouses.map(w => w.id !== id ? w : { ...w, stock: (w.stock || 0) + qty }));
    addLog({ type: 'warehouse_stock_add', name: wh?.name, qty, reason, by: state.role });
    toast(T.success_added);
    setRestock(null);
  };

  // ---- built-in ops ----
  const deleteCover = async (it) => { if (!(await askDelete(it.name))) return; update({ covers: state.covers.filter(c => c.id !== it.id) }); toast(T.deleted); };
  const deleteBasket = async (it) => { if (!(await askDelete(it.name))) return; update({ baskets: state.baskets.filter(b => b.id !== it.id) }); toast(T.deleted); };
  const deleteCarton = async (it) => { if (!(await askDelete(it.name))) return; update({ cartonTypes: (state.cartonTypes || []).filter(c => c.id !== it.id) }); toast(T.deleted); };
  const deletePastaBox = async (it) => { if (!(await askDelete(it.name))) return; update({ pastaBoxes: (state.pastaBoxes || []).filter(p => p.id !== it.id) }); toast(T.deleted); };
  const deletePastaLid = async (it) => { if (!(await askDelete(it.name))) return; update({ pastaLids: (state.pastaLids || []).filter(p => p.id !== it.id) }); toast(T.deleted); };
  const deletePastaLiquid = async (it) => { if (!(await askDelete(it.name))) return; update({ pastaLiquids: (state.pastaLiquids || []).filter(p => p.id !== it.id) }); toast(T.deleted); };

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
        onRestock={() => setRestock({ builtinKey: 'cartonTypes', itemId: it.id, name: it.name, unit: 'piece' })} onDelete={isAdmin ? () => deleteCarton(it) : null} />,
    },
    {
      key: 'covers', icon: '🎩', title: tr(L, 'الغطاءات', 'Coperchi', 'Covers'), unit: 'piece',
      addLabel: tr(L, 'إضافة غطاء', 'Aggiungi coperchio', 'Add Cover'), onAdd: () => setAddingCover(true),
      renderRow: (it) => <Item key={it.id} name={it.name} size={it.size} stock={it.stock} low={(it.stock || 0) <= (state.settings.lowStock || 5)} unit="piece"
        onRestock={() => setRestock({ builtinKey: 'covers', itemId: it.id, name: it.name, unit: 'piece' })} onDelete={isAdmin ? () => deleteCover(it) : null} />,
    },
    {
      key: 'baskets', icon: '🪣', title: tr(L, 'الجراكن', 'Taniche', 'Jerricans'), unit: 'piece',
      addLabel: tr(L, 'إضافة جركن', 'Aggiungi tanica', 'Add Jerrican'), onAdd: () => setAddingBasket(true),
      renderRow: (it) => <Item key={it.id} name={it.name} size={it.size} stock={it.stock} low={(it.stock || 0) <= (state.settings.lowStock || 5)} unit="piece"
        onRestock={() => setRestock({ builtinKey: 'baskets', itemId: it.id, name: it.name, unit: 'piece' })} onDelete={isAdmin ? () => deleteBasket(it) : null} />,
    },
    {
      key: 'pastaLids', icon: '🔴', title: tr(L, 'أغطية الباستا', 'Coperchi pasta', 'Pasta Lids'), unit: 'piece',
      addLabel: tr(L, 'إضافة غطاء', 'Aggiungi coperchio', 'Add Lid'), onAdd: () => setAddingPastaLid(true),
      renderRow: (it) => <Item key={it.id} name={it.name} size={it.size} stock={it.stock} low={(it.stock || 0) <= (state.settings.lowStock || 5)} unit="piece"
        onRestock={() => setRestock({ builtinKey: 'pastaLids', itemId: it.id, name: it.name, unit: 'piece' })} onDelete={isAdmin ? () => deletePastaLid(it) : null} />,
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
                <button className="danger ghost" style={{ padding: '4px 8px' }} onClick={() => deletePastaLiquid(it)}>✕</button>
              </div>
            </td>
          )}
        </tr>
      ),
    },
  ];

  return (
    <>
      <div className="flex-between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--brand)' }}>📦 {tr(L, 'المخازن', 'Magazzini', 'Warehouses')}</h2>
        <button onClick={() => exportWarehousesExcel(state)}>⬇️ Excel</button>
      </div>
      {isAdmin && (
        <button className="primary" onClick={() => setCreating(true)}
          style={{ width: '100%', padding: '14px', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          ➕ {tr(L, 'إضافة مخزن جديد', 'Aggiungi nuovo magazzino', 'Add New Warehouse')}
        </button>
      )}

      {/* Custom warehouses — each warehouse IS one material (single stock) */}
      {warehouses.map(wh => {
        const low = (wh.lowStock || 0) > 0 && (wh.stock || 0) <= wh.lowStock;
        const isPrep = wh.unit !== 'piece';
        return (
          <div className="card" key={wh.id}>
            <div className="flex-between" style={{ flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ margin: 0 }}>
                  {isPrep ? '🧪' : '📦'} {wh.name}
                  <span className="smallmuted" style={{ fontSize: 12 }}> · {unitLabel(L, wh.unit)}</span>
                  <span className="badge ok" style={{ marginInlineStart: 8, fontSize: 10 }}>
                    {isPrep ? tr(L, 'تحضير المنتج', 'Preparazione', 'Prep') : tr(L, 'برنامج', 'Programma', 'Program')}
                  </span>
                </h3>
                {wh.notes && <div className="smallmuted" style={{ fontSize: 12, marginTop: 4, whiteSpace: 'pre-wrap' }}>{wh.notes}</div>}
              </div>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <div style={{ textAlign: 'end' }}>
                  <span className="mono" style={{ fontWeight: 800, fontSize: 18, color: low ? 'var(--red)' : 'var(--green)' }}>{(wh.stock || 0).toLocaleString()}</span>
                  <span className="smallmuted" style={{ marginInlineStart: 4 }}>{unitLabel(L, wh.unit)}</span>
                  {low && <span className="badge bad" style={{ marginInlineStart: 6 }}>⚠️ {tr(L, 'منخفض', 'Basso', 'Low')}</span>}
                </div>
                {isAdmin && (
                  <>
                    <button onClick={() => setRestock({ whId: wh.id, name: wh.name, unit: wh.unit })}>+ {tr(L, 'تعبئة', 'Rifornisci', 'Restock')}</button>
                    <button className="danger ghost" style={{ fontSize: 12 }} onClick={() => deleteWarehouse(wh)}>🗑️</button>
                  </>
                )}
              </div>
            </div>
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

      {/* Product labels (etichette) — add new label orders to each product */}
      {(state.products || []).some(p => !p.isPasta) && (
        <div className="card">
          <h3 style={{ margin: '0 0 12px' }}>🏷️ {tr(L, 'تيكتة المنتجات', 'Etichette prodotti', 'Product Labels')}</h3>
          <table>
            <thead>
              <tr>
                <th>{tr(L, 'المنتج', 'Prodotto', 'Product')}</th>
                <th>{tr(L, 'أمامية', 'Fronte', 'Front')}</th>
                <th>{tr(L, 'خلفية', 'Retro', 'Back')}</th>
                {isAdmin && <th>{T.actions}</th>}
              </tr>
            </thead>
            <tbody>
              {(state.products || []).filter(p => !p.isPasta).map(p => {
                const low = state.settings.lowStock || 5;
                const f = p.stock?.ticketsFront || 0, b = p.stock?.ticketsBack || 0;
                const lowF = p.ticketsFront > 0 && f < p.ticketsFront * low;
                const lowB = p.ticketsBack > 0 && b < p.ticketsBack * low;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td><span className="mono" style={{ fontWeight: 700, color: lowF ? 'var(--red)' : 'var(--green)' }}>{f.toLocaleString()}</span></td>
                    <td><span className="mono" style={{ fontWeight: 700, color: lowB ? 'var(--red)' : 'var(--green)' }}>{b.toLocaleString()}</span></td>
                    {isAdmin && (
                      <td><button style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setRestockTickets(p)}>+ {tr(L, 'إضافة أوردر', 'Aggiungi ordine', 'Add order')}</button></td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
      {restockTickets && <TicketRestockModal L={L} T={T} product={restockTickets} onClose={() => setRestockTickets(null)}
        onSave={(front, back, reason) => addTickets(restockTickets.id, front, back, reason)} />}

      {addingCarton && <CartonModal L={L} T={T} onClose={() => setAddingCarton(false)}
        onSave={c => { update({ cartonTypes: [...(state.cartonTypes || []), c] }); addLog({ type: 'carton_added', name: c.name, by: state.role }); toast(T.success_added); setAddingCarton(false); }} />}

      {addingCover && <CoverModal L={L} T={T} onClose={() => setAddingCover(false)}
        onSave={c => { update({ covers: [...state.covers, c] }); toast(T.success_added); setAddingCover(false); }} />}

      {addingBasket && <BasketModal L={L} T={T} onClose={() => setAddingBasket(false)}
        onSave={b => { update({ baskets: [...state.baskets, b] }); toast(T.success_added); setAddingBasket(false); }} />}


      {addingPastaLid && <PastaMaterialModal L={L} T={T}
        title={tr(L, 'إضافة غطاء باستا', 'Aggiungi coperchio pasta', 'Add Pasta Lid')}
        onClose={() => setAddingPastaLid(false)}
        onSave={b => { update({ pastaLids: [...(state.pastaLids || []), b] }); toast(T.success_added); setAddingPastaLid(false); }} />}

      {editingPastaLiquid !== null && (
        <PastaLiquidModal L={L} T={T} existing={editingPastaLiquid || null} prepOptions={prepOptions}
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
            else restockWarehouse(restock.whId, qty, reason);
          }} />
      )}
    </>
  );
}

function CreateWarehouseModal({ L, T, onClose, onSave }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('liter');
  const [stock, setStock] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [notes, setNotes] = useState('');
  const isPrep = unit !== 'piece';
  const ulbl = UNIT_LABELS[unit] || unit;

  return (
    <Modal onClose={onClose} maxWidth={440}>
      <h3>📦 {tr(L, 'إضافة مخزن جديد', 'Nuovo magazzino', 'New Warehouse')}</h3>
      <div className="field">
        <label>{tr(L, 'اسم المادة / المخزن', 'Nome materiale / magazzino', 'Material / warehouse name')}</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={tr(L, 'مثال: ماء، ملح...', 'es: Acqua, Sale...', 'e.g. Water, Salt...')} />
      </div>
      <div className="field">
        <label>{tr(L, 'الوحدة', 'Unità', 'Unit')}</label>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {[['liter', tr(L, 'لتر', 'Litri', 'Liters')], ['ml', tr(L, 'ملي لتر', 'Millilitri', 'ml')], ['kg', tr(L, 'كيلو', 'Kg', 'kg')], ['g', tr(L, 'جرام', 'Grammi', 'g')], ['piece', tr(L, 'قطعة', 'Pezzi', 'Pieces')]].map(([u, lbl]) => (
            <button key={u} className={unit === u ? 'primary' : 'ghost'} style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setUnit(u)}>{lbl}</button>
          ))}
        </div>
        <div className="smallmuted" style={{ fontSize: 11, marginTop: 6 }}>
          {isPrep
            ? tr(L, '🧪 مادة تحضير — هتظهر كمكوّن لما تعمل منتج', '🧪 Materiale di preparazione — apparirà come ingrediente nei prodotti', '🧪 Prep material — appears as a product ingredient')
            : tr(L, '📦 مادة برنامج — هتستخدمها وانت بتعمل برنامج (زي الكرتون/الغطاية)', '📦 Materiale di programma — usato nei programmi (come cartoni/coperchi)', '📦 Program material — used in programs (like cartons/covers)')}
        </div>
      </div>
      <div className="grid cols-2">
        <div className="field">
          <label>{tr(L, 'الكمية الحالية', 'Giacenza iniziale', 'Current stock')} ({ulbl})</label>
          <input type="number" step="any" value={stock} onChange={e => setStock(e.target.value)} />
        </div>
        <div className="field">
          <label>{tr(L, 'حد التحذير', 'Soglia avviso', 'Low-stock')} ({ulbl})</label>
          <input type="number" step="any" value={lowStock} onChange={e => setLowStock(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>{tr(L, 'معلومات (اختياري)', 'Note (opzionale)', 'Info (optional)')}</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ minHeight: 50 }} placeholder={tr(L, 'مصدر، تركيز، ملاحظات...', 'Fornitore, concentrazione, note...', 'Supplier, concentration, notes...')} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { if (!name.trim()) { toast(tr(L, 'الاسم مطلوب', 'Nome obbligatorio', 'Name required'), true); return; } onSave({ name: name.trim(), unit, stock, lowStock, notes: notes.trim() }); }}>{T.save}</button>
      </div>
    </Modal>
  );
}

function TicketRestockModal({ L, T, product, onClose, onSave }) {
  const toast = useToast();
  const [front, setFront] = useState(0);
  const [back, setBack] = useState(0);
  const [reason, setReason] = useState('');
  return (
    <Modal onClose={onClose} maxWidth={380}>
      <h3>🏷️ {tr(L, 'إضافة أوردر تيكتة', 'Aggiungi ordine etichette', 'Add label order')} — {product.name}</h3>
      <p className="smallmuted" style={{ marginTop: 0 }}>
        {tr(L, 'اكتب كمية الأوردر الجديد وهتتزاد على المخزون الحالي.', "Inserisci la quantità del nuovo ordine: si somma alla giacenza.", 'Enter the new order quantity; it adds to the current stock.')}
      </p>
      <div className="grid cols-2">
        <div className="field">
          <label>{tr(L, 'تيكتة أمامية', 'Etichette fronte', 'Front labels')}
            <span className="smallmuted" style={{ marginInlineStart: 4 }}>· {(product.stock?.ticketsFront || 0).toLocaleString()}</span>
          </label>
          <input autoFocus type="number" value={front} onChange={e => setFront(Number(e.target.value) || 0)} />
        </div>
        <div className="field">
          <label>{tr(L, 'تيكتة خلفية', 'Etichette retro', 'Back labels')}
            <span className="smallmuted" style={{ marginInlineStart: 4 }}>· {(product.stock?.ticketsBack || 0).toLocaleString()}</span>
          </label>
          <input type="number" value={back} onChange={e => setBack(Number(e.target.value) || 0)} />
        </div>
      </div>
      <div className="field">
        <label>{T.reason || tr(L, 'السبب', 'Motivo', 'Reason')}</label>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder={tr(L, 'مثال: أوردر #123', 'es: Ordine #123', 'e.g. Order #123')} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => {
          if ((Number(front) || 0) <= 0 && (Number(back) || 0) <= 0) { toast(tr(L, 'أدخل كمية', 'Inserisci una quantità', 'Enter a quantity'), true); return; }
          onSave(Number(front) || 0, Number(back) || 0, reason);
        }}>{T.confirm}</button>
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

function PastaLiquidModal({ L, T, existing, prepOptions = [], onClose, onSave }) {
  const toast = useToast();
  const [name, setName] = useState(existing?.name || '');
  const [stock, setStock] = useState(existing?.stock ?? 0);
  const [prepNotes, setPrepNotes] = useState(existing?.prepNotes || '');
  const [recipe, setRecipe] = useState((existing?.recipe || []).map(r => ({ id: r.id || uid(), name: r.name, ratio: r.ratio, warehouseId: r.warehouseId || '' })));

  const addIng = () => setRecipe(r => [...r, { id: uid(), name: '', ratio: '', warehouseId: '' }]);
  const updIng = (id, f, v) => setRecipe(r => r.map(x => x.id === id ? { ...x, [f]: v } : x));
  const remIng = (id) => setRecipe(r => r.filter(x => x.id !== id));
  // Pick a warehouse as ingredient (or '' for manual free text)
  const pickSource = (id, key) => {
    const opt = prepOptions.find(o => o.warehouseId === key);
    setRecipe(r => r.map(x => x.id !== id ? x : opt
      ? { ...x, warehouseId: opt.warehouseId, name: opt.name }
      : { ...x, warehouseId: '' }));
  };

  const handleSave = () => {
    if (!name.trim()) { toast(tr(L, 'الاسم مطلوب', 'Nome obbligatorio', 'Name required'), true); return; }
    onSave({ id: existing?.id || uid(), name: name.trim(), stock: existing ? (existing.stock || 0) : (Number(stock) || 0), prepNotes: prepNotes.trim(), recipe: recipe.filter(r => r.name.trim() && Number(r.ratio) > 0).map(r => ({ id: r.id, name: r.name.trim(), ratio: Number(r.ratio), warehouseId: r.warehouseId || '' })) });
  };

  return (
    <Modal onClose={onClose} maxWidth={560}>
      <h3>🧪 {existing ? tr(L, 'تعديل سائل', 'Modifica liquido', 'Edit Liquid') : tr(L, 'إضافة سائل جديد', 'Aggiungi nuovo liquido', 'Add New Liquid')}</h3>
      <div className="grid cols-2" style={{ marginBottom: 12 }}>
        <div className="field"><label>{tr(L, 'اسم السائل', 'Nome liquido', 'Liquid Name')}</label><input autoFocus value={name} onChange={e => setName(e.target.value)} /></div>
        {!existing && <div className="field"><label>{tr(L, 'المخزون الابتدائي (لتر)', 'Stock iniziale (L)', 'Initial Stock (L)')}</label><input type="number" value={stock} onChange={e => setStock(e.target.value)} /></div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontWeight: 'bold' }}>🧪 {tr(L, 'المكونات (لكل لتر)', 'Ingredienti (per 1L)', 'Ingredients (per 1L)')}</label>
        <button className="primary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={addIng}>+ {tr(L, 'مكون', 'Ingrediente', 'Ingredient')}</button>
      </div>
      {prepOptions.length > 0 && (
        <p className="smallmuted" style={{ fontSize: 11, marginTop: 0 }}>
          {tr(L, 'اختر المكوّن من مخازن التحضير ليُخصم تلقائياً عند تجهيز السائل.',
                'Scegli un ingrediente dai magazzini di preparazione: verrà scalato automaticamente.',
                'Pick an ingredient from prep warehouses; it is auto-deducted when the liquid is prepared.')}
        </p>
      )}
      {recipe.map((ing, idx) => {
        const curKey = ing.warehouseId || '';
        return (
        <div key={ing.id || idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
          {prepOptions.length > 0 && (
            <select className="input-sm" style={{ flex: 1, minWidth: 120 }} value={curKey} onChange={e => pickSource(ing.id, e.target.value)}>
              <option value="">{tr(L, '✏️ يدوي', '✏️ Manuale', '✏️ Manual')}</option>
              {prepOptions.map(o => <option key={o.warehouseId} value={o.warehouseId}>{o.name}</option>)}
            </select>
          )}
          <input className="input-sm" style={{ flex: 2, minWidth: 110 }} placeholder={tr(L, 'اسم المكون', 'Nome ingrediente', 'Ingredient')} value={ing.name} onChange={e => updIng(ing.id, 'name', e.target.value)} disabled={!!curKey} />
          <input className="input-sm" type="number" step="any" style={{ flex: 1, minWidth: 70 }} placeholder={tr(L, 'النسبة', 'Proporzione', 'Ratio')} value={ing.ratio} onChange={e => updIng(ing.id, 'ratio', e.target.value)} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', width: 40 }}>L/L</span>
          <button className="ghost" style={{ color: 'var(--red)', padding: '4px 8px' }} onClick={() => remIng(ing.id)}>✕</button>
        </div>
        );
      })}
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
