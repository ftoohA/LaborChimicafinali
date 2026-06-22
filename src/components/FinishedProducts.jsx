import { useState } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { I18N } from '../i18n';
import Modal from './Modal';

const tr = (L, ar, it, en) => (L === 'ar' ? ar : L === 'it' ? it : en);

export default function FinishedProducts() {
  const { state, update, addLog } = useStore();
  const T = I18N[state.lang];
  const L = state.lang;
  const toast = useToast();
  const isAdmin = state.role === 'admin';

  const [adding, setAdding] = useState(false);   // 'in' (production) | 'out' (order)
  const products = state.products;
  const finished = state.finishedStock || {};
  const lowThreshold = state.settings.lowStock || 5;

  const apply = (productId, qty, reason, dir) => {
    const fs = { ...finished };
    fs[productId] = (fs[productId] || 0) + (dir === 'in' ? qty : -qty);
    update({ finishedStock: fs });
    const prod = products.find(p => p.id === productId);
    addLog({ type: dir === 'in' ? 'finished_stock_add' : 'finished_order_out', productId, product: prod?.code || prod?.name, qty, reason, by: state.role });
    toast(T.success_added);
    setAdding(false);
  };

  const rows = Object.entries(finished).filter(([, q]) => (q || 0) !== 0);

  return (
    <>
      <div className="flex-between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--brand)' }}>🏭 {tr(L, 'المنتجات الجاهزة', 'Prodotti finiti', 'Finished Products')}</h2>
        {isAdmin && (
          <div className="row" style={{ gap: 8 }}>
            <button className="primary" onClick={() => setAdding('in')}>+ {tr(L, 'إضافة إنتاج', 'Aggiungi produzione', 'Add Production')}</button>
            <button onClick={() => setAdding('out')}>− {tr(L, 'تسجيل أوردر', 'Registra ordine', 'Register Order')}</button>
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

      {adding && (
        <MoveModal L={L} T={T} dir={adding} products={products} finished={finished}
          onClose={() => setAdding(false)}
          onSave={(pid, qty, reason) => apply(pid, qty, reason, adding)} />
      )}
    </>
  );
}

function MoveModal({ L, T, dir, products, finished, onClose, onSave }) {
  const toast = useToast();
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('');
  const avail = Number(finished[productId] || 0);
  return (
    <Modal onClose={onClose} maxWidth={400}>
      <h3>{dir === 'in' ? `🏭 ${tr(L, 'إضافة إنتاج', 'Aggiungi produzione', 'Add Production')}` : `📤 ${tr(L, 'تسجيل أوردر (خصم)', 'Registra ordine (uscita)', 'Register Order (out)')}`}</h3>
      <div className="field">
        <label>{T.col_product}</label>
        <select autoFocus value={productId} onChange={e => setProductId(e.target.value)}>
          <option value="">— {tr(L, 'اختر منتج', 'Seleziona prodotto', 'Select product')} —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {productId && <div className="smallmuted" style={{ fontSize: 11 }}>{tr(L, 'المتاح', 'Disponibile', 'Available')}: {avail.toFixed(1)} bancale</div>}
      </div>
      <div className="field">
        <label>{tr(L, 'الكمية (بانكاله)', 'Quantità (bancale)', 'Quantity (bancale)')}</label>
        <input type="number" value={qty} onChange={e => setQty(Number(e.target.value) || 0)} />
      </div>
      <div className="field">
        <label>{T.reason}</label>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder={dir === 'out' ? tr(L, 'رقم الأوردر...', 'N. ordine...', 'Order no...') : T.reason} />
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
