import { useState } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { I18N } from '../i18n';
import { uid } from '../helpers';
import Modal from './Modal';

const tr = (L, ar, it, en) => (L === 'ar' ? ar : L === 'it' ? it : en);

export default function FinishedProducts() {
  const { state, update, addLog } = useStore();
  const T = I18N[state.lang];
  const L = state.lang;
  const toast = useToast();
  const isAdmin = state.role === 'admin';

  const [adding, setAdding] = useState(false);   // 'in' | 'out'
  const products = state.products;
  const finished = state.finishedStock || {};
  const lowThreshold = state.settings.lowStock || 5;

  const applyIn = (productId, qty, reason) => {
    const fs = { ...finished };
    fs[productId] = (fs[productId] || 0) + qty;
    update({ finishedStock: fs });
    const prod = products.find(p => p.id === productId);
    addLog({ type: 'finished_stock_add', productId, product: prod?.code || prod?.name, qty, reason, by: state.role });
    toast(T.success_added);
  };

  const applyOrder = (items, orderNote) => {
    const fs = { ...finished };
    items.forEach(({ productId, qty }) => {
      fs[productId] = Math.max(0, (fs[productId] || 0) - qty);
      const prod = products.find(p => p.id === productId);
      addLog({ type: 'finished_order_out', productId, product: prod?.code || prod?.name, qty, reason: orderNote, orderId: uid(), by: state.role });
    });
    update({ finishedStock: fs });
    toast(T.success_added);
  };

  const rows = Object.entries(finished).filter(([, q]) => (q || 0) !== 0);

  return (
    <>
      <div className="flex-between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--brand)' }}>🏭 {tr(L, 'المنتجات الجاهزة', 'Prodotti finiti', 'Finished Products')}</h2>
        {isAdmin && (
          <div className="row" style={{ gap: 8 }}>
            <button className="primary" onClick={() => setAdding('in')}>+ {tr(L, 'إضافة إنتاج', 'Aggiungi produzione', 'Add Production')}</button>
            <button onClick={() => setAdding('out')}>📦 {tr(L, 'أوردر شحن', 'Ordine spedizione', 'Shipping Order')}</button>
          </div>
        )}
      </div>

      <div className="card">
        <p className="smallmuted" style={{ marginTop: 0 }}>
          {tr(L, 'يتعبّى تلقائياً من إنتاج البرامج (الخط/الباستا)، ويُخصم مع طلبيات أمازون والأوردرات.', 'Si riempie automaticamente dalla produzione (Linea/Pasta) e si scala con gli ordini Amazon.', 'Auto-filled from production (Linea/Pasta), deducted by Amazon orders.')}
        </p>
        {rows.length === 0 ? (
          <div className="empty">{tr(L, 'لا يوجد مخزون جاهز بعد', 'Nessun prodotto finito ancora', 'No finished stock yet')}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{T.col_product}</th>
                <th>{tr(L, 'المخزون (بانكاله)', 'Giacenza (bancale)', 'Stock (bancale)')}</th>
                <th>{tr(L, 'الحالة', 'Stato', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([id, q]) => {
                const prod = products.find(p => p.id === id);
                const low = (q || 0) <= lowThreshold;
                return (
                  <tr key={id}>
                    <td style={{ fontWeight: 600 }}>{prod ? prod.name : id}</td>
                    <td><span className="mono" style={{ fontWeight: 700, fontSize: 16, color: low ? 'var(--orange)' : 'var(--green)' }}>{Number(q).toFixed(1)}</span></td>
                    <td>{low ? <span className="badge warn">⚠️ {tr(L, 'منخفض', 'Basso', 'Low')}</span> : <span className="badge ok">✓</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {adding === 'in' && (
        <SingleProductModal L={L} T={T} products={products} finished={finished}
          title={`🏭 ${tr(L, 'إضافة إنتاج', 'Aggiungi produzione', 'Add Production')}`}
          onClose={() => setAdding(false)}
          onSave={(pid, qty, reason) => { applyIn(pid, qty, reason); setAdding(false); }} />
      )}
      {adding === 'out' && (
        <OrderModal L={L} T={T} products={products} finished={finished}
          onClose={() => setAdding(false)}
          onSave={(items, note) => { applyOrder(items, note); setAdding(false); }} />
      )}
    </>
  );
}

function SingleProductModal({ L, T, products, finished, title, onClose, onSave }) {
  const toast = useToast();
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('');
  return (
    <Modal onClose={onClose} maxWidth={400}>
      <h3>{title}</h3>
      <div className="field">
        <label>{T.col_product}</label>
        <select autoFocus value={productId} onChange={e => setProductId(e.target.value)}>
          <option value="">— {tr(L, 'اختر منتج', 'Seleziona prodotto', 'Select product')} —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>{tr(L, 'الكمية (بانكاله)', 'Quantità (bancale)', 'Quantity (bancale)')}</label>
        <input type="number" value={qty} onChange={e => setQty(Number(e.target.value) || 0)} />
      </div>
      <div className="field">
        <label>{T.reason}</label>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder={T.reason} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => {
          if (!productId) { toast(tr(L, 'اختر منتج', 'Seleziona prodotto', 'Select product'), true); return; }
          if (qty > 0) onSave(productId, qty, reason);
        }}>{T.confirm}</button>
      </div>
    </Modal>
  );
}

function OrderModal({ L, T, products, finished, onClose, onSave }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [rows, setRows] = useState([{ id: uid(), productId: '', qty: 0 }]);

  const addRow = () => setRows(r => [...r, { id: uid(), productId: '', qty: 0 }]);
  const delRow = (id) => setRows(r => r.filter(x => x.id !== id));
  const setRow = (id, field, val) => setRows(r => r.map(x => x.id !== id ? x : { ...x, [field]: val }));

  const handleSave = () => {
    const valid = rows.filter(r => r.productId && r.qty > 0);
    if (valid.length === 0) { toast(tr(L, 'أضف منتجاً على الأقل', 'Aggiungi almeno un prodotto', 'Add at least one product'), true); return; }
    const items = valid.map(r => ({ productId: r.productId, qty: r.qty }));
    onSave(items, note);
  };

  return (
    <Modal onClose={onClose} maxWidth={560}>
      <h3>📦 {tr(L, 'أوردر شحن — كاميون', 'Ordine spedizione — camion', 'Shipping Order — Truck')}</h3>
      <div className="field">
        <label>📝 {tr(L, 'رقم الأوردر / ملاحظة', 'N. ordine / nota', 'Order no. / note')}</label>
        <input autoFocus value={note} onChange={e => setNote(e.target.value)} placeholder={tr(L, 'مثال: أوردر #123', 'es: Ordine #123', 'e.g. Order #123')} />
      </div>

      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontWeight: 700 }}>{tr(L, 'المنتجات', 'Prodotti', 'Products')}</label>
        <button className="primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={addRow}>+ {tr(L, 'منتج', 'Prodotto', 'Product')}</button>
      </div>

      {rows.map(row => {
        const avail = finished[row.productId] || 0;
        const overstock = row.productId && row.qty > avail;
        return (
          <div key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
            <div className="field" style={{ flex: 3, margin: 0 }}>
              <label style={{ fontSize: 11 }}>{T.col_product}</label>
              <select value={row.productId} onChange={e => setRow(row.id, 'productId', e.target.value)}>
                <option value="">— {tr(L, 'اختر', 'Seleziona', 'Select')} —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {row.productId && (
                <div className="smallmuted" style={{ fontSize: 10, marginTop: 2 }}>
                  {tr(L, 'متاح', 'Disponibile', 'Available')}: <strong style={{ color: overstock ? 'var(--red)' : 'var(--green)' }}>{Number(avail).toFixed(1)}</strong> bancale
                </div>
              )}
            </div>
            <div className="field" style={{ flex: 1, margin: 0 }}>
              <label style={{ fontSize: 11 }}>{tr(L, 'بانكاله', 'Bancale', 'Bancale')}</label>
              <input type="number" value={row.qty} min={0}
                style={{ borderColor: overstock ? 'var(--red)' : undefined }}
                onChange={e => setRow(row.id, 'qty', Number(e.target.value) || 0)} />
            </div>
            {rows.length > 1 && (
              <button className="danger ghost" style={{ padding: '6px 10px', marginBottom: 2 }} onClick={() => delRow(row.id)}>✕</button>
            )}
          </div>
        );
      })}

      {/* Summary */}
      {rows.some(r => r.productId && r.qty > 0) && (
        <div className="card" style={{ margin: '8px 0', padding: '10px 14px', background: 'var(--panel)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>📋 {tr(L, 'ملخص الأوردر', 'Riepilogo ordine', 'Order Summary')}</div>
          {rows.filter(r => r.productId && r.qty > 0).map(r => {
            const prod = products.find(p => p.id === r.productId);
            return (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                <span>{prod?.name || '—'}</span>
                <span className="mono" style={{ fontWeight: 700 }}>{r.qty} bancale</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={handleSave}>
          ✅ {tr(L, 'تأكيد الأوردر', 'Conferma ordine', 'Confirm Order')}
        </button>
      </div>
    </Modal>
  );
}
