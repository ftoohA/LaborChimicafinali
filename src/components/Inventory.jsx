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
  const [stockingPasta, setStockingPasta] = useState(false);
  const [stockingPastaLiquid, setStockingPastaLiquid] = useState(null);
  const [stockingPastaBox, setStockingPastaBox] = useState(null);
  const [stockingPastaLid, setStockingPastaLid] = useState(null);
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
      {state.products.filter(p => !p.isPasta).length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>{T.current_stock} — {T.tickets}</h3>
          <div className="grid cols-2">
            {state.products.filter(p => !p.isPasta).map(p => {
              const be = bancaleEquivalent(p, p.stock, state.covers, state.baskets, state.pastaStock, state.pastaLiquids, state.settings, state.pastaBoxes, state.pastaLids);
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

      {/* ── Pasta Abrasiva Stock ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>{state.lang === 'ar' ? 'مخزن الباستا والمواد الخام' : state.lang === 'it' ? 'Magazzino pasta e materie prime' : 'Pasta Stock & Raw Materials'}</h3>
        <div className="grid cols-2">
          {/* Sponges & Sponge Lids */}
          {(() => {
            const pastaThreshold = state.settings.lowStockPasta ?? 10;
            const wasteSponge = state.settings.wastePastaSponge ?? 2;
            const wasteSpongeLid = state.settings.wastePastaSpongeLid ?? 2;

            const spongesStock = state.pastaStock?.sponges || 0;
            const spongeLidsStock = state.pastaStock?.spongeLids || 0;

            const spongeCartons = spongesStock / (12 * (1 + wasteSponge / 100));
            const spongeLidCartons = spongeLidsStock / (12 * (1 + wasteSpongeLid / 100));

            const spongeLow = spongeCartons < pastaThreshold;
            const spongeZero = spongesStock <= 0;

            const spongeLidLow = spongeLidCartons < pastaThreshold;
            const spongeLidZero = spongeLidsStock <= 0;

            return (
              <div className="inv-card">
                <div className="flex-between" style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>{state.lang === 'ar' ? 'إسفنج الباستا وأغطية الإسفنج' : state.lang === 'it' ? 'Spugne pasta e coperchi spugna' : 'Pasta Sponges & Sponge Lids'}</span>
                </div>
                <table style={{ width: '100%' }}>
                  <tbody>
                    <tr style={{ background: spongeZero ? 'rgba(220,38,38,0.06)' : spongeLow ? 'rgba(255,165,0,0.04)' : 'transparent' }}>
                      <td style={{ padding: '6px 4px' }}>
                        <span className="smallmuted">{state.lang === 'ar' ? 'الإسفنج' : state.lang === 'it' ? 'Spugne' : 'Sponges'}</span>
                        {spongeLow && (
                          <span style={{ marginInlineStart: 8, fontSize: 11, color: spongeZero ? 'var(--red)' : 'var(--orange)', fontWeight: 700 }}
                            title={state.lang === 'it' ? `Solo ${spongeCartons.toFixed(1)} cartoni disponibili` : `${spongeCartons.toFixed(1)} كرتونة متاحة فقط`}>
                            {spongeZero ? (state.lang === 'ar' ? '🚨 نفد!' : state.lang === 'it' ? '🚨 Esaurito!' : '🚨 Sold out!') : `⚠️ ${spongeCartons.toFixed(1)} ${state.lang === 'ar' ? 'كرتونة' : state.lang === 'it' ? 'cartoni' : 'cartons'}`}
                          </span>
                        )}
                      </td>
                      <td className="mono" style={{ padding: '6px 4px', textAlign: 'right', color: spongeZero ? 'var(--red)' : spongeLow ? 'var(--orange)' : undefined, fontWeight: spongeLow ? 700 : 400 }}>
                        {spongesStock.toLocaleString()} {T.pieces}
                      </td>
                    </tr>
                    <tr style={{ background: spongeLidZero ? 'rgba(220,38,38,0.06)' : spongeLidLow ? 'rgba(255,165,0,0.04)' : 'transparent' }}>
                      <td style={{ padding: '6px 4px' }}>
                        <span className="smallmuted">{state.lang === 'ar' ? 'غطاء الإسفنج' : state.lang === 'it' ? 'Coperchi spugna' : 'Sponge Lids'}</span>
                        {spongeLidLow && (
                          <span style={{ marginInlineStart: 8, fontSize: 11, color: spongeLidZero ? 'var(--red)' : 'var(--orange)', fontWeight: 700 }}
                            title={state.lang === 'it' ? `Solo ${spongeLidCartons.toFixed(1)} cartoni disponibili` : `${spongeLidCartons.toFixed(1)} كرتونة متاحة فقط`}>
                            {spongeLidZero ? (state.lang === 'ar' ? '🚨 نفد!' : state.lang === 'it' ? '🚨 Esaurito!' : '🚨 Sold out!') : `⚠️ ${spongeLidCartons.toFixed(1)} ${state.lang === 'ar' ? 'كرتونة' : state.lang === 'it' ? 'cartoni' : 'cartons'}`}
                          </span>
                        )}
                      </td>
                      <td className="mono" style={{ padding: '6px 4px', textAlign: 'right', color: spongeLidZero ? 'var(--red)' : spongeLidLow ? 'var(--orange)' : undefined, fontWeight: spongeLidLow ? 700 : 400 }}>
                        {spongeLidsStock.toLocaleString()} {T.pieces}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {state.role === 'admin' && (
                  <button style={{ marginTop: 8, fontSize: 12 }} onClick={() => setStockingPasta(true)}>
                    + {T.add_stock}
                  </button>
                )}
              </div>
            );
          })()}

          {/* Pasta Liquids Card */}
          {(() => {
            const pastaThreshold = state.settings.lowStockPasta ?? 10;
            const wasteLiquid = state.settings.wastePastaLiquid ?? 2;
            return (
              <div className="inv-card">
                <div className="flex-between" style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>{state.lang === 'ar' ? 'مخزن سوائل الباستا' : state.lang === 'it' ? 'Magazzino liquidi pasta' : 'Pasta Liquids Stock'}</span>
                </div>
                {(state.pastaLiquids || []).length === 0 ? (
                  <div className="empty" style={{ padding: 12 }}>{state.lang === 'ar' ? 'لا يوجد سوائل مضافة' : state.lang === 'it' ? 'Nessun liquido aggiunto' : 'No liquids added'}</div>
                ) : (
                  <table style={{ width: '100%' }}>
                    <tbody>
                      {state.pastaLiquids.map(pl => {
                        const prodsUsingLiquid = (state.products || []).filter(p => p.isPasta && p.pastaLiquidId === pl.id);
                        const firstProd = prodsUsingLiquid[0];
                        const literPerPiece = firstProd ? (firstProd.liter || 0.5) : 0.5;
                        const litersPerCarton = 12 * literPerPiece;
                        const liquidNeededPerCarton = litersPerCarton * (1 + wasteLiquid / 100);
                        const cartonsAvail = liquidNeededPerCarton > 0 ? (pl.stock || 0) / liquidNeededPerCarton : Infinity;

                        const isLow = cartonsAvail < pastaThreshold;
                        const isZero = pl.stock <= 0;

                        return (
                          <tr key={pl.id} style={{ background: isZero ? 'rgba(220,38,38,0.06)' : isLow ? 'rgba(255,165,0,0.04)' : 'transparent' }}>
                            <td style={{ padding: '6px 4px' }}>
                              <span className="smallmuted" style={{ fontWeight: 600, fontSize: 13 }}>{pl.name}</span>
                              {isLow && (
                                <span style={{ marginInlineStart: 8, fontSize: 11, color: isZero ? 'var(--red)' : 'var(--orange)', fontWeight: 700 }}
                                  title={state.lang === 'it' ? `Solo ${cartonsAvail.toFixed(1)} cartoni disponibili` : `${cartonsAvail.toFixed(1)} كرتونة متاحة فقط`}>
                                  {isZero ? (state.lang === 'ar' ? '🚨 نفد!' : state.lang === 'it' ? '🚨 Esaurito!' : '🚨 Sold out!') : `⚠️ ${cartonsAvail.toFixed(1)} ${state.lang === 'ar' ? 'كرتونة' : state.lang === 'it' ? 'cartoni' : 'cartons'}`}
                                </span>
                              )}
                            </td>
                            <td className="mono" style={{ padding: '6px 4px', color: isZero ? 'var(--red)' : isLow ? 'var(--orange)' : undefined, fontWeight: isLow ? 700 : 400 }}>
                              {(pl.stock || 0).toLocaleString()} {state.lang === 'ar' ? 'لتر' : state.lang === 'it' ? 'Litri' : 'Liters'}
                            </td>
                            {state.role === 'admin' && (
                              <td style={{ textAlign: 'right', padding: '6px 4px' }}>
                                <button style={{ fontSize: 10, padding: '2px 6px', display: 'inline-block' }} onClick={() => setStockingPastaLiquid(pl)}>
                                  +
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })()}

          {/* Pasta Boxes Card */}
          {(() => {
            const pastaThreshold = state.settings.lowStockPasta ?? 10;
            return (
          <div className="inv-card" style={{ marginTop: 12 }}>
            <div className="flex-between" style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>📦 {state.lang === 'ar' ? 'علب الباستا' : state.lang === 'it' ? 'Scatole pasta' : 'Pasta Boxes'}</span>
            </div>
            {(state.pastaBoxes || []).length === 0 ? (
              <div className="empty" style={{ padding: 12 }}>{state.lang === 'ar' ? 'لا توجد علب مضافة' : state.lang === 'it' ? 'Nessuna scatola aggiunta' : 'No boxes added'}</div>
            ) : (
              <table style={{ width: '100%' }}>
                <tbody>
                  {state.pastaBoxes.map(pb => {
                    const cartonsAvail = (pb.stock || 0) / (12 * (1 + (state.settings.wastePastaBox ?? 2) / 100));
                    const isLow = cartonsAvail < pastaThreshold;
                    const isZero = pb.stock <= 0;
                    return (
                    <tr key={pb.id} style={{ background: isZero ? 'rgba(220,38,38,0.06)' : isLow ? 'rgba(255,165,0,0.04)' : 'transparent' }}>
                      <td style={{ padding: '6px 4px' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{pb.name}</span>
                        {isLow && (
                          <span style={{ marginInlineStart: 8, fontSize: 11, color: isZero ? 'var(--red)' : 'var(--orange)', fontWeight: 700 }}
                            title={state.lang === 'it' ? `Solo ${cartonsAvail.toFixed(1)} cartoni disponibili` : `${cartonsAvail.toFixed(1)} كرتونة متاحة فقط`}>
                            {isZero ? (state.lang === 'ar' ? '🚨 نفد!' : state.lang === 'it' ? '🚨 Esaurito!' : '🚨 Sold out!') : `⚠️ ${cartonsAvail.toFixed(1)} ${state.lang === 'ar' ? 'كرتونة' : state.lang === 'it' ? 'cartoni' : 'cartons'}`}
                          </span>
                        )}
                      </td>
                      <td className="mono" style={{ color: isZero ? 'var(--red)' : isLow ? 'var(--orange)' : undefined, fontWeight: isLow ? 700 : 400 }}>
                        {(pb.stock || 0).toLocaleString()} {T.pieces}
                      </td>
                      {state.role === 'admin' && (
                        <td style={{ textAlign: 'right' }}>
                          <button style={{ fontSize: 10, padding: '2px 6px', display: 'inline-block' }} onClick={() => setStockingPastaBox(pb)}>+</button>
                        </td>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
            );
          })()}

          {/* Pasta Lids Card */}
          {(() => {
            const pastaThreshold = state.settings.lowStockPasta ?? 10;
            return (
          <div className="inv-card" style={{ marginTop: 12 }}>
            <div className="flex-between" style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>🔴 {state.lang === 'ar' ? 'أغطية الباستا' : state.lang === 'it' ? 'Coperchi pasta' : 'Pasta Lids'}</span>
            </div>
            {(state.pastaLids || []).length === 0 ? (
              <div className="empty" style={{ padding: 12 }}>{state.lang === 'ar' ? 'لا توجد أغطية مضافة' : state.lang === 'it' ? 'Nessun coperchio aggiunto' : 'No lids added'}</div>
            ) : (
              <table style={{ width: '100%' }}>
                <tbody>
                  {state.pastaLids.map(pl => {
                    const cartonsAvail = (pl.stock || 0) / (12 * (1 + (state.settings.wastePastaLid ?? 2) / 100));
                    const isLow = cartonsAvail < pastaThreshold;
                    const isZero = pl.stock <= 0;
                    return (
                    <tr key={pl.id} style={{ background: isZero ? 'rgba(220,38,38,0.06)' : isLow ? 'rgba(255,165,0,0.04)' : 'transparent' }}>
                      <td style={{ padding: '6px 4px' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{pl.name}</span>
                        {isLow && (
                          <span style={{ marginInlineStart: 8, fontSize: 11, color: isZero ? 'var(--red)' : 'var(--orange)', fontWeight: 700 }}
                            title={state.lang === 'it' ? `Solo ${cartonsAvail.toFixed(1)} cartoni disponibili` : `${cartonsAvail.toFixed(1)} كرتونة متاحة فقط`}>
                            {isZero ? (state.lang === 'ar' ? '🚨 نفد!' : state.lang === 'it' ? '🚨 Esaurito!' : '🚨 Sold out!') : `⚠️ ${cartonsAvail.toFixed(1)} ${state.lang === 'ar' ? 'كرتونة' : state.lang === 'it' ? 'cartoni' : 'cartons'}`}
                          </span>
                        )}
                      </td>
                      <td className="mono" style={{ color: isZero ? 'var(--red)' : isLow ? 'var(--orange)' : undefined, fontWeight: isLow ? 700 : 400 }}>
                        {(pl.stock || 0).toLocaleString()} {T.pieces}
                      </td>
                      {state.role === 'admin' && (
                        <td style={{ textAlign: 'right' }}>
                          <button style={{ fontSize: 10, padding: '2px 6px', display: 'inline-block' }} onClick={() => setStockingPastaLid(pl)}>+</button>
                        </td>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
            );
          })()}
        </div>
      </div>

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
                onClick={() => { setFilterColor('all'); setFilterSize('all'); }}>✕ Azzera filtri</button>
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
      {stockingPasta && (
        <PastaStockModal T={T} lang={state.lang} onClose={() => setStockingPasta(false)}
          onSave={(adds, reason) => {
            const updated = {
              sponges: (state.pastaStock?.sponges || 0) + adds.sponges,
              spongeLids: (state.pastaStock?.spongeLids || 0) + adds.spongeLids,
            };
            update({ pastaStock: updated });
            addLog({ type: 'pasta_stock_add', adds, reason, by: state.role });
            setStockingPasta(false);
          }} />
      )}
      {stockingPastaLiquid && (
        <AddStockModal T={T} title={state.lang === 'ar' ? `+ إضافة مخزون سائل الباستا — ${stockingPastaLiquid.name}` : state.lang === 'it' ? `+ Aggiungi stock liquido pasta — ${stockingPastaLiquid.name}` : `+ Add Pasta Liquid Stock — ${stockingPastaLiquid.name}`}
          unit={state.lang === 'ar' ? 'لتر' : state.lang === 'it' ? 'Litri' : 'Liters'}
          onClose={() => setStockingPastaLiquid(null)}
          onSave={(qty, reason) => {
            const updated = state.pastaLiquids.map(pl =>
              pl.id !== stockingPastaLiquid.id ? pl : { ...pl, stock: (pl.stock || 0) + qty }
            );
            update({ pastaLiquids: updated });
            addLog({ type: 'pasta_liquid_stock_add', name: stockingPastaLiquid.name, qty, reason, by: state.role });
            setStockingPastaLiquid(null);
          }} />
      )}
      {stockingPastaBox && (
        <AddStockModal T={T} title={state.lang === 'ar' ? `+ تعبئة مخزون علب الباستا — ${stockingPastaBox.name}` : state.lang === 'it' ? `+ Rifornisci scatole pasta — ${stockingPastaBox.name}` : `+ Restock Pasta Box — ${stockingPastaBox.name}`}
          onClose={() => setStockingPastaBox(null)}
          onSave={(qty, reason) => {
            const updated = state.pastaBoxes.map(pb =>
              pb.id !== stockingPastaBox.id ? pb : { ...pb, stock: (pb.stock || 0) + qty }
            );
            update({ pastaBoxes: updated });
            addLog({ type: 'pasta_box_stock_add', name: stockingPastaBox.name, qty, reason, by: state.role });
            setStockingPastaBox(null);
          }} />
      )}
      {stockingPastaLid && (
        <AddStockModal T={T} title={state.lang === 'ar' ? `+ تعبئة مخزون أغطية الباستا — ${stockingPastaLid.name}` : state.lang === 'it' ? `+ Rifornisci coperchi pasta — ${stockingPastaLid.name}` : `+ Restock Pasta Lid — ${stockingPastaLid.name}`}
          onClose={() => setStockingPastaLid(null)}
          onSave={(qty, reason) => {
            const updated = state.pastaLids.map(pl =>
              pl.id !== stockingPastaLid.id ? pl : { ...pl, stock: (pl.stock || 0) + qty }
            );
            update({ pastaLids: updated });
            addLog({ type: 'pasta_lid_stock_add', name: stockingPastaLid.name, qty, reason, by: state.role });
            setStockingPastaLid(null);
          }} />
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
function AddStockModal({ T, title, onClose, onSave, unit }) {
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('');
  const toast = useToast();
  return (
    <Modal onClose={onClose} maxWidth={360}>
      <h3>{title}</h3>
      <div className="field"><label>{T.qty} ({unit || T.pieces})</label>
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

/* ── Finished Goods (production) Modal ── */
function FinishedModal({ T, lang, products, onClose, onSave }) {
  const toast = useToast();
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('');
  return (
    <Modal onClose={onClose} maxWidth={400}>
      <h3>🏭 {lang === 'ar' ? 'إضافة إنتاج للمخزن الجاهز' : lang === 'it' ? 'Aggiungi produzione finita' : 'Add Finished Production'}</h3>
      <div className="field">
        <label>{T.col_product}</label>
        <select autoFocus value={productId} onChange={e => setProductId(e.target.value)}>
          <option value="">— {lang === 'ar' ? 'اختر منتج' : lang === 'it' ? 'Seleziona prodotto' : 'Select product'} —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>{lang === 'ar' ? 'الكمية (بانكاله)' : lang === 'it' ? 'Quantità (bancale)' : 'Quantity (bancale)'}</label>
        <input type="number" value={qty} onChange={e => setQty(Number(e.target.value) || 0)} />
      </div>
      <div className="field">
        <label>{T.reason}</label>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder={T.reason} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => {
          if (!productId) { toast(lang === 'ar' ? 'اختر منتج' : lang === 'it' ? 'Seleziona prodotto' : 'Select product', true); return; }
          if (qty > 0) { onSave(productId, qty, reason); toast(T.success_added); }
        }}>{T.confirm}</button>
      </div>
    </Modal>
  );
}

/* ── Pasta Stock Modal ── */
function PastaStockModal({ T, lang, onClose, onSave }) {
  const toast = useToast();
  const [form, setForm] = useState({ sponges: 0, spongeLids: 0 });
  const [reason, setReason] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: Number(v) || 0 }));
  return (
    <Modal onClose={onClose}>
      <h3>{lang === 'ar' ? 'إضافة مخزون الباستا (قطع)' : lang === 'it' ? 'Aggiungi stock pasta (pz)' : 'Add Pasta Stock (pcs)'}</h3>
      <div className="grid cols-2">
        <div className="field">
          <label>{lang === 'ar' ? 'الإسفنج (قطعة)' : lang === 'it' ? 'Spugne (pz)' : 'Sponges (pcs)'}</label>
          <input type="number" value={form.sponges} onChange={e => set('sponges', e.target.value)} />
        </div>
        <div className="field">
          <label>{lang === 'ar' ? 'غطاء الإسفنج (قطعة)' : lang === 'it' ? 'Coperchi spugna (pz)' : 'Sponge Lids (pcs)'}</label>
          <input type="number" value={form.spongeLids} onChange={e => set('spongeLids', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>{T.reason}</label>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder={T.reason} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => { onSave(form, reason); toast(T.success_added); }}>{T.confirm}</button>
      </div>
    </Modal>
  );
}
