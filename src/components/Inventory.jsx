import { useState } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { I18N } from '../i18n';
import { bancaleEquivalent, stockStatus } from '../helpers';
import Modal from './Modal';

export default function Inventory() {
  const { state, update, addLog } = useStore();
  const T = I18N[state.lang];
  const [stocking, setStocking] = useState(null);
  const [stockingCover, setStockingCover] = useState(null);
  const [stockingBasket, setStockingBasket] = useState(null);
  const [filterColor, setFilterColor] = useState('all');
  const [filterSize, setFilterSize] = useState('all');

  // Unique colors and sizes across covers + baskets
  const allColors = [...new Set([...state.covers, ...state.baskets].map(x => x.color).filter(Boolean))].sort();
  const allSizes  = [...new Set([...state.covers, ...state.baskets].map(x => x.size).filter(Boolean))].sort();

  const filteredCovers  = state.covers.filter(c =>
    (filterColor === 'all' || c.color === filterColor) &&
    (filterSize  === 'all' || c.size  === filterSize)
  );
  const filteredBaskets = state.baskets.filter(b =>
    (filterColor === 'all' || b.color === filterColor) &&
    (filterSize  === 'all' || b.size  === filterSize)
  );

  const addCoverStock = (id, qty, reason) => {
    update({ covers: state.covers.map(c => c.id !== id ? c : { ...c, stock: (c.stock || 0) + qty }) });
    addLog({ type: 'cover_stock_add', id, qty, reason, by: state.role });
    setStockingCover(null);
  };

  const addBasketStock = (id, qty, reason) => {
    update({ baskets: state.baskets.map(b => b.id !== id ? b : { ...b, stock: (b.stock || 0) + qty }) });
    addLog({ type: 'basket_stock_add', id, qty, reason, by: state.role });
    setStockingBasket(null);
  };

  return (
    <>
      {/* ── Products labels stock ── */}
      {state.products.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>{T.current_stock} — {T.tickets}</h3>
          <div className="grid cols-2">
            {state.products.map(p => {
              const be = bancaleEquivalent(p, p.stock, state.covers, state.baskets);
              const st = stockStatus(be, state.settings.lowStock);
              const pct = Math.min(100, (be / (state.settings.lowStock * 3)) * 100);
              const color = st === 'ok' ? 'var(--green)' : st === 'warn' ? 'var(--orange)' : 'var(--red)';
              return (
                <div className="inv-card" key={p.id}>
                  <div className="flex-between" style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 700 }}>{p.name}</span>
                    <span className={`badge ${st}`}>{be.toFixed(1)} {T.bancale_equiv}</span>
                  </div>
                  <div className="bar-bg" style={{ marginBottom: 8 }}>
                    <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <table>
                    <tbody>
                      <tr><td className="smallmuted">{T.tickets_front}</td><td className="mono">{(p.stock.ticketsFront || 0).toLocaleString()}</td></tr>
                      <tr><td className="smallmuted">{T.tickets_back}</td><td className="mono">{(p.stock.ticketsBack || 0).toLocaleString()}</td></tr>
                      {!p.coverId && p.capsPer > 0 && (
                        <tr><td className="smallmuted">🎩 {T.caps_per}</td><td className="mono">{(p.stock.caps || 0).toLocaleString()}</td></tr>
                      )}
                      {!p.basketId && p.jerricansPer > 0 && (
                        <tr><td className="smallmuted">🪣 {T.jerricans_per}</td><td className="mono">{(p.stock.jerricans || 0).toLocaleString()}</td></tr>
                      )}
                    </tbody>
                  </table>
                  {state.role === 'admin' && (
                    <button style={{ marginTop: 8, fontSize: 12 }} onClick={() => setStocking(p)}>
                      + {T.add_stock}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      {(state.covers.length > 0 || state.baskets.length > 0) && (
        <div className="card" style={{ padding: '10px 18px', marginBottom: 14 }}>
          <div className="row wrap">
            <div>
              <label style={{ fontSize: 11, marginBottom: 2 }}>{T.filter_color}</label>
              <select value={filterColor} onChange={e => setFilterColor(e.target.value)} style={{ width: 'auto' }}>
                <option value="all">{T.all_colors}</option>
                {allColors.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, marginBottom: 2 }}>{T.filter_size}</label>
              <select value={filterSize} onChange={e => setFilterSize(e.target.value)} style={{ width: 'auto' }}>
                <option value="all">{T.all_sizes}</option>
                {allSizes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {(filterColor !== 'all' || filterSize !== 'all') && (
              <button className="ghost" style={{ fontSize: 12, marginTop: 16 }}
                onClick={() => { setFilterColor('all'); setFilterSize('all'); }}>✕ مسح التصفية</button>
            )}
          </div>
        </div>
      )}

      {/* ── Global Covers ── */}
      {(state.covers.length > 0 || state.role === 'admin') && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>🎩 {T.global_covers_inv}</h3>
          {filteredCovers.length === 0 ? (
            <div className="empty">{T.no_covers}</div>
          ) : (
            <div className="global-inv-grid">
              {filteredCovers.map(c => {
                const low = (c.stock || 0) < state.settings.lowStock * 20;
                const pct = Math.min(100, ((c.stock || 0) / Math.max(1, state.settings.lowStock * 100)) * 100);
                return (
                  <div className="inv-card" key={c.id} style={{ borderColor: low ? 'var(--red)' : 'var(--line)' }}>
                    <div className="flex-between" style={{ marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</span>
                      <span className={`badge ${c.coverType === 'front' ? 'blue' : 'warn'}`} style={{ fontSize: 10 }}>
                        {c.coverType === 'front' ? T.front_cover : T.back_cover}
                      </span>
                    </div>
                    <div className="row" style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      {c.color && <span className="color-chip">{c.color}</span>}
                      {c.size  && <span className="size-chip">{c.size}</span>}
                    </div>
                    <div className="bar-bg" style={{ marginBottom: 6 }}>
                      <div className="bar-fill" style={{ width: `${pct}%`, background: low ? 'var(--red)' : 'var(--green)' }} />
                    </div>
                    <div className="stock-row">
                      <span className="stock-num" style={{ color: low ? 'var(--red)' : 'var(--green)', fontSize: 18 }}>
                        {(c.stock || 0).toLocaleString()}
                      </span>
                      <span className="smallmuted">{T.pieces}</span>
                      {low && <span className="badge bad" style={{ fontSize: 10 }}>⚠ {T.cover_stock_low}</span>}
                    </div>
                    {state.role === 'admin' && (
                      <button style={{ marginTop: 8, fontSize: 12, width: '100%' }} onClick={() => setStockingCover(c)}>
                        + {T.add_cover_stock}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Global Baskets ── */}
      {(state.baskets.length > 0 || state.role === 'admin') && (
        <div className="card">
          <h3>🪣 {T.global_baskets_inv}</h3>
          {filteredBaskets.length === 0 ? (
            <div className="empty">{T.no_baskets}</div>
          ) : (
            <div className="global-inv-grid">
              {filteredBaskets.map(b => {
                const low = (b.stock || 0) < state.settings.lowStock * 5;
                const pct = Math.min(100, ((b.stock || 0) / Math.max(1, state.settings.lowStock * 30)) * 100);
                return (
                  <div className="inv-card" key={b.id} style={{ borderColor: low ? 'var(--red)' : 'var(--line)' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{b.name}</div>
                    <div className="row" style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      {b.color && <span className="color-chip">{b.color}</span>}
                      {b.size  && <span className="size-chip">{b.size}</span>}
                    </div>
                    <div className="bar-bg" style={{ marginBottom: 6 }}>
                      <div className="bar-fill" style={{ width: `${pct}%`, background: low ? 'var(--red)' : 'var(--green)' }} />
                    </div>
                    <div className="stock-row">
                      <span className="stock-num" style={{ color: low ? 'var(--red)' : 'var(--green)', fontSize: 18 }}>
                        {(b.stock || 0).toLocaleString()}
                      </span>
                      <span className="smallmuted">{T.pieces}</span>
                      {low && <span className="badge bad" style={{ fontSize: 10 }}>⚠ {T.basket_stock_low}</span>}
                    </div>
                    {state.role === 'admin' && (
                      <button style={{ marginTop: 8, fontSize: 12, width: '100%' }} onClick={() => setStockingBasket(b)}>
                        + {T.add_basket_stock}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {stocking && (
        <LabelStockModal product={stocking} T={T} onClose={() => setStocking(null)}
          onSave={(adds, reason) => {
            const updated = state.products.map(p => {
              if (p.id !== stocking.id) return p;
              return {
                ...p,
                stock: {
                  ...p.stock,
                  ticketsFront: (p.stock.ticketsFront || 0) + adds.ticketsFront,
                  ticketsBack:  (p.stock.ticketsBack  || 0) + adds.ticketsBack,
                  caps:         (p.stock.caps         || 0) + adds.caps,
                  jerricans:    (p.stock.jerricans     || 0) + adds.jerricans,
                },
              };
            });
            update({ products: updated });
            addLog({ type: 'restock', product: stocking.code, reason, by: state.role });
            setStocking(null);
          }} />
      )}
      {stockingCover && (
        <AddStockModal T={T} title={`+ ${T.add_cover_stock} — ${stockingCover.name}`}
          onClose={() => setStockingCover(null)}
          onSave={(qty, reason) => addCoverStock(stockingCover.id, qty, reason)} />
      )}
      {stockingBasket && (
        <AddStockModal T={T} title={`+ ${T.add_basket_stock} — ${stockingBasket.name}`}
          onClose={() => setStockingBasket(null)}
          onSave={(qty, reason) => addBasketStock(stockingBasket.id, qty, reason)} />
      )}
    </>
  );
}

/* ── Label Stock Modal ── */
function LabelStockModal({ product, T, onClose, onSave }) {
  const toast = useToast();
  const [form, setForm] = useState({ ticketsFront: 0, ticketsBack: 0, caps: 0, jerricans: 0 });
  const [reason, setReason] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: Number(v) || 0 }));
  return (
    <Modal onClose={onClose}>
      <h3>{T.add_stock} — {product.name}</h3>
      <div className="grid cols-2">
        <div className="field"><label>{T.tickets_front}</label>
          <input type="number" value={form.ticketsFront} onChange={e => set('ticketsFront', e.target.value)} /></div>
        <div className="field"><label>{T.tickets_back}</label>
          <input type="number" value={form.ticketsBack} onChange={e => set('ticketsBack', e.target.value)} /></div>
        {!product.coverId && (
          <div className="field"><label>🎩 {T.caps_per} ({T.pieces})</label>
            <input type="number" value={form.caps} onChange={e => set('caps', e.target.value)} /></div>
        )}
        {!product.basketId && (
          <div className="field"><label>🪣 {T.jerricans_per} ({T.pieces})</label>
            <input type="number" value={form.jerricans} onChange={e => set('jerricans', e.target.value)} /></div>
        )}
      </div>
      <div className="field"><label>{T.reason}</label>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder={T.reason} /></div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { onSave(form, reason); toast(T.success_added); }}>{T.confirm}</button>
      </div>
    </Modal>
  );
}

/* ── Generic Add Stock Modal ── */
function AddStockModal({ T, title, onClose, onSave }) {
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('');
  const toast = useToast();
  return (
    <Modal onClose={onClose} maxWidth={360}>
      <h3>{title}</h3>
      <div className="field"><label>{T.qty} ({T.pieces})</label>
        <input autoFocus type="number" value={qty} onChange={e => setQty(Number(e.target.value) || 0)} /></div>
      <div className="field"><label>{T.reason}</label>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder={T.reason} /></div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { if (qty > 0) { onSave(qty, reason); toast(T.success_added); } }}>{T.confirm}</button>
      </div>
    </Modal>
  );
}
