import { useState } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { uid } from '../helpers';
import Modal from './Modal';

const tr = (L, ar, it, en) => (L === 'ar' ? ar : L === 'it' ? it : en);

export default function FinishedProducts() {
  const { state, update, addLog } = useStore();
  const L = state.lang;
  const toast = useToast();
  const isAdmin = state.role === 'admin';

  const [tab, setTab] = useState('linea');
  const [modal, setModal] = useState(null);

  const lineaProducts = state.products.filter(p => !p.isPasta);
  const pastaProducts = state.products.filter(p => p.isPasta);
  const lineaFinished  = state.lineaFinished  || {};
  const pastaFinished  = state.pastaFinished  || {};
  const amazonFinished = state.amazonFinished || {};

  const addLinea = (productId, qty, reason) => {
    const lf = { ...lineaFinished, [productId]: (lineaFinished[productId] || 0) + qty };
    update({ lineaFinished: lf });
    const prod = lineaProducts.find(p => p.id === productId);
    addLog({ type: 'linea_add', productId, product: prod?.name, qty, reason, by: state.role });
    toast(tr(L, 'تمت الإضافة', 'Aggiunto', 'Added'));
  };

  const outLinea = (items, note) => {
    const lf = { ...lineaFinished };
    items.forEach(({ productId, qty }) => {
      lf[productId] = Math.max(0, (lf[productId] || 0) - qty);
      const prod = lineaProducts.find(p => p.id === productId);
      addLog({ type: 'linea_out', productId, product: prod?.name, qty, reason: note, by: state.role });
    });
    update({ lineaFinished: lf });
    toast(tr(L, 'تم الشحن', 'Spedito', 'Shipped'));
  };

  const addPasta = (productId, qty, reason) => {
    const pf = { ...pastaFinished, [productId]: (pastaFinished[productId] || 0) + qty };
    update({ pastaFinished: pf });
    const prod = pastaProducts.find(p => p.id === productId);
    addLog({ type: 'pasta_add', productId, product: prod?.name, qty, reason, by: state.role });
    toast(tr(L, 'تمت الإضافة', 'Aggiunto', 'Added'));
  };

  const outPasta = (items, note) => {
    const pf = { ...pastaFinished };
    items.forEach(({ productId, qty }) => {
      pf[productId] = Math.max(0, (pf[productId] || 0) - qty);
      const prod = pastaProducts.find(p => p.id === productId);
      addLog({ type: 'pasta_out', productId, product: prod?.name, qty, reason: note, by: state.role });
    });
    update({ pastaFinished: pf });
    toast(tr(L, 'تم الشحن', 'Spedito', 'Shipped'));
  };

  const outAmazon = (items, note) => {
    const af = { ...amazonFinished };
    items.forEach(({ productId, qty }) => {
      af[productId] = Math.max(0, (af[productId] || 0) - qty);
      const prod = lineaProducts.find(p => p.id === productId);
      addLog({ type: 'amazon_out', productId, product: prod?.name, qty, reason: note, by: state.role });
    });
    update({ amazonFinished: af });
    toast(tr(L, 'تم الشحن', 'Spedito', 'Shipped'));
  };

  // Combined order: pulls from Linea (bancale), Pasta (cartons) and Amazon (cartons) at once
  const applyCombinedOrder = (items, note) => {
    const lf = { ...lineaFinished };
    const pf = { ...pastaFinished };
    const af = { ...amazonFinished };
    items.forEach(({ source, productId, qty }) => {
      if (source === 'linea')  lf[productId] = Math.max(0, (lf[productId] || 0) - qty);
      if (source === 'pasta')  pf[productId] = Math.max(0, (pf[productId] || 0) - qty);
      if (source === 'amazon') af[productId] = Math.max(0, (af[productId] || 0) - qty);
      const prod = state.products.find(p => p.id === productId);
      addLog({ type: 'combined_order_out', source, productId, product: prod?.name, qty, reason: note, by: state.role });
    });
    update({ lineaFinished: lf, pastaFinished: pf, amazonFinished: af });
    toast(tr(L, 'تم تسجيل الأوردر', 'Ordine registrato', 'Order recorded'));
  };

  const TABS = [
    { key: 'linea',  label: tr(L, '📦 الخط',   '📦 Linea',  '📦 Linea')  },
    { key: 'pasta',  label: tr(L, '🍝 الباستا', '🍝 Pasta',  '🍝 Pasta')  },
    { key: 'amazon', label: tr(L, '🛒 أمازون',  '🛒 Amazon', '🛒 Amazon') },
  ];

  return (
    <>
      <div className="flex-between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--brand)' }}>
          🏭 {tr(L, 'المنتجات الجاهزة', 'Prodotti finiti', 'Finished Products')}
        </h2>
        {isAdmin && (
          <div className="row" style={{ gap: 8 }}>
            <button className="primary" style={{ background: 'var(--brand)' }} onClick={() => setModal('combined_order')}>
              🚚 {tr(L, 'أوردر شحن (كل الأقسام)', 'Nuovo ordine (tutti)', 'New Order (all)')}
            </button>
            {tab === 'linea' && (
              <>
                <button className="primary" onClick={() => setModal('add_linea')}>
                  + {tr(L, 'إضافة بانكاله', 'Aggiungi bancale', 'Add Bancale')}
                </button>
                <button onClick={() => setModal('out_linea')}>
                  🚚 {tr(L, 'شحن', 'Spedisci', 'Ship')}
                </button>
              </>
            )}
            {tab === 'pasta' && (
              <>
                <button className="primary" onClick={() => setModal('add_pasta')}>
                  + {tr(L, 'إضافة كراتين', 'Aggiungi cartoni', 'Add Cartons')}
                </button>
                <button onClick={() => setModal('out_pasta')}>
                  🚚 {tr(L, 'شحن', 'Spedisci', 'Ship')}
                </button>
              </>
            )}
            {tab === 'amazon' && (
              <button onClick={() => setModal('out_amazon')}>
                📤 {tr(L, 'شحن أمازون', 'Spedisci Amazon', 'Ship Amazon')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} className={tab === t.key ? 'primary' : 'ghost'} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'linea' && (
        <div className="card">
          <p className="smallmuted" style={{ marginTop: 0 }}>
            {tr(L,
              'مخزن الخط — بانكاله. يتعبّى تلقائياً من إنتاج الخط، يُخصم عند الشحن أو أوردر أمازون.',
              'Magazzino Linea — bancale. Riempito dalla produzione Linea, scalato da spedizioni o ordini Amazon.',
              'Linea warehouse — bancale. Auto-filled by Linea production, deducted by shipments or Amazon orders.')}
          </p>
          <StockTable L={L} products={lineaProducts} stock={lineaFinished}
            unit={tr(L, 'بانكاله', 'bancale', 'bancale')} lowThreshold={state.settings.lowStock || 5} />
        </div>
      )}

      {tab === 'pasta' && (
        <div className="card">
          <p className="smallmuted" style={{ marginTop: 0 }}>
            {tr(L,
              'مخزن الباستا — كراتين. يتعبّى من إنتاج الباستا الكرتونة (1 بانكاله = 12 كرتونة).',
              'Magazzino Pasta — cartoni. Riempito dalla produzione Pasta (1 bancale = 12 cartoni).',
              'Pasta warehouse — cartons. Auto-filled by Pasta carton production (1 bancale = 12 cartons).')}
          </p>
          <StockTable L={L} products={pastaProducts} stock={pastaFinished}
            unit={tr(L, 'كرتونة', 'cartoni', 'cartons')} lowThreshold={(state.settings.lowStockPasta || 10) * 12} />
        </div>
      )}

      {tab === 'amazon' && (
        <div className="card">
          <p className="smallmuted" style={{ marginTop: 0 }}>
            {tr(L,
              'مخزن أمازون — كراتين. يتعبّى من برامج أمازون (مخصوم من الخط بانكاله ÷ 128)، يُشحن للعميل.',
              'Magazzino Amazon — cartoni. Riempito dai programmi Amazon (scala dalla Linea ÷ 128 bancale).',
              'Amazon warehouse — cartons. Filled by Amazon programs (deducts from Linea at ÷128 bancale).')}
          </p>
          <StockTable L={L} products={lineaProducts} stock={amazonFinished}
            unit={tr(L, 'كرتونة', 'cartoni', 'cartons')} lowThreshold={0} />
        </div>
      )}

      {modal === 'add_linea' && (
        <AddStockModal L={L}
          title={tr(L, '+ إضافة بانكاله (خط)', '+ Aggiungi bancale (Linea)', '+ Add Bancale (Linea)')}
          products={lineaProducts} unit={tr(L, 'بانكاله', 'bancale', 'bancale')}
          onClose={() => setModal(null)}
          onSave={(pid, qty, reason) => { addLinea(pid, qty, reason); setModal(null); }} />
      )}
      {modal === 'out_linea' && (
        <ShipModal L={L}
          title={`🚚 ${tr(L, 'شحن خط', 'Spedisci Linea', 'Ship Linea')}`}
          products={lineaProducts} stock={lineaFinished} unit={tr(L, 'بانكاله', 'bancale', 'bancale')}
          onClose={() => setModal(null)}
          onSave={(items, note) => { outLinea(items, note); setModal(null); }} />
      )}
      {modal === 'add_pasta' && (
        <AddStockModal L={L}
          title={tr(L, '+ إضافة كراتين (باستا)', '+ Aggiungi cartoni (Pasta)', '+ Add Cartons (Pasta)')}
          products={pastaProducts} unit={tr(L, 'كرتونة', 'cartoni', 'cartons')}
          onClose={() => setModal(null)}
          onSave={(pid, qty, reason) => { addPasta(pid, qty, reason); setModal(null); }} />
      )}
      {modal === 'out_pasta' && (
        <ShipModal L={L}
          title={`🚚 ${tr(L, 'شحن باستا', 'Spedisci Pasta', 'Ship Pasta')}`}
          products={pastaProducts} stock={pastaFinished} unit={tr(L, 'كرتونة', 'cartoni', 'cartons')}
          onClose={() => setModal(null)}
          onSave={(items, note) => { outPasta(items, note); setModal(null); }} />
      )}
      {modal === 'out_amazon' && (
        <ShipModal L={L}
          title={`📤 ${tr(L, 'شحن أمازون', 'Spedisci Amazon', 'Ship Amazon')}`}
          products={lineaProducts} stock={amazonFinished} unit={tr(L, 'كرتونة', 'cartoni', 'cartons')}
          onClose={() => setModal(null)}
          onSave={(items, note) => { outAmazon(items, note); setModal(null); }} />
      )}
      {modal === 'combined_order' && (
        <CombinedOrderModal L={L}
          lineaProducts={lineaProducts} pastaProducts={pastaProducts}
          lineaFinished={lineaFinished} pastaFinished={pastaFinished} amazonFinished={amazonFinished}
          onClose={() => setModal(null)}
          onSave={(items, note) => { applyCombinedOrder(items, note); setModal(null); }} />
      )}
    </>
  );
}

function CombinedOrderModal({ L, lineaProducts, pastaProducts, lineaFinished, pastaFinished, amazonFinished, onClose, onSave }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [rows, setRows] = useState([{ id: uid(), source: 'linea', productId: '', qty: 0 }]);

  const SOURCES = [
    { key: 'linea',  label: tr(L, '📦 الخط (بانكاله)', '📦 Linea (bancale)', '📦 Linea (bancale)'),  unit: tr(L, 'بانكاله', 'bancale', 'bancale'), products: lineaProducts, stock: lineaFinished },
    { key: 'pasta',  label: tr(L, '🍝 الباستا (كراتين)', '🍝 Pasta (cartoni)', '🍝 Pasta (cartons)'), unit: tr(L, 'كرتونة', 'cartoni', 'cartons'), products: pastaProducts, stock: pastaFinished },
    { key: 'amazon', label: tr(L, '🛒 أمازون (كراتين)', '🛒 Amazon (cartoni)', '🛒 Amazon (cartons)'), unit: tr(L, 'كرتونة', 'cartoni', 'cartons'), products: lineaProducts, stock: amazonFinished },
  ];
  const srcOf = (key) => SOURCES.find(s => s.key === key);

  const addRow = () => setRows(r => [...r, { id: uid(), source: 'linea', productId: '', qty: 0 }]);
  const delRow = (id) => setRows(r => r.filter(x => x.id !== id));
  const setRow = (id, field, val) => setRows(r => r.map(x => x.id !== id ? x : { ...x, [field]: val, ...(field === 'source' ? { productId: '' } : {}) }));

  const handleSave = () => {
    const valid = rows.filter(r => r.source && r.productId && r.qty > 0);
    if (!valid.length) { toast(tr(L, 'أضف صنفاً على الأقل', 'Aggiungi almeno una voce', 'Add at least one item'), true); return; }
    onSave(valid.map(r => ({ source: r.source, productId: r.productId, qty: r.qty })), note);
  };

  return (
    <Modal onClose={onClose} maxWidth={640}>
      <h3>🚚 {tr(L, 'أوردر شحن — كل الأقسام', 'Nuovo ordine — tutti i reparti', 'New Order — all departments')}</h3>
      <p className="smallmuted" style={{ marginTop: 0 }}>
        {tr(L, 'أوردر واحد من عدة أقسام (خط + باستا + أمازون). يُخصم من كل مخزن حسب القسم.',
              'Un ordine da più reparti (Linea + Pasta + Amazon). Scala da ogni magazzino in base al reparto.',
              'One order from multiple departments. Deducts from each warehouse by source.')}
      </p>
      <div className="field">
        <label>📝 {tr(L, 'رقم الأوردر / ملاحظة', 'N. ordine / nota', 'Order no. / note')}</label>
        <input autoFocus value={note} onChange={e => setNote(e.target.value)}
          placeholder={tr(L, 'مثال: أوردر كاميون #123', 'es: Ordine camion #123', 'e.g. Truck order #123')} />
      </div>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontWeight: 700 }}>{tr(L, 'الأصناف', 'Voci', 'Items')}</label>
        <button className="primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={addRow}>
          + {tr(L, 'صنف', 'Voce', 'Item')}
        </button>
      </div>
      {rows.map(row => {
        const src = srcOf(row.source);
        const avail = (src.stock || {})[row.productId] || 0;
        const over = row.productId && row.qty > avail;
        return (
          <div key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 2, margin: 0, minWidth: 130 }}>
              <label style={{ fontSize: 11 }}>{tr(L, 'القسم', 'Reparto', 'Source')}</label>
              <select value={row.source} onChange={e => setRow(row.id, 'source', e.target.value)}>
                {SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 2, margin: 0, minWidth: 130 }}>
              <label style={{ fontSize: 11 }}>{tr(L, 'المنتج', 'Prodotto', 'Product')}</label>
              <select value={row.productId} onChange={e => setRow(row.id, 'productId', e.target.value)}>
                <option value="">—</option>
                {src.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {row.productId && (
                <div className="smallmuted" style={{ fontSize: 10, marginTop: 2 }}>
                  {tr(L, 'متاح', 'Disponibile', 'Available')}:{' '}
                  <strong style={{ color: over ? 'var(--red)' : 'var(--green)' }}>{Number(avail).toFixed(1)}</strong> {src.unit}
                </div>
              )}
            </div>
            <div className="field" style={{ flex: 1, margin: 0, minWidth: 70 }}>
              <label style={{ fontSize: 11 }}>{src.unit}</label>
              <input type="number" value={row.qty} min={0}
                style={{ borderColor: over ? 'var(--red)' : undefined }}
                onChange={e => setRow(row.id, 'qty', Number(e.target.value) || 0)} />
            </div>
            {rows.length > 1 && (
              <button className="danger ghost" style={{ padding: '6px 10px', marginBottom: 2 }} onClick={() => delRow(row.id)}>✕</button>
            )}
          </div>
        );
      })}
      {rows.some(r => r.productId && r.qty > 0) && (
        <div className="card" style={{ margin: '8px 0', padding: '10px 14px', background: 'var(--panel)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>📋 {tr(L, 'ملخص الأوردر', 'Riepilogo', 'Summary')}</div>
          {rows.filter(r => r.productId && r.qty > 0).map(r => {
            const src = srcOf(r.source);
            const prod = src.products.find(p => p.id === r.productId);
            return (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                <span>{src.label.replace(/^[^ ]+ /, '')} · {prod?.name || '—'}</span>
                <span className="mono" style={{ fontWeight: 700 }}>{r.qty} {src.unit}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose}>{tr(L, 'إلغاء', 'Annulla', 'Cancel')}</button>
        <button className="primary" onClick={handleSave}>
          ✅ {tr(L, 'تأكيد الأوردر', 'Conferma ordine', 'Confirm Order')}
        </button>
      </div>
    </Modal>
  );
}

function StockTable({ L, products, stock, unit, lowThreshold }) {
  const rows = Object.entries(stock).filter(([, q]) => (q || 0) > 0);
  if (rows.length === 0) {
    return <div className="empty">{tr(L, 'لا يوجد مخزون بعد', 'Nessun prodotto ancora', 'No stock yet')}</div>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>{tr(L, 'المنتج', 'Prodotto', 'Product')}</th>
          <th>{tr(L, 'الكمية', 'Quantità', 'Quantity')}</th>
          <th>{tr(L, 'الحالة', 'Stato', 'Status')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([id, q]) => {
          const prod = products.find(p => p.id === id);
          const low = lowThreshold > 0 && (q || 0) <= lowThreshold;
          return (
            <tr key={id}>
              <td style={{ fontWeight: 600 }}>{prod ? prod.name : id}</td>
              <td>
                <span className="mono" style={{ fontWeight: 700, fontSize: 16, color: low ? 'var(--orange)' : 'var(--green)' }}>
                  {Number(q).toFixed(1)}
                </span>
                <span className="smallmuted" style={{ marginInlineStart: 4, fontSize: 12 }}>{unit}</span>
              </td>
              <td>
                {low
                  ? <span className="badge warn">⚠️ {tr(L, 'منخفض', 'Basso', 'Low')}</span>
                  : <span className="badge ok">✓</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AddStockModal({ L, title, products, unit, onClose, onSave }) {
  const toast = useToast();
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('');
  return (
    <Modal onClose={onClose} maxWidth={400}>
      <h3>{title}</h3>
      <div className="field">
        <label>{tr(L, 'المنتج', 'Prodotto', 'Product')}</label>
        <select autoFocus value={productId} onChange={e => setProductId(e.target.value)}>
          <option value="">— {tr(L, 'اختر منتج', 'Seleziona prodotto', 'Select product')} —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>{tr(L, 'الكمية', 'Quantità', 'Quantity')} ({unit})</label>
        <input type="number" value={qty} min={0} onChange={e => setQty(Number(e.target.value) || 0)} />
      </div>
      <div className="field">
        <label>{tr(L, 'السبب', 'Motivo', 'Reason')}</label>
        <input value={reason} onChange={e => setReason(e.target.value)}
          placeholder={tr(L, 'مثال: تعديل يدوي', 'es: rettifica manuale', 'e.g. manual adj.')} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose}>{tr(L, 'إلغاء', 'Annulla', 'Cancel')}</button>
        <button className="primary" onClick={() => {
          if (!productId) { toast(tr(L, 'اختر منتج', 'Seleziona prodotto', 'Select product'), true); return; }
          if (qty <= 0) { toast(tr(L, 'أدخل كمية', 'Inserisci quantità', 'Enter qty'), true); return; }
          onSave(productId, qty, reason);
        }}>{tr(L, 'تأكيد', 'Conferma', 'Confirm')}</button>
      </div>
    </Modal>
  );
}

function ShipModal({ L, title, products, stock, unit, onClose, onSave }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [rows, setRows] = useState([{ id: uid(), productId: '', qty: 0 }]);

  const addRow = () => setRows(r => [...r, { id: uid(), productId: '', qty: 0 }]);
  const delRow = (id) => setRows(r => r.filter(x => x.id !== id));
  const setRow = (id, field, val) => setRows(r => r.map(x => x.id !== id ? x : { ...x, [field]: val }));

  const handleSave = () => {
    const valid = rows.filter(r => r.productId && r.qty > 0);
    if (!valid.length) { toast(tr(L, 'أضف منتجاً على الأقل', 'Aggiungi almeno un prodotto', 'Add at least one product'), true); return; }
    onSave(valid.map(r => ({ productId: r.productId, qty: r.qty })), note);
  };

  return (
    <Modal onClose={onClose} maxWidth={560}>
      <h3>{title}</h3>
      <div className="field">
        <label>📝 {tr(L, 'رقم الأوردر / ملاحظة', 'N. ordine / nota', 'Order no. / note')}</label>
        <input autoFocus value={note} onChange={e => setNote(e.target.value)}
          placeholder={tr(L, 'مثال: أوردر #123', 'es: Ordine #123', 'e.g. Order #123')} />
      </div>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontWeight: 700 }}>{tr(L, 'المنتجات', 'Prodotti', 'Products')}</label>
        <button className="primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={addRow}>
          + {tr(L, 'منتج', 'Prodotto', 'Product')}
        </button>
      </div>
      {rows.map(row => {
        const avail = stock[row.productId] || 0;
        const over = row.productId && row.qty > avail;
        return (
          <div key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
            <div className="field" style={{ flex: 3, margin: 0 }}>
              <label style={{ fontSize: 11 }}>{tr(L, 'المنتج', 'Prodotto', 'Product')}</label>
              <select value={row.productId} onChange={e => setRow(row.id, 'productId', e.target.value)}>
                <option value="">—</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {row.productId && (
                <div className="smallmuted" style={{ fontSize: 10, marginTop: 2 }}>
                  {tr(L, 'متاح', 'Disponibile', 'Available')}:{' '}
                  <strong style={{ color: over ? 'var(--red)' : 'var(--green)' }}>{Number(avail).toFixed(1)}</strong> {unit}
                </div>
              )}
            </div>
            <div className="field" style={{ flex: 1, margin: 0 }}>
              <label style={{ fontSize: 11 }}>{unit}</label>
              <input type="number" value={row.qty} min={0}
                style={{ borderColor: over ? 'var(--red)' : undefined }}
                onChange={e => setRow(row.id, 'qty', Number(e.target.value) || 0)} />
            </div>
            {rows.length > 1 && (
              <button className="danger ghost" style={{ padding: '6px 10px', marginBottom: 2 }} onClick={() => delRow(row.id)}>✕</button>
            )}
          </div>
        );
      })}
      {rows.some(r => r.productId && r.qty > 0) && (
        <div className="card" style={{ margin: '8px 0', padding: '10px 14px', background: 'var(--panel)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>📋 {tr(L, 'ملخص', 'Riepilogo', 'Summary')}</div>
          {rows.filter(r => r.productId && r.qty > 0).map(r => {
            const prod = products.find(p => p.id === r.productId);
            return (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                <span>{prod?.name || '—'}</span>
                <span className="mono" style={{ fontWeight: 700 }}>{r.qty} {unit}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose}>{tr(L, 'إلغاء', 'Annulla', 'Cancel')}</button>
        <button className="primary" onClick={handleSave}>
          ✅ {tr(L, 'تأكيد الشحن', 'Conferma spedizione', 'Confirm Shipment')}
        </button>
      </div>
    </Modal>
  );
}
