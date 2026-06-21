import { useState } from 'react';
import { useStore } from '../store';
import { I18N } from '../i18n';
import { bancaleEquivalent, stockStatus, todayStr } from '../helpers';
import ProgBadge from './ProgBadge';

export default function Dashboard() {
  const { state, update } = useStore();
  const T = I18N[state.lang];
  const today = todayStr();
  const progs = state.programs[today] || [];

  const low = state.products.filter(p => bancaleEquivalent(p, p.stock, state.covers, state.baskets) < state.settings.lowStock);

  const threshold = state.settings.lowStock;

  // Global baskets below threshold
  const lowBaskets = state.baskets.filter(b => (b.stock || 0) < threshold * 5);

  // Products with per-product jerrican stock below threshold (no global basket assigned)
  const lowJerricanProds = state.products.filter(p =>
    !p.basketId && p.jerricansPer > 0 && (p.stock?.jerricans || 0) < threshold * p.jerricansPer
  );

  const hasBasketAlert = lowBaskets.length > 0 || lowJerricanProds.length > 0;

  let totalTarget = 0, totalDone = 0;
  progs.forEach(pr => pr.items.forEach(it => {
    totalTarget += Number(it.target) || 0;
    if (it.status === 'done') totalDone += Number(it.target) || 0;
  }));

  const note = state.managerNotes[today] || '';
  const [search, setSearch] = useState('');

  /* ── Worker view ── */
  if (state.role === 'worker') {
    const filtered = state.products.filter(p =>
      !search || (p.name + p.company + p.code).toLowerCase().includes(search.toLowerCase())
    );
    return (
      <>
        {note && (
          <div className="notes-card" style={{ marginBottom: 16 }}>
            <h3>📋 {T.manager_notes} — {today}</h3>
            <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.7 }}>{note}</p>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <input
            placeholder={T.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 280 }}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty">{T.no_products}</div>
        ) : (
          <div className="grid cols-3">
            {filtered.map(p => {
              const cv  = state.covers.find(x => x.id === p.coverId);
              const bk  = state.baskets.find(x => x.id === p.basketId);
              const be  = bancaleEquivalent(p, p.stock, state.covers, state.baskets);
              const st  = stockStatus(be, state.settings.lowStock);
              return (
                <div className="card" key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Image + name */}
                  <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                    {p.image
                      ? <img src={p.image} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', flexShrink: 0 }} />
                      : <div style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🧴</div>
                    }
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{p.name}</div>
                      <div className="smallmuted" style={{ marginTop: 2 }}>{p.company}</div>
                      <div className="smallmuted">{p.type} · {p.liter}L</div>
                    </div>
                  </div>

                  <hr className="sep" style={{ margin: 0 }} />

                  {/* Code — prominent for workers */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 8, padding: '8px 12px' }}>
                    <span className="smallmuted" style={{ fontSize: 11 }}>{T.code}</span>
                    <span className="mono" style={{ fontSize: 20, fontWeight: 800, letterSpacing: 2, color: 'var(--yellow)' }}>{p.code}</span>
                    {p.barcode && <span className="smallmuted" style={{ fontSize: 11, marginInlineStart: 'auto' }}>{p.barcode}</span>}
                  </div>

                  {/* Cover + basket */}
                  {(cv || bk) && (
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      {cv && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                          🎩 <span className="color-chip">{cv.color}</span>
                          {cv.size && <span className="size-chip">{cv.size}</span>}
                        </span>
                      )}
                      {bk && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                          🪣 <span className="color-chip">{bk.color}</span>
                          {bk.size && <span className="size-chip">{bk.size}</span>}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stock summary */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="smallmuted" style={{ fontSize: 11 }}>{T.bancale_equiv}</span>
                    <span className={`badge ${st}`} style={{ fontSize: 13, fontWeight: 700 }}>{isFinite(be) ? be.toFixed(1) : '∞'}</span>
                  </div>

                  {/* Tickets */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
                      <div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{(p.stock?.ticketsFront || 0).toLocaleString()}</div>
                      <div className="smallmuted" style={{ fontSize: 10 }}>{T.tickets_front}</div>
                    </div>
                    <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
                      <div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{(p.stock?.ticketsBack || 0).toLocaleString()}</div>
                      <div className="smallmuted" style={{ fontSize: 10 }}>{T.tickets_back}</div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {note && (
        <div className="notes-card">
          <h3>📋 {T.manager_notes} — {today}</h3>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.7 }}>{note}</p>
        </div>
      )}
      {!note && state.role === 'admin' && (
        <div className="notes-card" style={{ opacity: .6 }}>
          <h3>📋 {T.manager_notes}</h3>
          <p className="smallmuted">{T.write_notes}</p>
        </div>
      )}

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="num">{state.products.length}</div>
          <div className="lbl">{T.products}</div>
        </div>
        <div className="stat">
          <div className="num">{progs.length}</div>
          <div className="lbl">{T.today_program}</div>
        </div>
        <div className="stat">
          <div className="num">
            {totalDone}
            <span style={{ fontSize: 16, color: 'var(--muted)' }}>/{totalTarget}</span>
          </div>
          <div className="lbl">{T.total_done} / {T.total_target}</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: low.length ? 'var(--red)' : 'var(--green)' }}>
            {low.length}
          </div>
          <div className="lbl">{T.low_stock_warning}</div>
        </div>
        {hasBasketAlert && (
          <div className="stat" style={{ borderColor: 'var(--orange)' }}>
            <div className="num" style={{ color: 'var(--orange)' }}>
              {lowBaskets.length + lowJerricanProds.length}
            </div>
            <div className="lbl">🪣 جراكن ناقصة</div>
          </div>
        )}
      </div>

      {low.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--red)', marginBottom: 16 }}>
          <h3 style={{ color: 'var(--red)' }}>⚠ {T.low_stock_warning}</h3>
          <table>
            <thead>
              <tr><th>{T.products}</th><th>{T.company}</th><th>{T.bancale_equiv}</th></tr>
            </thead>
            <tbody>
              {low.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.company}</td>
                  <td className="mono">{bancaleEquivalent(p, p.stock, state.covers, state.baskets).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasBasketAlert && (
        <div className="card" style={{ borderColor: 'var(--orange)', marginBottom: 16 }}>
          <h3 style={{ color: 'var(--orange)', marginBottom: 12 }}>🪣 جراكن ناقصة — تحتاج تعبية</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lowBaskets.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🪣</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    {(b.color || b.size) && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                        {b.color && <span className="color-chip">{b.color}</span>}
                        {b.size  && <span className="size-chip">{b.size}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'end' }}>
                  <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>
                    {(b.stock || 0).toLocaleString()}
                  </span>
                  <span className="smallmuted" style={{ marginInlineStart: 4 }}>{T.pieces}</span>
                </div>
              </div>
            ))}
            {lowJerricanProds.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>📦</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="smallmuted" style={{ fontSize: 11 }}>{p.company}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'end' }}>
                  <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>
                    {(p.stock?.jerricans || 0).toLocaleString()}
                  </span>
                  <span className="smallmuted" style={{ marginInlineStart: 4 }}>{T.pieces}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{T.today_program} — {today}</h3>
          <button style={{ fontSize: 12 }} onClick={() => update({ tab: 'program' })}>
            {T.program} →
          </button>
        </div>
        {progs.length === 0 ? (
          <div className="empty">{T.no_program_today}</div>
        ) : progs.map((pr, pi) => (
          <ProgramSummary key={pi} pr={pr} T={T} state={state} />
        ))}
      </div>
    </>
  );
}

