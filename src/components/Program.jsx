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
  const [confirmItem, setConfirmItem] = useState(null); // {pi, ii, action, pendingRows}
  const [confirmBancale, setConfirmBancale] = useState(null); // {pi, ii, rowIdx, action}
  const [notesText, setNotesText] = useState(state.managerNotes[date] || '');
  const [workerTab, setWorkerTab] = useState('line'); // 'line' | 'chem'
  const [viewingProduct, setViewingProduct] = useState(null);

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

  /* Carry over: only uncompleted items with remaining target, prepend to next day */
  const carryOver = (realPi) => {
    const pr = allProgs[realPi];
    const pendingItems = pr.items.filter(i => i.status !== 'done').map(i => {
      const rows = i.rows ?? Array.from({ length: Number(i.target) || 1 }, () => ({ done: false }));
      const doneCount = rows.filter(r => r.done).length;
      const remaining = Math.max(1, (Number(i.target) || 1) - doneCount);
      return { ...i, target: remaining, notes: '', status: 'pending', rows: Array.from({ length: remaining }, () => ({ done: false })) };
    });
    if (!pendingItems.length) return;
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const nextStr = next.toISOString().slice(0, 10);
    const existing = state.programs[nextStr] || [];
    const matchIdx = existing.findIndex(ep => ep.progType === pr.progType);
    let newList;
    if (matchIdx >= 0) {
      newList = existing.map((ep, idx) => idx !== matchIdx ? ep : { ...ep, items: [...pendingItems, ...ep.items] });
    } else {
      newList = [{ id: uid(), label: pr.label, progType: pr.progType, chemistId: pr.chemistId || '', assignedWorkers: pr.assignedWorkers || [], items: pendingItems }, ...existing];
    }
    update({ programs: { ...state.programs, [nextStr]: newList } });
    addLog({ type: 'carry_over', from: date, to: nextStr, count: pendingItems.length, by: state.role });
    toast(T.success_added);
  };

  const updateInlineField = (realPi, ii, field, value) => {
    const newProgs = updateProgramItem(state.programs, date, realPi, ii, { [field]: value });
    update({ programs: newProgs });
  };

  const makeRows = (it) => {
    const n = Math.max(1, Number(it.target) || 1);
    return it.rows ?? Array.from({ length: n }, () => ({ done: false }));
  };

  /* ---- Stock deduction on item confirm ---- */
  const handleConfirm = ({ pi, ii, action, pendingRows }) => {
    const it = allProgs[pi].items[ii];
    if (it.prepType === 'liquid') { handleLiquidConfirm({ pi, ii, action, pendingRows }); return; }
    const p = state.products.find(x => x.id === it.productId);
    if (!p) return;
    const s = state.settings;
    const target = Number(it.target);
    const sign = action === 'done' ? -1 : 1;

    if (p.isPasta) {
      const effectiveBoxId = it.pastaBoxId || p.pastaBoxId;
      const effectiveLidId = it.pastaLidId || p.pastaLidId;
      const cartonsTotal = target * 12;
      const updatedPastaBoxes = effectiveBoxId
        ? (state.pastaBoxes || []).map(pb => pb.id !== effectiveBoxId ? pb : { ...pb, stock: (pb.stock || 0) + sign * cartonsTotal * (1 + (s.wastePastaBox || 2) / 100) })
        : (state.pastaBoxes || []);
      const updatedPastaLids = effectiveLidId
        ? (state.pastaLids || []).map(pl => pl.id !== effectiveLidId ? pl : { ...pl, stock: (pl.stock || 0) + sign * cartonsTotal * (1 + (s.wastePastaLid || 2) / 100) })
        : (state.pastaLids || []);
      let updatedPastaStock = { ...(state.pastaStock || { sponges: 0, spongeLids: 0 }) };
      if (p.hasSponge) {
        updatedPastaStock.sponges = (updatedPastaStock.sponges || 0) + sign * cartonsTotal * (1 + (s.wastePastaSponge || 2) / 100);
        updatedPastaStock.spongeLids = (updatedPastaStock.spongeLids || 0) + sign * cartonsTotal * (1 + (s.wastePastaSpongeLid || 2) / 100);
      }
      const liquid = (state.pastaLiquids || []).find(x => x.id === p.pastaLiquidId);
      const updatedPastaLiquids = liquid
        ? (state.pastaLiquids || []).map(lq => lq.id !== liquid.id ? lq : { ...lq, stock: (lq.stock || 0) + sign * cartonsTotal * (p.liter || 0.5) * (1 + (s.wastePastaLiquid || 2) / 100) })
        : (state.pastaLiquids || []);
      const rowsUpdate = action === 'done'
        ? { status: 'done', rows: pendingRows ?? makeRows(it).map(r => ({ ...r, done: true })) }
        : { status: 'pending', rows: makeRows(it).map(r => ({ ...r, done: false })) };
      const newProgs = updateProgramItem(state.programs, date, pi, ii, rowsUpdate);
      update({ programs: newProgs, pastaBoxes: updatedPastaBoxes, pastaLids: updatedPastaLids, pastaStock: updatedPastaStock, pastaLiquids: updatedPastaLiquids });
    } else {
      const prog = allProgs[pi];
      const isAmazon = prog && prog.progType === 'amazon';

      // Carton deduction (cartons ≈ one per unit produced) — applies to Linea & Amazon
      const cartonUnits = target * (p.jerricansPer || p.capsPer || 1);
      const updatedCartons = (p.hasCarton && p.cartonId)
        ? (state.cartonTypes || []).map(c => c.id !== p.cartonId ? c : { ...c, stock: (c.stock || 0) + sign * cartonUnits * (1 + (c.waste || 0) / 100) })
        : (state.cartonTypes || []);

      const rowsUpdate = action === 'done'
        ? { status: 'done', rows: pendingRows ?? makeRows(it).map(r => ({ ...r, done: true })) }
        : { status: 'pending', rows: makeRows(it).map(r => ({ ...r, done: false })) };
      const newProgs = updateProgramItem(state.programs, date, pi, ii, rowsUpdate);

      if (isAmazon) {
        // Amazon: deduct from finished-goods warehouse, NO manufacturing deduction
        const fs = { ...(state.finishedStock || {}) };
        fs[p.id] = (fs[p.id] || 0) + sign * target;
        update({ programs: newProgs, finishedStock: fs, cartonTypes: updatedCartons });
      } else {
        // Linea / standard: deduct manufacturing materials + cartons
        const updatedProducts = state.products.map(prod => {
          if (prod.id !== p.id) return prod;
          return { ...prod, stock: { ...prod.stock,
            ticketsFront: prod.stock.ticketsFront + sign * target * prod.ticketsFront * (1 + s.wasteTicket / 100),
            ticketsBack:  prod.stock.ticketsBack  + sign * target * prod.ticketsBack  * (1 + s.wasteTicket / 100),
            caps:      !prod.coverId  ? prod.stock.caps      + sign * target * prod.capsPer      * (1 + s.wasteCap / 100)      : prod.stock.caps,
            jerricans: !prod.basketId ? prod.stock.jerricans + sign * target * prod.jerricansPer * (1 + s.wasteJerrican / 100) : prod.stock.jerricans,
          }};
        });
        const effectiveCoverId  = it.coverId  || p.coverId;
        const effectiveBasketId = it.basketId || p.basketId;
        const updatedCovers = effectiveCoverId && p.capsPer > 0
          ? state.covers.map(c => c.id !== effectiveCoverId ? c : { ...c, stock: (c.stock || 0) + sign * target * p.capsPer * (1 + s.wasteCap / 100) })
          : state.covers;
        const updatedBaskets = effectiveBasketId && p.jerricansPer > 0
          ? state.baskets.map(b => b.id !== effectiveBasketId ? b : { ...b, stock: (b.stock || 0) + sign * target * p.jerricansPer * (1 + s.wasteJerrican / 100) })
          : state.baskets;
        update({ programs: newProgs, products: updatedProducts, covers: updatedCovers, baskets: updatedBaskets, cartonTypes: updatedCartons });
      }
    }
    addLog({ type: action === 'done' ? 'produce' : 'undo', product: p.code, target, date, by: state.role });
    toast(action === 'done' ? T.success_done : T.success_undo);
    setConfirmItem(null);
  };

  /* ---- Liquid prep: add liters to base liquid stock ---- */
  const handleLiquidConfirm = ({ pi, ii, action, pendingRows }) => {
    const it = allProgs[pi].items[ii];
    const liq = (state.pastaLiquids || []).find(x => x.id === it.pastaLiquidId);
    if (!liq) return;
    const liters = Number(it.target) || 0;
    const sign = action === 'done' ? 1 : -1;
    const updatedLiquids = (state.pastaLiquids || []).map(l => l.id !== liq.id ? l : { ...l, stock: (l.stock || 0) + sign * liters });
    const rowsUpdate = action === 'done'
      ? { status: 'done', rows: pendingRows ?? [{ done: true }] }
      : { status: 'pending', rows: [{ done: false }] };
    const newProgs = updateProgramItem(state.programs, date, pi, ii, rowsUpdate);
    update({ programs: newProgs, pastaLiquids: updatedLiquids });
    addLog({ type: action === 'done' ? 'liquid_prep' : 'liquid_undo', liquid: liq.name, liters, date, by: state.role });
    toast(action === 'done' ? T.success_done : T.success_undo);
    setConfirmItem(null);
  };

  /* ---- Bancale-level confirm ---- */
  const handleBancaleConfirm = ({ pi, ii, rowIdx, action }) => {
    const it = allProgs[pi].items[ii];
    const rows = makeRows(it);
    if (action === 'check') {
      const newRows = rows.map((r, i) => i === rowIdx ? { ...r, done: true } : r);
      if (newRows.every(r => r.done)) {
        handleConfirm({ pi, ii, action: 'done', pendingRows: newRows });
      } else {
        update({ programs: updateProgramItem(state.programs, date, pi, ii, { rows: newRows }) });
      }
    } else {
      // uncheck
      const newRows = rows.map((r, i) => i === rowIdx ? { ...r, done: false } : r);
      if (it.status === 'done') {
        // Undo entire item first, then set rows
        handleConfirm({ pi, ii, action: 'undo' });
      } else {
        update({ programs: updateProgramItem(state.programs, date, pi, ii, { rows: newRows }) });
      }
    }
    setConfirmBancale(null);
  };

  const handleRowCheck = (pi, ii, rowIdx) => {
    setConfirmBancale({ pi, ii, rowIdx, action: 'check' });
  };
  const handleRowUncheck = (pi, ii, rowIdx) => {
    setConfirmBancale({ pi, ii, rowIdx, action: 'uncheck' });
  };

  // Daily code for today
  const todayCode = (state.dailyCodes || {})[date] || '';

  // ===== WORKER VIEW =====
  if (state.role === 'worker') {
    const flatRows = allProgs.flatMap((pr, pi) =>
      pr.items.flatMap((it, ii) => {
        const rows = makeRows(it);
        return rows.map((row, rowIdx) => ({ it, pi, ii, pr, row, rowIdx, rows }));
      })
    );
    const doneRows  = flatRows.filter(x => x.row.done).length;
    const totalRows = flatRows.length;

    return (
      <>
        {/* Date + progress + tab toggle */}
        <div className="card" style={{ padding: '10px 18px', marginBottom: 14 }}>
          <div className="row wrap" style={{ gap: 12, alignItems: 'center' }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto', padding: '7px 10px' }} />
            <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 6, height: 10, minWidth: 80, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: doneRows === totalRows && totalRows > 0 ? 'var(--green)' : 'var(--yellow)', width: totalRows ? `${(doneRows / totalRows) * 100}%` : '0%', transition: 'width .3s' }} />
            </div>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: doneRows === totalRows && totalRows > 0 ? 'var(--green)' : 'var(--muted)' }}>
              {doneRows} / {totalRows}
            </span>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10, justifyContent: 'center' }}>
            <button className={workerTab === 'line' ? 'primary' : 'ghost'} style={{ fontSize: 13, padding: '6px 18px' }} onClick={() => setWorkerTab('line')} title="Vista linea di produzione">
              🏭 {state.lang === 'ar' ? 'خط الإنتاج' : 'Linea'}
            </button>
            <button className={workerTab === 'chem' ? 'primary' : 'ghost'} style={{ fontSize: 13, padding: '6px 18px' }} onClick={() => setWorkerTab('chem')} title="Vista chimico">
              🧪 {state.lang === 'ar' ? 'الكيميائي' : 'Chimico'}
            </button>
          </div>
        </div>

        {/* Manager notes */}
        {state.managerNotes[date] && (
          <div className="notes-card" style={{ marginBottom: 16 }}>
            <h3>📋 {T.manager_notes}</h3>
            <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.7 }}>{state.managerNotes[date]}</p>
          </div>
        )}

        {workerTab === 'line' ? (
          /* ===== LINE VIEW ===== */
          (() => {
            const dailyProgs = progs.filter(p => p.progType === 'daily' || p.progType === 'location');
            const otherProgs = progs.filter(p => p.progType !== 'daily' && p.progType !== 'location');

            // Find maximum target across all daily/location items for matrix columns
            const dailyItems = dailyProgs.flatMap(pr => pr.items.filter(it => it.prepType !== 'liquid').map((it, ii) => ({ pr, it, pi: allProgs.indexOf(pr), ii })));
            const maxTarget = Math.max(1, ...dailyItems.map(x => Number(x.it.target) || 1));

            return (
              <>
                {dailyItems.length > 0 && (
                  <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
                    <div className="prog-header" style={{ padding: '12px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
                      <h4 style={{ margin: 0 }}>🏭 {state.lang === 'ar' ? 'خطوط الإنتاج (المكن)' : 'Linee di Produzione'}</h4>
                    </div>
                    <div className="sched-wrap">
                      <table className="sched-table" style={{ minWidth: 'max-content' }}>
                        <thead>
                          <tr>
                            <th style={{ minWidth: 200, position: 'sticky', left: 0, zIndex: 2 }}>{T.col_product}</th>
                            <th style={{ minWidth: 120 }}>{T.col_cover}</th>
                            <th style={{ minWidth: 120 }}>{T.col_basket}</th>
                            {Array.from({ length: maxTarget }).map((_, i) => (
                              <th key={i} style={{ width: 44, textAlign: 'center', padding: '6px 2px' }}>
                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>#{i + 1}</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dailyItems.map(({ pr, it, pi, ii }) => {
                            const p = state.products.find(x => x.id === it.productId);
                            const cv = state.covers.find(x => x.id === (it.coverId || p?.coverId));
                            const bk = state.baskets.find(x => x.id === (it.basketId || p?.basketId));
                            const target = Number(it.target) || 1;
                            const rows = makeRows(it);

                            return (
                              <tr key={`${pi}-${ii}`}>
                                {/* Product details */}
                                <td style={{ verticalAlign: 'middle', position: 'sticky', left: 0, zIndex: 1, background: 'var(--card)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {p?.image
                                      ? <img src={p.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', flexShrink: 0 }} />
                                      : <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🧴</div>
                                    }
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3, cursor: 'pointer', textDecoration: 'underline dotted' }}
                                        onClick={() => setViewingProduct(p)} title={state.lang === 'ar' ? 'تفاصيل المنتج' : 'Dettagli prodotto'}>
                                        {p ? p.name : <span style={{ color: 'var(--red)' }}>?</span>}
                                      </div>
                                      {p && <div className="smallmuted" style={{ fontSize: 10 }}>{p.company} · {p.type} · {p.liter}L</div>}
                                      {p && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                                          <div style={{ background: 'var(--bg)', borderRadius: 4, padding: '2px 5px' }}>
                                            <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--yellow)', letterSpacing: 0.5 }}>{p.code}</span>
                                          </div>
                                          <ProgBadge type={pr.progType} T={T} />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Cover */}
                                <td style={{ verticalAlign: 'middle' }}>
                                  {cv ? (
                                    <div>
                                      <div style={{ fontSize: 11, fontWeight: 600 }}>{cv.name}</div>
                                      <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                                        {cv.color && <span className="color-chip" style={{ fontSize: 9 }}>{cv.color}</span>}
                                        {cv.size && <span className="size-chip" style={{ fontSize: 9 }}>{cv.size}</span>}
                                      </div>
                                    </div>
                                  ) : <span className="smallmuted">—</span>}
                                </td>

                                {/* Basket */}
                                <td style={{ verticalAlign: 'middle' }}>
                                  {bk ? (
                                    <div>
                                      <div style={{ fontSize: 11, fontWeight: 600 }}>{bk.name}</div>
                                      <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                                        {bk.color && <span className="color-chip" style={{ fontSize: 9 }}>{bk.color}</span>}
                                        {bk.size && <span className="size-chip" style={{ fontSize: 9 }}>{bk.size}</span>}
                                      </div>
                                    </div>
                                  ) : <span className="smallmuted">—</span>}
                                </td>

                                {/* Matrix Checkboxes */}
                                {Array.from({ length: maxTarget }).map((_, colIdx) => {
                                  if (colIdx >= target) {
                                    return <td key={colIdx} style={{ background: 'rgba(255,255,255,0.02)' }}></td>; // empty slot
                                  }
                                  const r = rows[colIdx] || { done: false };
                                  const isDone = r.done || it.status === 'done';
                                  return (
                                    <td key={colIdx} style={{ textAlign: 'center', verticalAlign: 'middle', padding: '4px 2px' }}>
                                      {isDone
                                        ? <div style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: 'rgba(0,200,80,0.15)', borderRadius: 6, border: '1px solid var(--green)', color: 'var(--green)', fontWeight: 700 }} title="Annulla bancale" onClick={() => handleRowUncheck(pi, ii, colIdx)}>✓</div>
                                        : <div style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--line)' }} title="Conferma bancale" onClick={() => handleRowCheck(pi, ii, colIdx)}></div>
                                      }
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* OTHER PROGRAMS (Amazon, Brazer, Macro) -> Simple List */}
                {otherProgs.length > 0 && otherProgs.map(pr => {
                  const realPi = allProgs.indexOf(pr);
                  const items = pr.items.filter(it => it.prepType !== 'liquid');
                  if (items.length === 0) return null;

                  return (
                    <div className="card prog-section" key={pr.id} style={{ marginBottom: 16 }}>
                      <div className="prog-header" style={{ marginBottom: 10 }}>
                        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <ProgBadge type={pr.progType} T={T} />
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{pr.label || T.today_program}</span>
                        </div>
                      </div>
                      <div className="sched-wrap">
                        <table className="sched-table">
                          <thead>
                            <tr>
                              <th style={{ minWidth: 200 }}>{T.col_product}</th>
                              {pr.progType === 'brazer' ? (
                                <><th style={{ minWidth: 100 }}>{state.lang === 'ar' ? 'علبة الباستا' : 'Scatola'}</th><th style={{ minWidth: 100 }}>{state.lang === 'ar' ? 'غطاء الباستا' : 'Coperchio'}</th></>
                              ) : (
                                <><th style={{ minWidth: 120 }}>{T.col_cover}</th><th style={{ minWidth: 120 }}>{T.col_basket}</th></>
                              )}
                              <th style={{ width: 70 }}>{T.col_target}</th>
                              <th style={{ width: 60, textAlign: 'center' }}>✓</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it, idx) => {
                              const ii = pr.items.indexOf(it);
                              const p = state.products.find(x => x.id === it.productId);
                              const isPasta = p?.isPasta;
                              const cv = isPasta ? null : state.covers.find(x => x.id === (it.coverId || p?.coverId));
                              const bk = isPasta ? null : state.baskets.find(x => x.id === (it.basketId || p?.basketId));
                              const pBox = isPasta ? (state.pastaBoxes || []).find(x => x.id === (it.pastaBoxId || p?.pastaBoxId)) : null;
                              const pLid = isPasta ? (state.pastaLids || []).find(x => x.id === (it.pastaLidId || p?.pastaLidId)) : null;
                              const isDone = it.status === 'done';

                              return (
                                <tr key={`${realPi}-${ii}`} className={isDone ? 'row-done' : 'row-pending'}>
                                  <td style={{ verticalAlign: 'middle' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      {p?.image
                                        ? <img src={p.image} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', flexShrink: 0 }} />
                                        : <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📦</div>
                                      }
                                      <div>
                                        <div style={{ fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'underline dotted' }} onClick={() => setViewingProduct(p)}>
                                          {p ? p.name : '?'}
                                        </div>
                                        {p && <div className="smallmuted" style={{ fontSize: 10 }}>{p.code}</div>}
                                      </div>
                                    </div>
                                  </td>
                                  {pr.progType === 'brazer' ? (
                                    <>
                                      <td style={{ verticalAlign: 'middle', fontSize: 12 }}>{pBox ? pBox.name : <span className="smallmuted">—</span>}</td>
                                      <td style={{ verticalAlign: 'middle', fontSize: 12 }}>{pLid ? pLid.name : <span className="smallmuted">—</span>}</td>
                                    </>
                                  ) : (
                                    <>
                                      <td style={{ verticalAlign: 'middle', fontSize: 12 }}>{cv ? cv.name : <span className="smallmuted">—</span>}</td>
                                      <td style={{ verticalAlign: 'middle', fontSize: 12 }}>{bk ? bk.name : <span className="smallmuted">—</span>}</td>
                                    </>
                                  )}
                                  <td className="mono" style={{ fontWeight: 700, verticalAlign: 'middle' }}>{it.target}</td>
                                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                    {isDone
                                      ? (<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                          <button className="ghost" style={{ fontSize: 14, padding: '2px 6px' }} title="Annulla" onClick={() => setConfirmItem({ pi: realPi, ii, action: 'undo' })}>↩</button>
                                          <span style={{ color: 'var(--green)', fontSize: 20, fontWeight: 700 }}>✓</span>
                                        </span>)
                                      : (<button className="primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setConfirmItem({ pi: realPi, ii, action: 'done' })}>{state.lang === 'ar' ? 'تأكيد' : 'Conferma'}</button>)
                                    }
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

                {dailyItems.length === 0 && otherProgs.length === 0 && <div className="empty">{T.no_program_today}</div>}
              </>
            );
          })()
        ) : (
          /* ===== CHEMIST VIEW ===== */
          (() => {
            const chemProgs = allProgs.filter(pr => pr.progType === 'brazer' || pr.progType === 'daily' || pr.progType === 'location' || pr.progType === 'macro');
            if (chemProgs.length === 0) return <div className="empty">{state.lang === 'ar' ? 'لا يوجد تحضيرات كيميائية اليوم' : 'Nessuna preparazione chimica oggi'}</div>;

            // 1. Collect all explicit liquid preparations (from Pasta/Brazer programs where prepType === 'liquid')
            const liquidTasks = chemProgs.flatMap(pr => 
              pr.items.filter(it => it.prepType === 'liquid').map((it, idx) => ({ pr, it, pi: allProgs.indexOf(pr), ii: pr.items.indexOf(it), key: `${pr.id}-liq-${idx}` }))
            );

            // 2. Collect regular machine products that require chemical formulas
            const lineRecipes = chemProgs.flatMap(pr => 
              pr.items.filter(it => it.prepType !== 'liquid').map((it, idx) => {
                const p = state.products.find(x => x.id === it.productId);
                if (!p || (!p.recipe?.length && !p.isPasta)) return null;
                return { pr, it, p, key: `${pr.id}-rec-${idx}` };
              }).filter(Boolean)
            );

            return (
              <>
                {/* Section 1: Liquid Preparations (Active Tasks) */}
                {liquidTasks.length > 0 && (
                  <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden', border: '1px solid var(--green)' }}>
                    <div style={{ background: 'rgba(0,200,80,0.1)', padding: '12px 18px', borderBottom: '1px solid var(--green)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>🧪</span>
                      <h3 style={{ margin: 0, color: 'var(--green)' }}>{state.lang === 'ar' ? 'تحضيرات السوائل المطلوبة' : 'Preparazioni Liquidi Richieste'}</h3>
                    </div>
                    <div style={{ padding: 18 }}>
                      {liquidTasks.map(({ pr, it, pi, ii, key }) => {
                        const liq = (state.pastaLiquids || []).find(x => x.id === it.pastaLiquidId);
                        const isDone = it.status === 'done';
                        const chemist = (state.workers || []).find(w => w.id === pr.chemistId);
                        
                        return (
                          <div key={key} style={{ background: isDone ? 'rgba(0,200,80,0.05)' : 'var(--bg)', borderRadius: 8, padding: '14px 18px', marginBottom: 12, border: isDone ? '1px solid var(--green)' : '1px solid var(--line)', position: 'relative', overflow: 'hidden' }}>
                            {isDone && <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--green)' }}></div>}
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                              <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                  <div style={{ fontWeight: 800, fontSize: 16 }}>{liq ? liq.name : '?'}</div>
                                  <ProgBadge type={pr.progType} T={T} />
                                  {chemist && <span className="badge warn" style={{ fontSize: 10 }}>🧪 {chemist.name}</span>}
                                </div>
                                <div style={{ fontSize: 13, marginBottom: 8 }}>
                                  <span style={{ color: 'var(--muted)' }}>{state.lang === 'ar' ? 'الكمية المطلوبة' : 'Quantità'}:</span> <strong style={{ fontSize: 15, color: 'var(--text)' }}>{it.target} {state.lang === 'ar' ? 'لتر' : 'Litri'}</strong>
                                </div>
                                
                                {liq && liq.recipe && liq.recipe.length > 0 && (
                                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 6, display: 'inline-block' }}>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{state.lang === 'ar' ? 'المكونات' : 'Ingredienti'}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '4px 16px' }}>
                                      {liq.recipe.map((r, i) => (
                                        <div key={i} style={{ fontSize: 13, fontWeight: 600 }}>
                                          <span style={{ color: 'var(--yellow)' }}>{r.name}</span>: <span className="mono">{(r.ratio * Number(it.target)).toFixed(2)}L</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {liq && liq.prepNotes && (
                                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--yellow)', display: 'flex', gap: 6 }}>
                                    <span>⚠️</span> <span>{liq.prepNotes}</span>
                                  </div>
                                )}
                              </div>
                              
                              <div style={{ textAlign: 'center', minWidth: 120 }}>
                                {isDone
                                  ? (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                      <div style={{ color: 'var(--green)', fontWeight: 700, fontSize: 16 }}>✓ {state.lang === 'ar' ? 'تم التحضير' : 'Completato'}</div>
                                      <button className="ghost" style={{ fontSize: 12 }} onClick={() => setConfirmItem({ pi, ii, action: 'undo' })}>↩ {state.lang === 'ar' ? 'تراجع' : 'Annulla'}</button>
                                    </div>)
                                  : (<button className="primary" style={{ padding: '10px 20px', fontSize: 14, fontWeight: 700, width: '100%' }} onClick={() => setConfirmItem({ pi, ii, action: 'done' })}>
                                      ✓ {state.lang === 'ar' ? 'تأكيد التحضير' : 'Conferma'}
                                    </button>)
                                }
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section 2: Reference Recipes for Line Products */}
                {lineRecipes.length > 0 && (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ background: 'var(--bg)', padding: '12px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>📋</span>
                      <h3 style={{ margin: 0 }}>{state.lang === 'ar' ? 'تركيبات المكن (مرجع)' : 'Ricette Macchine (Riferimento)'}</h3>
                    </div>
                    <div style={{ padding: '12px 18px' }}>
                      <table className="sched-table">
                        <thead>
                          <tr>
                            <th style={{ minWidth: 200 }}>{T.col_product}</th>
                            <th style={{ width: 100 }}>{T.col_target}</th>
                            <th>{state.lang === 'ar' ? 'التركيبة' : 'Ricetta'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineRecipes.map(({ pr, it, p, key }) => {
                            const isDone = it.status === 'done';
                            const target = Number(it.target) || 0;
                            let recipeDisplay = null;
                            
                            if (p.isPasta) {
                              const liquid = (state.pastaLiquids || []).find(x => x.id === p.pastaLiquidId);
                              recipeDisplay = liquid ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 16 }}>🧪</span>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--yellow)' }}>{liquid.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{state.lang === 'ar' ? 'معد مسبقاً' : 'Pre-preparato'}</div>
                                  </div>
                                </div>
                              ) : <span className="smallmuted">—</span>;
                            } else if (p.recipe && p.recipe.length > 0) {
                              recipeDisplay = (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                  {p.recipe.map((r, i) => (
                                    <div key={i} style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                                      <span style={{ color: 'var(--yellow)' }}>{r.name}</span> <span className="mono">{(r.ratio * target).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            } else {
                              recipeDisplay = <span className="smallmuted">—</span>;
                            }

                            return (
                              <tr key={key} style={{ opacity: isDone ? 0.5 : 1 }}>
                                <td>
                                  <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name} <ProgBadge type={pr.progType} T={T} /></div>
                                  <div className="smallmuted" style={{ fontSize: 10 }}>{p.code}</div>
                                </td>
                                <td className="mono" style={{ fontWeight: 700 }}>{target} {state.lang === 'ar' ? 'بانكاله' : 'bancale'}</td>
                                <td>{recipeDisplay}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            );
          })()
        )}

        {confirmBancale && (
          <ConfirmBancaleModal
            item={allProgs[confirmBancale.pi]?.items[confirmBancale.ii]}
            rowIdx={confirmBancale.rowIdx}
            action={confirmBancale.action}
            T={T} dailyCode={todayCode} lang={state.lang}
            onClose={() => setConfirmBancale(null)}
            onConfirm={() => handleBancaleConfirm(confirmBancale)}
          />
        )}
        {confirmItem && (
          <ConfirmCodeModal
            item={allProgs[confirmItem.pi]?.items[confirmItem.ii]}
            action={confirmItem.action}
            T={T} dailyCode={todayCode} products={state.products} pastaLiquids={state.pastaLiquids || []} lang={state.lang}
            onClose={() => setConfirmItem(null)}
            onConfirm={() => handleConfirm(confirmItem)}
          />
        )}
        {viewingProduct && <ProductDetailsModal product={viewingProduct} state={state} T={T} onClose={() => setViewingProduct(null)} />}
      </>
    );
  }

  // ===== ADMIN / MANAGER VIEW =====
  return (
    <>
      <div className="card" style={{ padding: '12px 18px', marginBottom: 14 }}>
        <div className="row wrap">
          <div>
            <label style={{ fontSize: 11, marginBottom: 2 }}>{T.date}</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto', padding: '7px 10px' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, marginBottom: 2 }}>{T.prog_type}</label>
            <select value={typeFilter} onChange={e => update({ progTypeFilter: e.target.value })} style={{ width: 'auto' }}>
              <option value="all">{T.all_types}</option>
              {PROG_TYPES.map(tp => <option key={tp} value={tp}>{T[`prog_${tp}`]}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }} />
          {state.role === 'admin' && (
            <button className="primary" onClick={() => setShowAddProg(true)}>+ {T.add_program}</button>
          )}
        </div>
      </div>

      <div className="notes-card" style={{ marginBottom: 16 }}>
        <h3>📋 {T.manager_notes} — {date}</h3>
        <textarea className="notes-ta" placeholder={T.write_notes} value={notesText} onChange={e => setNotesText(e.target.value)} style={{ minHeight: 80 }} />
        <div style={{ marginTop: 8 }}><button className="primary" onClick={saveNotes}>{T.save_notes}</button></div>
      </div>

      {progs.length === 0 ? (
        <div className="empty">{T.no_program_today}</div>
      ) : progs.map(pr => {
        const realPi = allProgs.indexOf(pr);
        const allDone = pr.items.every(i => i.status === 'done');
        const chemist = (state.workers || []).find(w => w.id === pr.chemistId);
        return (
          <div className="card prog-section" key={pr.id}>
            <div className="prog-header flex-between">
              <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <ProgBadge type={pr.progType} T={T} />
                <span className="prog-title">{pr.label || T.today_program}</span>
                {chemist && <span className="badge warn" style={{ fontSize: 10 }}>🧪 {chemist.name}</span>}
                {allDone && <span className="badge ok">✓ {T.done}</span>}
              </div>
              <div className="row">
                {!allDone && <button className="ghost" style={{ fontSize: 12 }} onClick={() => carryOver(realPi)}>{T.carry_over} →</button>}
                <button className="danger ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => deleteProgram(realPi)}>✕</button>
              </div>
            </div>

            <div className="sched-wrap">
              <table className="sched-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{T.col_product}</th>
                    {pr.progType !== 'amazon' && pr.progType !== 'brazer' && <><th>{T.col_cover}</th><th>{T.col_basket}</th></>}
                    {pr.progType === 'brazer' && <><th>{state.lang === 'ar' ? 'علبة الباستا' : 'Scatola'}</th><th>{state.lang === 'ar' ? 'غطاء الباستا' : 'Coperchio'}</th></>}
                    <th>{T.col_target}</th>
                    <th>{T.col_notes}</th>
                    <th>{T.col_confirm}</th>
                  </tr>
                </thead>
                <tbody>
                  {pr.items.map((it, ii) => {
                    const isLiq = it.prepType === 'liquid';
                    const p  = isLiq ? null : state.products.find(x => x.id === it.productId);
                    const liq = isLiq ? (state.pastaLiquids || []).find(x => x.id === it.pastaLiquidId) : null;
                    const cv = p ? state.covers.find(x => x.id === (it.coverId || p?.coverId)) : null;
                    const bk = p ? state.baskets.find(x => x.id === (it.basketId || p?.basketId)) : null;
                    const pBox = p ? (state.pastaBoxes || []).find(x => x.id === (it.pastaBoxId || p?.pastaBoxId)) : null;
                    const pLid = p ? (state.pastaLids || []).find(x => x.id === (it.pastaLidId || p?.pastaLidId)) : null;
                    const displayName = isLiq ? (liq ? `🧪 ${liq.name}` : '?') : (p ? p.name : '?');
                    return (
                      <tr key={ii} className={it.status === 'done' ? 'row-done' : 'row-pending'}>
                        <td className="mono smallmuted">{ii + 1}</td>
                        <td>
                          <strong>{displayName}</strong>
                          {p && <><br /><span className="smallmuted">{p.code}</span></>}
                          {isLiq && <><br /><span className="smallmuted">{it.target}L</span></>}
                        </td>
                        {pr.progType !== 'amazon' && pr.progType !== 'brazer' && (
                          <><td className="smallmuted">{cv ? cv.name : '—'}</td><td className="smallmuted">{bk ? bk.name : '—'}</td></>
                        )}
                        {pr.progType === 'brazer' && (
                          <><td className="smallmuted">{pBox ? pBox.name : '—'}</td><td className="smallmuted">{pLid ? pLid.name : '—'}</td></>
                        )}
                        <td className="mono" style={{ fontWeight: 700 }}>{isLiq ? `${it.target}L` : (it.target || '—')}</td>
                        <td><input className="row-notes-inp" type="text" defaultValue={it.notes || ''} placeholder="..." onBlur={e => updateInlineField(realPi, ii, 'notes', e.target.value)} /></td>
                        <td style={{ textAlign: 'center' }}>
                          {it.status === 'done' ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button className="ghost" style={{ fontSize: 16, padding: '2px 6px' }} title={T.undo} onClick={() => setConfirmItem({ pi: realPi, ii, action: 'undo' })}>↩</button>
                              <span className="badge ok">✓</span>
                            </span>
                          ) : (
                            <input type="checkbox" className="confirm-cb" title={T.confirm} onChange={e => { if (e.target.checked) { e.target.checked = false; setConfirmItem({ pi: realPi, ii, action: 'done' }); } }} />
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
        <AddProgramModal date={date} T={T} state={state}
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
          action={confirmItem.action} T={T} dailyCode={todayCode}
          products={state.products} pastaLiquids={state.pastaLiquids || []} lang={state.lang}
          onClose={() => setConfirmItem(null)}
          onConfirm={() => handleConfirm(confirmItem)}
        />
      )}
      {viewingProduct && <ProductDetailsModal product={viewingProduct} state={state} T={T} onClose={() => setViewingProduct(null)} />}
    </>
  );
}

/* ---- Add Program Modal ---- */
function AddProgramModal({ date, T, state, onClose, onSave }) {
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [progType, setProgType] = useState('daily');
  const [chemistId, setChemistId] = useState('');
  const [prepType, setPrepType] = useState('carton');
  const [assignedWorkers, setAssignedWorkers] = useState([]);

  const emptyRow = () => ({ id: uid(), productId: '', pastaLiquidId: '', coverId: '', basketId: '', pastaBoxId: '', pastaLidId: '', target: '', notes: '' });
  const [rows, setRows] = useState([emptyRow()]);

  const setRow = (id, field, value) => setRows(r => r.map(x => x.id === id ? { ...x, [field]: value } : x));

  const onProductSelect = (rowId, productId) => {
    const prod = state.products.find(p => p.id === productId);
    setRows(r => r.map(x => x.id !== rowId ? x : { ...x, productId, coverId: prod?.coverId || x.coverId, basketId: prod?.basketId || x.basketId, pastaBoxId: prod?.pastaBoxId || x.pastaBoxId, pastaLidId: prod?.pastaLidId || x.pastaLidId }));
  };
  const onLiquidSelect = (rowId, liquidId) => setRows(r => r.map(x => x.id !== rowId ? x : { ...x, pastaLiquidId: liquidId, productId: '' }));
  const addRow = () => setRows(r => [...r, emptyRow()]);
  const removeRow = (id) => { if (rows.length > 1) setRows(r => r.filter(x => x.id !== id)); };
  const toggleWorker = (wid) => setAssignedWorkers(aw => aw.includes(wid) ? aw.filter(x => x !== wid) : [...aw, wid]);

  const filteredProducts = progType === 'brazer' ? state.products.filter(p => p.isPasta) : state.products.filter(p => !p.isPasta);
  const isBrazer = progType === 'brazer';
  const isLiquidPrep = isBrazer && prepType === 'liquid';

  const handleSave = () => {
    let items;
    if (isLiquidPrep) {
      items = rows.filter(r => r.pastaLiquidId && Number(r.target) > 0).map(r => ({
        pastaLiquidId: r.pastaLiquidId, productId: null, prepType: 'liquid',
        target: Number(r.target), notes: r.notes || '', status: 'pending',
      }));
    } else {
      items = rows.filter(r => r.productId && Number(r.target) > 0).map(r => ({
        productId: r.productId, coverId: r.coverId || null, basketId: r.basketId || null,
        pastaBoxId: r.pastaBoxId || null, pastaLidId: r.pastaLidId || null,
        target: Number(r.target), notes: r.notes || '', status: 'pending',
      }));
    }
    if (!items.length) { toast('—', true); return; }
    onSave({ id: uid(), label: label || T[`prog_${progType}`], progType, chemistId: chemistId || '', assignedWorkers, items });
  };

  return (
    <Modal onClose={onClose} maxWidth={900}>
      <h3>{T.add_program} — {date}</h3>
      <div className="grid cols-2" style={{ marginBottom: 14 }}>
        <div className="field"><label>{T.prog_label}</label><input value={label} onChange={e => setLabel(e.target.value)} placeholder={`${T.prog_daily}...`} /></div>
        <div className="field"><label>{T.prog_type}</label>
          <select value={progType} onChange={e => { setProgType(e.target.value); setRows([emptyRow()]); setPrepType('carton'); }}>
            {PROG_TYPES.map(tp => <option key={tp} value={tp}>{T[`prog_${tp}`]}</option>)}
          </select>
        </div>
      </div>

      {(progType === 'daily' || progType === 'location' || progType === 'macro' || progType === 'brazer') && (
        <div className="grid cols-2" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>🧪 {state.lang === 'ar' ? 'الكيميائي المسؤول' : 'Chimico responsabile'}</label>
            <select value={chemistId} onChange={e => setChemistId(e.target.value)}>
              <option value="">{state.lang === 'ar' ? 'بدون' : 'Nessuno'}</option>
              {(state.workers || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>👷 {state.lang === 'ar' ? 'العمال' : 'Operai assegnati'}</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(state.workers || []).map(w => (
                <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={assignedWorkers.includes(w.id)} onChange={() => toggleWorker(w.id)} />{w.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {isBrazer && (
        <div style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{state.lang === 'ar' ? 'نوع التحضير:' : 'Tipo preparazione:'}</span>
          <button className={prepType === 'carton' ? 'primary' : 'ghost'} style={{ fontSize: 12, padding: '4px 14px' }} onClick={() => { setPrepType('carton'); setRows([emptyRow()]); }}>📦 {state.lang === 'ar' ? 'كراتين' : 'Cartoni'}</button>
          <button className={prepType === 'liquid' ? 'primary' : 'ghost'} style={{ fontSize: 12, padding: '4px 14px' }} onClick={() => { setPrepType('liquid'); setRows([emptyRow()]); }}>🧪 {state.lang === 'ar' ? 'سائل' : 'Liquido'}</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--muted)', fontSize: 11 }}>
              {isLiquidPrep ? (
                <>{[state.lang === 'ar' ? 'السائل' : state.lang === 'it' ? 'Liquido' : 'Liquid', state.lang === 'ar' ? 'الهدف (لتر)' : 'Obiettivo (litri)', T.col_notes, ''].map((h, i) => <th key={i} style={{ padding: '6px 4px', textAlign: 'start', fontWeight: 600 }}>{h}</th>)}</>
              ) : (
                <>
                  <th style={{ padding: '6px 4px', textAlign: 'start', fontWeight: 600 }}>{T.col_product}</th>
                  {!isBrazer && progType !== 'amazon' && <><th style={{ padding: '6px 4px', textAlign: 'start', fontWeight: 600 }}>{T.col_cover}</th><th style={{ padding: '6px 4px', textAlign: 'start', fontWeight: 600 }}>{T.col_basket}</th></>}
                  {isBrazer && <><th style={{ padding: '6px 4px', textAlign: 'start', fontWeight: 600 }}>{state.lang === 'ar' ? 'علبة الباستا' : 'Scatola'}</th><th style={{ padding: '6px 4px', textAlign: 'start', fontWeight: 600 }}>{state.lang === 'ar' ? 'غطاء الباستا' : 'Coperchio'}</th></>}
                  {[T.col_target, T.col_notes, ''].map((h, i) => <th key={i} style={{ padding: '6px 4px', textAlign: 'start', fontWeight: 600 }}>{h}</th>)}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                {isLiquidPrep ? (
                  <>
                    <td style={{ padding: '4px 3px' }}>
                      <select className="input-sm" style={{ minWidth: 130 }} value={row.pastaLiquidId} onChange={e => onLiquidSelect(row.id, e.target.value)}>
                        <option value="">{state.lang === 'ar' ? 'اختر سائل' : 'Seleziona liquido'}</option>
                        {(state.pastaLiquids || []).map(lq => <option key={lq.id} value={lq.id}>{lq.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '4px 3px' }}><input className="input-sm" type="number" style={{ width: 90 }} placeholder={state.lang === 'ar' ? 'لتر' : 'Litri'} value={row.target} onChange={e => setRow(row.id, 'target', e.target.value)} /></td>
                    <td style={{ padding: '4px 3px' }}><input className="input-sm" type="text" style={{ width: 100 }} placeholder={T.col_notes} value={row.notes} onChange={e => setRow(row.id, 'notes', e.target.value)} /></td>
                    <td style={{ padding: '4px 3px' }}><button className="ghost" style={{ color: 'var(--red)', padding: '4px 8px' }} onClick={() => removeRow(row.id)}>✕</button></td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '4px 3px' }}>
                      <select className="input-sm" style={{ minWidth: 130 }} value={row.productId} onChange={e => onProductSelect(row.id, e.target.value)}>
                        <option value="">{T.select_product}</option>
                        {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    {!isBrazer && progType !== 'amazon' && (
                      <>
                        <td style={{ padding: '4px 3px' }}><select className="input-sm" value={row.coverId} onChange={e => setRow(row.id, 'coverId', e.target.value)}><option value="">{T.no_cover}</option>{state.covers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                        <td style={{ padding: '4px 3px' }}><select className="input-sm" value={row.basketId} onChange={e => setRow(row.id, 'basketId', e.target.value)}><option value="">{T.no_basket}</option>{state.baskets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></td>
                      </>
                    )}
                    {isBrazer && (
                      <>
                        <td style={{ padding: '4px 3px' }}><select className="input-sm" value={row.pastaBoxId} onChange={e => setRow(row.id, 'pastaBoxId', e.target.value)}><option value="">{state.lang === 'ar' ? 'اختر علبة' : 'Seleziona scatola'}</option>{(state.pastaBoxes || []).map(pb => <option key={pb.id} value={pb.id}>{pb.name}</option>)}</select></td>
                        <td style={{ padding: '4px 3px' }}><select className="input-sm" value={row.pastaLidId} onChange={e => setRow(row.id, 'pastaLidId', e.target.value)}><option value="">{state.lang === 'ar' ? 'اختر غطاء' : 'Seleziona coperchio'}</option>{(state.pastaLids || []).map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}</select></td>
                      </>
                    )}
                    <td style={{ padding: '4px 3px' }}><input className="input-sm" type="number" style={{ width: 76 }} placeholder={T.target_bancale} value={row.target} onChange={e => setRow(row.id, 'target', e.target.value)} /></td>
                    <td style={{ padding: '4px 3px' }}><input className="input-sm" type="text" style={{ width: 100 }} placeholder={T.col_notes} value={row.notes} onChange={e => setRow(row.id, 'notes', e.target.value)} /></td>
                    <td style={{ padding: '4px 3px' }}><button className="ghost" style={{ color: 'var(--red)', padding: '4px 8px' }} onClick={() => removeRow(row.id)}>✕</button></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button style={{ marginTop: 8 }} onClick={addRow}>+ {isLiquidPrep ? (state.lang === 'ar' ? 'سائل' : 'Liquido') : T.select_product}</button>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={handleSave}>{T.save}</button>
      </div>
    </Modal>
  );
}

/* ---- Confirm Code Modal (uses daily code) ---- */
function ConfirmCodeModal({ item, action, T, dailyCode, products, pastaLiquids, lang, onClose, onConfirm }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  if (!item) return null;
  const isLiq = item.prepType === 'liquid';
  const p = isLiq ? null : (products || []).find(x => x.id === item.productId);
  const liq = isLiq ? (pastaLiquids || []).find(x => x.id === item.pastaLiquidId) : null;
  const displayName = isLiq ? (liq ? liq.name : '?') : (p ? p.name : '?');

  const doConfirm = () => {
    if (dailyCode && code.trim() !== dailyCode) { setErr(T.code_mismatch); return; }
    onConfirm();
  };

  return (
    <Modal onClose={onClose} maxWidth={360}>
      <h3 style={{ textAlign: 'center' }}>{action === 'done' ? T.enter_code : T.undo_confirm}</h3>
      <p style={{ fontWeight: 700, textAlign: 'center', fontSize: 16 }}>{displayName}</p>
      <p className="smallmuted" style={{ textAlign: 'center' }}>
        {isLiq ? `${lang === 'ar' ? 'تحضير' : 'Preparare'}: ${item.target} ${lang === 'ar' ? 'لتر' : 'litri'}` : `${T.target_bancale}: ${item.target}`}
      </p>
      {dailyCode ? (
        <>
          <p style={{ fontSize: 12, color: 'var(--yellow)', textAlign: 'center', marginBottom: 8 }}>
            {lang === 'ar' ? 'أدخل كود اليوم للتأكيد' : 'Inserisci il codice giornaliero'}
          </p>
          <input autoFocus value={code} onChange={e => { setCode(e.target.value); setErr(''); }} onKeyDown={e => e.key === 'Enter' && doConfirm()} placeholder={T.code} style={{ textAlign: 'center', fontSize: 16, fontWeight: 700 }} />
          {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 6, textAlign: 'center' }}>{err}</div>}
        </>
      ) : (
        <p style={{ fontSize: 13, textAlign: 'center', color: 'var(--muted)' }}>
          {action === 'done' ? (lang === 'ar' ? 'هل أنت متأكد؟' : 'Sei sicuro?') : (lang === 'ar' ? 'هل أنت متأكد من التراجع؟' : 'Sei sicuro di annullare?')}
        </p>
      )}
      <div className="row" style={{ justifyContent: 'center', marginTop: 16, gap: 12 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" style={{ minWidth: 100 }} onClick={doConfirm}>{T.confirm}</button>
      </div>
    </Modal>
  );
}

/* ---- Confirm Bancale Modal ---- */
function ConfirmBancaleModal({ item, rowIdx, action, T, dailyCode, lang, onClose, onConfirm }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  if (!item) return null;
  const rows = item.rows ?? Array.from({ length: item.target || 1 }, () => ({ done: false }));
  const isLastBancale = action === 'check' && rows.filter((r, idx) => idx !== rowIdx && !r.done).length === 0;
  const isUndoingDone = action === 'uncheck' && item.status === 'done';
  const requiresCode = (isLastBancale || isUndoingDone) && !!dailyCode;

  const doConfirm = () => {
    if (requiresCode && code.trim() !== dailyCode) { setErr(T.code_mismatch); return; }
    onConfirm();
  };

  const L = {
    ar: { complete_num: 'إتمام البانكاله رقم', undo_num: 'التراجع عن البانكاله رقم', last_warn: 'هذه هي البانكاله الأخيرة. أدخل كود اليوم للتأكيد.', undo_warn: 'البرنامج مكتمل. أدخل كود اليوم للتراجع.', confirm_q: 'هل أنت متأكد من إتمام هذه البانكاله؟', undo_q: 'هل أنت متأكد من التراجع؟' },
    it: { complete_num: 'Completare il bancale n.', undo_num: 'Annullare il bancale n.', last_warn: "Questo è l'ultimo bancale. Inserisci il codice giornaliero.", undo_warn: 'Programma completato. Inserisci il codice giornaliero.', confirm_q: 'Sei sicuro di voler completare?', undo_q: 'Sei sicuro di voler annullare?' },
    en: { complete_num: 'Complete pallet #', undo_num: 'Undo pallet #', last_warn: 'Last pallet. Enter daily code.', undo_warn: 'Completed. Enter daily code to undo.', confirm_q: 'Complete this pallet?', undo_q: 'Undo this pallet?' },
    es: { complete_num: 'Completar bancale #', undo_num: 'Deshacer bancale #', last_warn: 'Último bancale. Ingrese código diario.', undo_warn: 'Completado. Ingrese código diario.', confirm_q: '¿Completar?', undo_q: '¿Deshacer?' },
  };
  const tr = L[lang] || L.en;

  return (
    <Modal onClose={onClose} maxWidth={360}>
      <h3 style={{ textAlign: 'center', marginBottom: 12 }}>{action === 'check' ? (requiresCode ? T.enter_code : T.confirm) : (requiresCode ? T.undo_confirm : T.undo)}</h3>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <p className="smallmuted" style={{ margin: 0, fontSize: 13 }}>
          {action === 'check' ? tr.complete_num : tr.undo_num}{' '}
          <span className="mono" style={{ fontWeight: 700, color: 'var(--yellow)' }}>#{rowIdx + 1}</span>
        </p>
      </div>
      {requiresCode ? (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--yellow)', textAlign: 'center', marginBottom: 8 }}>{isLastBancale ? tr.last_warn : tr.undo_warn}</p>
          <input autoFocus value={code} onChange={e => { setCode(e.target.value); setErr(''); }} onKeyDown={e => e.key === 'Enter' && doConfirm()} placeholder={T.code} style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, width: '100%' }} />
          {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 6, textAlign: 'center' }}>{err}</div>}
        </div>
      ) : (
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--muted)', marginBottom: 16 }}>{action === 'check' ? tr.confirm_q : tr.undo_q}</p>
      )}
      <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 16 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" style={{ minWidth: 100 }} onClick={doConfirm}>{T.confirm}</button>
      </div>
    </Modal>
  );
}

/* ---- Product Details Modal ---- */
function ProductDetailsModal({ product, state, T, onClose }) {
  const p = product;
  if (!p) return null;
  const lang = state.lang;
  const cv = state.covers.find(x => x.id === p.coverId);
  const bk = state.baskets.find(x => x.id === p.basketId);
  const pBox = (state.pastaBoxes || []).find(x => x.id === p.pastaBoxId);
  const pLid = (state.pastaLids || []).find(x => x.id === p.pastaLidId);
  const liquid = (state.pastaLiquids || []).find(x => x.id === p.pastaLiquidId);

  return (
    <Modal onClose={onClose} maxWidth={480}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        {p.image ? <img src={p.image} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 12, border: '2px solid var(--line)' }} />
          : <div style={{ width: 100, height: 100, borderRadius: 12, background: 'var(--bg)', border: '2px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, margin: '0 auto' }}>🧴</div>}
        <h3 style={{ margin: '10px 0 4px 0' }}>{p.name}</h3>
        <div className="smallmuted">{p.company} · {p.type} · {p.liter}L</div>
      </div>
      <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12 }}>
          <div><strong>{T.code}:</strong> <span className="mono" style={{ color: 'var(--yellow)' }}>{p.code}</span></div>
          <div><strong>{T.barcode}:</strong> <span className="mono">{p.barcode || '—'}</span></div>
          <div><strong>{T.liter}:</strong> {p.liter}L</div>
          <div><strong>{T.company}:</strong> {p.company}</div>
        </div>
      </div>
      {p.isPasta ? (
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>📦 {lang === 'ar' ? 'تغليف الباستا' : 'Confezionamento Pasta'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12 }}>
            <div><strong>{lang === 'ar' ? 'علبة' : 'Scatola'}:</strong> {pBox ? pBox.name : '—'}</div>
            <div><strong>{lang === 'ar' ? 'غطاء' : 'Coperchio'}:</strong> {pLid ? pLid.name : '—'}</div>
            <div><strong>{lang === 'ar' ? 'إسفنجة' : 'Spugna'}:</strong> {p.hasSponge ? '✓' : '✗'}</div>
            <div><strong>{lang === 'ar' ? 'سائل' : 'Liquido'}:</strong> {liquid ? liquid.name : '—'}</div>
          </div>
          {liquid && liquid.prepNotes && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--yellow)' }}>⚠️ {liquid.prepNotes}</div>}
          {liquid && liquid.recipe && liquid.recipe.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>📋 {liquid.recipe.map(r => `${r.name}: ratio ${r.ratio}`).join(' | ')}</div>
          )}
        </div>
      ) : (
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>📦 {lang === 'ar' ? 'التغليف' : 'Confezionamento'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12 }}>
            <div><strong>{T.col_cover}:</strong> {cv ? `${cv.name} (${cv.color || ''} ${cv.size || ''})` : '—'}</div>
            <div><strong>{T.col_basket}:</strong> {bk ? `${bk.name} (${bk.color || ''} ${bk.size || ''})` : '—'}</div>
            <div><strong>{T.tickets_front}:</strong> {p.ticketsFront}</div>
            <div><strong>{T.tickets_back}:</strong> {p.ticketsBack}</div>
            <div><strong>{T.caps_per}:</strong> {p.capsPer}</div>
            <div><strong>{T.jerricans_per}:</strong> {p.jerricansPer}</div>
          </div>
          {p.recipe && p.recipe.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>📋 {p.recipe.map(r => `${r.name}: ratio ${r.ratio}`).join(' | ')}</div>
          )}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}><button className="primary" onClick={onClose}>{T.close}</button></div>
    </Modal>
  );
}
