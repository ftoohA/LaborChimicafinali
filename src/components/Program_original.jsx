<line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
import { useState, useRef } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { I18N, PROG_TYPES } from '../i18n';
import { todayStr, updateProgramItem, uid } from '../helpers';
import Modal from './Modal';
import ProgBadge from './ProgBadge';

export default function Program() {
  const { state, update, addLog } = useStore();
  const T = I18N[state.lang];
  const toast = useToast();

  const date = state.progDate || todayStr();
  const typeFilter = state.progTypeFilter || 'all';
  const allProgs = state.programs[date] || [];
  const progs = typeFilter === 'all' ? allProgs : allProgs.filter(p => p.progType === typeFilter);

  const [showAddProg, setShowAddProg] = useState(false);
  const [confirmItem, setConfirmItem] = useState(null); // {pi, ii, action}
  const [notesText, setNotesText] = useState(state.managerNotes[date] || '');

  const setDate = (d) => {
    update({ progDate: d });
    setNotesText(state.managerNotes[d] || '');
  };

  const saveNotes = () => {
    update({ managerNotes: { ...state.managerNotes, [date]: notesText } });
    toast(T.success_added);
  };

  const deleteProgram = (realPi) => {
    if (!confirm(T.confirm_delete)) return;
    const newList = allProgs.filter((_, i) => i !== realPi);
    update({ programs: { ...state.programs, [date]: newList } });
    addLog({ type: 'delete_program', date, by: state.role });
  };

  const carryOver = (realPi) => {
    const pr = allProgs[realPi];
    const pending = pr.items.filter(i => i.status !== 'done');
    if (!pending.length) return;
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const nextStr = next.toISOString().slice(0, 10);
    const existing = state.programs[nextStr] || [];
    update({
      programs: {
        ...state.programs,
        [nextStr]: [...existing, {
          id: uid(), label: pr.label, progType: pr.progType,
          items: pending.map(i => ({ ...i, kilos: 0, notes: '', status: 'pending' })),
        }],
      },
    });
    addLog({ type: 'carry_over', from: date, to: nextStr, count: pending.length, by: state.role });
    toast(T.success_added);
  };

  const updateInlineField = (realPi, ii, field, value) => {
    const newProgs = updateProgramItem(state.programs, date, realPi, ii, { [field]: value });
    update({ programs: newProgs });
  };

  // Build rows array for an item (lazy from target)
  const makeRows = (it) => {
    const n = Math.max(1, Number(it.target) || 1);
    return it.rows ?? Array.from({ length: n }, () => ({ kilos: '', done: false }));
  };

  const handleConfirm = ({ pi, ii, action, pendingRows }) => {
    const it = allProgs[pi].items[ii];
    const p = state.products.find(x => x.id === it.productId);
    if (!p) return;
    const s = state.settings;
    const target = Number(it.target);
    const sign = action === 'done' ? -1 : 1;

    const updatedProducts = state.products.map(prod => {
      if (prod.id !== p.id) return prod;
      return {
        ...prod,
        stock: {
          ...prod.stock,
          ticketsFront: prod.stock.ticketsFront + sign * target * prod.ticketsFront * (1 + s.wasteTicket / 100),
          ticketsBack:  prod.stock.ticketsBack  + sign * target * prod.ticketsBack  * (1 + s.wasteTicket / 100),
          caps:      !prod.coverId  ? prod.stock.caps      + sign * target * prod.capsPer      * (1 + s.wasteCap / 100)      : prod.stock.caps,
          jerricans: !prod.basketId ? prod.stock.jerricans + sign * target * prod.jerricansPer * (1 + s.wasteJerrican / 100) : prod.stock.jerricans,
        },
      };
    });

    const effectiveCoverId  = it.coverId  || p.coverId;
    const effectiveBasketId = it.basketId || p.basketId;
    const updatedCovers = effectiveCoverId && p.capsPer > 0
      ? state.covers.map(c => c.id !== effectiveCoverId ? c : {
          ...c, stock: (c.stock || 0) + sign * target * p.capsPer * (1 + s.wasteCap / 100),
        })
      : state.covers;
    const updatedBaskets = effectiveBasketId && p.jerricansPer > 0
      ? state.baskets.map(b => b.id !== effectiveBasketId ? b : {
          ...b, stock: (b.stock || 0) + sign * target * p.jerricansPer * (1 + s.wasteJerrican / 100),
        })
      : state.baskets;

    const rowsUpdate = action === 'done'
      ? { status: 'done',    rows: pendingRows ?? makeRows(it).map(r => ({ ...r, done: true })) }
      : { status: 'pending', rows: makeRows(it).map(r => ({ ...r, done: false })) };

    const newProgs = updateProgramItem(state.programs, date, pi, ii, rowsUpdate);
    update({ programs: newProgs, products: updatedProducts, covers: updatedCovers, baskets: updatedBaskets });
    addLog({ type: action === 'done' ? 'produce' : 'undo', product: p.code, target, date, by: state.role });
    toast(action === 'done' ? T.success_done : T.success_undo);
    setConfirmItem(null);
  };

  // Check a single row; if last unchecked → open confirm modal
  const handleRowCheck = (pi, ii, rowIdx) => {
    const it = allProgs[pi].items[ii];
    const rows = makeRows(it);
    const newRows = rows.map((r, i) => i === rowIdx ? { ...r, done: true } : r);
    if (newRows.every(r => r.done)) {
      setConfirmItem({ pi, ii, action: 'done', pendingRows: newRows });
    } else {
      update({ programs: updateProgramItem(state.programs, date, pi, ii, { rows: newRows }) });
    }
  };

  const updateRowKilos = (pi, ii, rowIdx, val) => {
    const it = allProgs[pi].items[ii];
    const rows = makeRows(it);
    const newRows = rows.map((r, i) => i === rowIdx ? { ...r, kilos: val } : r);
    update({ programs: updateProgramItem(state.programs, date, pi, ii, { rows: newRows }) });
  };

  // Flat expanded rows for worker Excel view
  const flatRows = allProgs.flatMap((pr, pi) =>
    pr.items.flatMap((it, ii) => {
      const rows = makeRows(it);
      return rows.map((row, rowIdx) => ({ it, pi, ii, pr, row, rowIdx, rows }));
    })
  );

  if (state.role === 'worker') {
    const doneRows  = flatRows.filter(x => x.row.done).length;
    const totalRows = flatRows.length;

    return (
      <>
        {/* Date + progress */}
        <div className="card" style={{ padding: '10px 18px', marginBottom: 14 }}>
          <div className="row wrap" style={{ gap: 12, alignItems: 'center' }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ width: 'auto', padding: '7px 10px' }} />
            <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 6, height: 10, minWidth: 80, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: doneRows === totalRows && totalRows > 0 ? 'var(--green)' : 'var(--yellow)', width: totalRows ? `${(doneRows / totalRows) * 100}%` : '0%', transition: 'width .3s' }} />
            </div>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: doneRows === totalRows && totalRows > 0 ? 'var(--green)' : 'var(--muted)' }}>
              {doneRows} / {totalRows}
            </span>
          </div>
        </div>

        {/* Manager notes */}
        {state.managerNotes[date] && (
          <div className="notes-card" style={{ marginBottom: 16 }}>
            <h3>📋 {T.manager_notes}</h3>
            <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.7 }}>{state.managerNotes[date]}</p>
          </div>
        )}

        {flatRows.length === 0 ? (
          <div className="empty">{T.no_program_today}</div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="sched-wrap">
              <table className="sched-table">
                <thead>
                  <tr>
                    <th style={{ width: 38 }}>#</th>
                    <th style={{ minWidth: 200 }}>{T.col_product}</th>
                    <th style={{ minWidth: 120 }}>{T.col_cover}</th>
                    <th style={{ minWidth: 120 }}>{T.col_basket}</th>
                    <th style={{ width: 88 }}>{T.col_kilos}</th>
                    <th style={{ width: 52, textAlign: 'center' }}>✓</th>
                  </tr>
                </thead>
                <tbody>
                  {flatRows.map(({ it, pi, ii, row, rowIdx }, globalIdx) => {
                    const p   = state.products.find(x => x.id === it.productId);
                    const cv  = state.covers.find(x => x.id === (it.coverId  || p?.coverId));
                    const bk  = state.baskets.find(x => x.id === (it.basketId || p?.basketId));
                    const isDone = row.done || it.status === 'done';
                    return (
                      <tr key={`${pi}-${ii}-${rowIdx}`} className={isDone ? 'row-done' : 'row-pending'}>

                        {/* # */}
                        <td className="mono smallmuted" style={{ textAlign: 'center', verticalAlign: 'middle' }}>{globalIdx + 1}</td>

                        {/* Product details */}
                        <td style={{ verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {p?.image
                              ? <img src={p.image} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', flexShrink: 0 }} />
                              : <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🧴</div>
                            }
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>
                                {p ? p.name : <span style={{ color: 'var(--red)' }}>?</span>}
                              </div>
                              {p && <div className="smallmuted" style={{ fontSize: 11 }}>{p.company} · {p.type} · {p.liter}L</div>}
                              {p && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                                  <div style={{ background: 'var(--bg)', borderRadius: 4, padding: '2px 7px' }}>
                                    <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--yellow)', letterSpacing: 1 }}>{p.code}</span>
                                  </div>
                                  {p.barcode && (
                                    <div style={{ background: 'var(--bg)', borderRadius: 4, padding: '2px 7px' }}>
                                      <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 0.5 }}>📦 {p.barcode}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {it.notes && <div className="smallmuted" style={{ fontSize: 10, marginTop: 2 }}>📝 {it.notes}</div>}
                            </div>
                          </div>
                        </td>

                        {/* Cover */}
                        <td style={{ verticalAlign: 'middle' }}>
                          {cv ? (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{cv.name}</div>
                              <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                                {cv.color && <span className="color-chip">{cv.color}</span>}
                                {cv.size  && <span className="size-chip">{cv.size}</span>}
                                <span className={`badge ${cv.coverType === 'front' ? 'blue' : 'warn'}`} style={{ fontSize: 10 }}>
                                  {cv.coverType === 'front' ? T.front_cover : T.back_cover}
                                </span>
                              </div>
                            </div>
                          ) : <span className="smallmuted">—</span>}
                        </td>

                        {/* Basket */}
                        <td style={{ verticalAlign: 'middle' }}>
                          {bk ? (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{bk.name}</div>
                              <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                                {bk.color && <span className="color-chip">{bk.color}</span>}
                                {bk.size  && <span className="size-chip">{bk.size}</span>}
                              </div>
                            </div>
                          ) : <span className="smallmuted">—</span>}
                        </td>

                        {/* Kilos */}
                        <td style={{ verticalAlign: 'middle' }}>
                          {isDone
                            ? <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{row.kilos || '—'}</span>
                            : (
                              <input
                                className="kilo-field"
                                type="number"
                                placeholder="كجم"
                                defaultValue={row.kilos || ''}
                                onBlur={e => updateRowKilos(pi, ii, rowIdx, e.target.value)}
                                style={{ width: 72 }}
                              />
                            )}
                        </td>

                        {/* Confirm */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          {isDone
                            ? <span style={{ color: 'var(--green)', fontSize: 22, fontWeight: 700 }}>✓</span>
                            : (
                              <input type="checkbox" className="confirm-cb"
                                onChange={e => { if (e.target.checked) { e.target.checked = false; handleRowCheck(pi, ii, rowIdx); } }}
                              />
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {confirmItem && (
          <ConfirmCodeModal
            item={allProgs[confirmItem.pi]?.items[confirmItem.ii]}
            action={confirmItem.action}
            T={T}
            products={state.products}
            onClose={() => setConfirmItem(null)}
            onConfirm={() => handleConfirm(confirmItem)}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* Controls */}
      <div className="card" style={{ padding: '12px 18px', marginBottom: 14 }}>
        <div className="row wrap">
          <div>
            <label style={{ fontSize: 11, marginBottom: 2 }}>{T.date}</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ width: 'auto', padding: '7px 10px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, marginBottom: 2 }}>{T.prog_type}</label>
            <select value={typeFilter} onChange={e => update({ progTypeFilter: e.target.value })} style={{ width: 'auto' }}>
              <option value="all">{T.all_types}</option>
              {PROG_TYPES.map(tp => (
                <option key={tp} value={tp}>{T[`prog_${tp}`]}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }} />
          {state.role === 'admin' && (
            <button className="primary" onClick={() => setShowAddProg(true)}>
              + {T.add_program}
            </button>
          )}
        </div>
      </div>

      {/* Manager notes */}
      <div className="notes-card" style={{ marginBottom: 16 }}>
        <h3>📋 {T.manager_notes} — {date}</h3>
        <textarea
          className="notes-ta"
          placeholder={T.write_notes}
          value={notesText}
          onChange={e => setNotesText(e.target.value)}
          style={{ minHeight: 80 }}
        />
        <div style={{ marginTop: 8 }}>
          <button className="primary" onClick={saveNotes}>{T.save_notes}</button>
        </div>
      </div>

      {/* Programs */}
      {progs.length === 0 ? (
        <div className="empty">{T.no_program_today}</div>
      ) : progs.map(pr => {
        const realPi = allProgs.indexOf(pr);
        const allDone = pr.items.every(i => i.status === 'done');
        return (
          <div className="card prog-section" key={pr.id}>
            <div className="prog-header flex-between">
              <div className="row">
                <ProgBadge type={pr.progType} T={T} />
                <span className="prog-title">{pr.label || T.today_program}</span>
                {allDone && <span className="badge ok">✓ {T.done}</span>}
              </div>
              <div className="row">
                {!allDone && (
                  <button className="ghost" style={{ fontSize: 12 }} onClick={() => carryOver(realPi)}>
                    {T.carry_over} →
                  </button>
                )}
                <button className="danger ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => deleteProgram(realPi)}>
                  ✕
                </button>
              </div>
            </div>

            <div className="sched-wrap">
              <table className="sched-table">
                <thead>
                  <tr>
                    <th>#</th>
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
                    const p  = state.products.find(x => x.id === it.productId);
                    const cv = state.covers.find(x => x.id === it.coverId);
                    const bk = state.baskets.find(x => x.id === it.basketId);
<line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
                    return (
                      <tr key={ii} className={it.status === 'done' ? 'row-done' : 'row-pending'}>
                        <td className="mono smallmuted">{ii + 1}</td>
                        <td className="mono">{it.time || '—'}</td>
                        <td>
                          <strong>{p ? p.name : <span style={{ color: 'var(--red)' }}>?</span>}</strong>
                          {p && <><br /><span className="smallmuted">{p.code}</span></>}
                        </td>
                        <td className="smallmuted">{cv ? cv.name : '—'}</td>
                        <td className="smallmuted">{bk ? bk.name : '—'}</td>
                        <td className="mono" style={{ fontWeight: 700 }}>{it.target || '—'}</td>
                        <td>
                          <input
                            className="kilo-field"
                            type="number"
                            defaultValue={it.kilos || ''}
                            placeholder="كجم"
                            onBlur={e => updateInlineField(realPi, ii, 'kilos', Number(e.target.value) || 0)}
                          />
                        </td>
                        <td>
                          <input
                            className="row-notes-inp"
                            type="text"
                            defaultValue={it.notes || ''}
                            placeholder="..."
                            onBlur={e => updateInlineField(realPi, ii, 'notes', e.target.value)}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {it.status === 'done' ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button
                                className="ghost"
                                style={{ fontSize: 16, padding: '2px 6px' }}
                                title={T.undo}
                                onClick={() => setConfirmItem({ pi: realPi, ii, action: 'undo' })}
                              >↩</button>
                              <span className="badge ok">✓</span>
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              className="confirm-cb"
                              title={T.confirm}
                              onChange={e => {
                                if (e.target.checked) {
                                  e.target.checked = false;
                                  setConfirmItem({ pi: realPi, ii, action: 'done' });
                                }
                              }}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {showAddProg && (
        <AddProgramModal
          date={date}
          T={T}
          state={state}
          onClose={() => setShowAddProg(false)}
          onSave={(prog) => {
            const existing = state.programs[date] || [];
            update({ programs: { ...state.programs, [date]: [...existing, prog] } });
            addLog({ type: 'program_added', date, count: prog.items.length, by: state.role });
            toast(T.success_added);
            setShowAddProg(false);
          }}
        />
      )}

      {confirmItem && (
        <ConfirmCodeModal
          item={allProgs[confirmItem.pi]?.items[confirmItem.ii]}
          action={confirmItem.action}
          T={T}
          products={state.products}
          onClose={() => setConfirmItem(null)}
          onConfirm={() => handleConfirm(confirmItem)}
        />
      )}
    </>
  );
}

/* ---- Add Program Modal ---- */
function AddProgramModal({ date, T, state, onClose, onSave }) {
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [progType, setProgType] = useState('daily');
  const emptyRow = () => ({ id: uid(), productId: '', coverId: '', basketId: '', time: '', target: '', kilos: '', notes: '' });
  const [rows, setRows] = useState([emptyRow()]);

  const setRow = (id, field, value) =>
    setRows(r => r.map(x => x.id === id ? { ...x, [field]: value } : x));

  // Auto-fill cover/basket from product defaults when product is selected
  const onProductSelect = (rowId, productId) => {
    const prod = state.products.find(p => p.id === productId);
    setRows(r => r.map(x => x.id !== rowId ? x : {
      ...x,
      productId,
      coverId:  prod?.coverId  || x.coverId,
      basketId: prod?.basketId || x.basketId,
    }));
  };
  const addRow = () => setRows(r => [...r, emptyRow()]);
  const removeRow = (id) => { if (rows.length > 1) setRows(r => r.filter(x => x.id !== id)); };

  const handleSave = () => {
    const items = rows
      .filter(r => r.productId && Number(r.target) > 0)
      .map(r => ({
        productId: r.productId,
        coverId: r.coverId || null,
        basketId: r.basketId || null,
        time: r.time || '',
        target: Number(r.target),
        kilos: Number(r.kilos) || 0,
        notes: r.notes || '',
        status: 'pending',
      }));
    if (!items.length) { toast('—', true); return; }
    onSave({ id: uid(), label: label || T[`prog_${progType}`], progType, items });
  };

  return (
    <Modal onClose={onClose} maxWidth={900}>
      <h3>{T.add_program} — {date}</h3>
      <div className="grid cols-2" style={{ marginBottom: 14 }}>
        <div className="field">
          <label>{T.prog_label}</label>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder={`${T.prog_daily}...`} />
        </div>
        <div className="field">
          <label>{T.prog_type}</label>
          <select value={progType} onChange={e => setProgType(e.target.value)}>
            {PROG_TYPES.map(tp => <option key={tp} value={tp}>{T[`prog_${tp}`]}</option>)}
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--muted)', fontSize: 11 }}>
              {[T.col_product, T.col_cover, T.col_basket, T.col_time, T.col_target, T.col_kilos, T.col_notes, ''].map((h, i) => (
                <th key={i} style={{ padding: '6px 4px', textAlign: 'start', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td style={{ padding: '4px 3px' }}>
                  <select className="input-sm" style={{ minWidth: 130 }} value={row.productId}
                    onChange={e => onProductSelect(row.id, e.target.value)}>
                    <option value="">{T.select_product}</option>
                    {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 3px' }}>
                  <select className="input-sm" value={row.coverId} onChange={e => setRow(row.id, 'coverId', e.target.value)}>
                    <option value="">{T.no_cover}</option>
                    {state.covers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 3px' }}>
                  <select className="input-sm" value={row.basketId} onChange={e => setRow(row.id, 'basketId', e.target.value)}>
                    <option value="">{T.no_basket}</option>
                    {state.baskets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 3px' }}>
                  <input className="input-sm" type="time" style={{ width: 88 }} value={row.time} onChange={e => setRow(row.id, 'time', e.target.value)} />
                </td>
                <td style={{ padding: '4px 3px' }}>
                  <input className="input-sm" type="number" style={{ width: 76 }} placeholder={T.target_bancale} value={row.target} onChange={e => setRow(row.id, 'target', e.target.value)} />
                </td>
                <td style={{ padding: '4px 3px' }}>
                  <input className="input-sm" type="number" style={{ width: 66 }} placeholder={T.kilos} value={row.kilos} onChange={e => setRow(row.id, 'kilos', e.target.value)} />
                </td>
                <td style={{ padding: '4px 3px' }}>
                  <input className="input-sm" type="text" style={{ width: 100 }} placeholder={T.col_notes} value={row.notes} onChange={e => setRow(row.id, 'notes', e.target.value)} />
                </td>
                <td style={{ padding: '4px 3px' }}>
                  <button className="ghost" style={{ color: 'var(--red)', padding: '4px 8px' }} onClick={() => removeRow(row.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button style={{ marginTop: 8 }} onClick={addRow}>+ {T.select_product}</button>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={handleSave}>{T.save}</button>
      </div>
    </Modal>
  );
}

/* ---- Confirm Code Modal ---- */
function ConfirmCodeModal({ item, action, T, products, onClose, onConfirm }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const toast = useToast();
  const p = products.find(x => x.id === item?.productId);

  const doConfirm = () => {
    if (!p) return;
    if (code.trim() !== p.code) { setErr(T.code_mismatch); return; }
    onConfirm();
  };

  if (!p) return null;

  return (
    <Modal onClose={onClose} maxWidth={360}>
      <h3 style={{ textAlign: 'center' }}>{action === 'done' ? T.enter_code : T.undo_confirm}</h3>
      <p style={{ fontWeight: 700, textAlign: 'center', fontSize: 16 }}>{p.name}</p>
      <p className="smallmuted" style={{ textAlign: 'center' }}>{T.target_bancale}: <span className="mono">{item.target}</span></p>
      <input
        autoFocus
        value={code}
        onChange={e => { setCode(e.target.value); setErr(''); }}
        onKeyDown={e => e.key === 'Enter' && doConfirm()}
        placeholder={T.code}
        style={{ textAlign: 'center', fontSize: 16, fontWeight: 700 }}
      />
      {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 6, textAlign: 'center' }}>{err}</div>}
      <div className="row" style={{ justifyContent: 'center', marginTop: 16, gap: 12 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" style={{ minWidth: 100 }} onClick={doConfirm}>{T.confirm}</button>
      </div>
    </Modal>
  );
}