function ProgramSummary({ pr, T, state }) {
  return (
    <div className="prog-section">
      <div className="prog-header">
        <ProgBadge type={pr.progType} T={T} />
        <span className="prog-title">{pr.label || ''}</span>
      </div>
      <div className="sched-wrap">
        <table className="sched-table">
          <thead>
            <tr>
              <th>{T.col_time}</th>
              <th>{T.col_product}</th>
              <th>{T.col_cover}</th>
              <th>{T.col_basket}</th>
              <th>{T.col_target}</th>
              <th>{T.col_kilos}</th>
              <th>{T.col_notes}</th>
              <th>{T.col_confirm}</th>
            </tr>
          </thead>
          <tbody>
            {pr.items.map((it, ii) => {
              const p = state.products.find(x => x.id === it.productId);
              const cv = state.covers.find(x => x.id === it.coverId);
              const bk = state.baskets.find(x => x.id === it.basketId);
              return (
                <tr key={ii} className={it.status === 'done' ? 'row-done' : 'row-pending'}>
                  <td className="mono smallmuted">{it.time || '—'}</td>
                  <td><strong>{p ? p.name : '?'}</strong></td>
                  <td className="smallmuted">{cv ? cv.name : '—'}</td>
                  <td className="smallmuted">{bk ? bk.name : '—'}</td>
                  <td className="mono">{it.target || '—'}</td>
                  <td className="mono">{it.kilos || '—'}</td>
                  <td className="smallmuted" style={{ maxWidth: 120 }}>{it.notes || ''}</td>
                  <td>
                    {it.status === 'done'
                      ? <span className="badge ok">✓</span>
                      : <span className="badge warn">{T.pending}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
