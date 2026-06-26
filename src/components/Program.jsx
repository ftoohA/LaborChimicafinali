import { useState, useRef, Fragment } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { I18N, PROG_TYPES } from '../i18n';
import { todayStr, updateProgramItem, uid, productCapacity } from '../helpers';
import Modal from './Modal';
import ProgBadge from './ProgBadge';
import { useConfirm } from './ConfirmDialog';

export default function Program() {
  const { state, update, addLog } = useStore();
  const T = I18N[state.lang];
  const confirm = useConfirm();
  const toast = useToast();

  const date = state.progDate || todayStr();
  const typeFilter = state.progTypeFilter || 'all';
  const allProgs = state.programs[date] || [];
  const progs = typeFilter === 'all' ? allProgs : allProgs.filter(p => p.progType === typeFilter);

  const [showAddProg, setShowAddProg] = useState(false);
  const [confirmItem, setConfirmItem] = useState(null); // {pi, ii, action, pendingRows}
  const [confirmBancale, setConfirmBancale] = useState(null); // {pi, ii, rowIdx, action}
  const [notesText, setNotesText] = useState(state.managerNotes[date] || '');
  const [viewingProduct, setViewingProduct] = useState(null);
  const [adminView, setAdminView] = useState('programs'); // 'programs' | 'operai'
  const [progIndex, setProgIndex] = useState(0); // one-program-at-a-time pager

  const setDate = (d) => {
    update({ progDate: d });
    setNotesText(state.managerNotes[d] || '');
  };

  const saveNotes = () => {
    update({ managerNotes: { ...state.managerNotes, [date]: notesText } });
    toast(T.success_added);
  };

  const deleteProgram = async (realPi) => {
    const pr = allProgs[realPi];
    if (!(await confirm({ danger: true, title: T.confirm_delete, message: pr?.label || T.today_program }))) return;
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

  /* ---- Composition consumption: deduct recipe materials from prep warehouses ----
     Base material per bancale = (pasta: 12 cartoni · else: taniche) × litri del prodotto.
     Per ingredient = percent% × base × target × (1 + scarto%), in the warehouse's unit
     (ml/g use the ×1000 scale; liter/kg stay as-is, density ≈ 1). */
  const consumeRecipe = (p, target, sign) => {
    const recipe = (p.recipe || []).filter(r => r.warehouseId && Number(r.percent) > 0);
    if (!recipe.length) return state.warehouses || [];
    const litersPerBancale = p.isPasta ? 12 * (Number(p.liter) || 0) : (Number(p.jerricansPer) || 0) * (Number(p.liter) || 0);
    const baseLiters = litersPerBancale * target;
    const wasteMul = 1 + (Number(p.liquidWaste) || 0) / 100;
    return (state.warehouses || []).map(w => {
      const ing = recipe.find(r => r.warehouseId === w.id);
      if (!ing) return w;
      const gross = (Number(ing.percent) / 100) * baseLiters * wasteMul;
      const amount = (w.unit === 'ml' || w.unit === 'g') ? gross * 1000 : gross;
      return { ...w, stock: Math.max(0, (w.stock || 0) + sign * amount) };
    });
  };

  /* ---- Deduct a product item's attached warehouse-piece materials ---- */
  const applyItemMaterials = (whs, it, sign) => {
    if (!it.materials || !it.materials.length) return whs;
    return whs.map(w => {
      const m = it.materials.find(x => x.warehouseId === w.id);
      if (!m) return w;
      return { ...w, stock: Math.max(0, (w.stock || 0) + sign * (Number(m.qty) || 0)) };
    });
  };

  /* ---- Read-only note of a product item's attached materials ---- */
  const matNote = (it) => {
    if (!it.materials || !it.materials.length) return null;
    const parts = it.materials.map(m => {
      const w = (state.warehouses || []).find(x => x.id === m.warehouseId);
      return `${w ? w.name : '?'} ×${m.qty}`;
    }).join(' · ');
    return <div className="smallmuted" style={{ fontSize: 10, color: 'var(--yellow)' }}>📦 {parts}</div>;
  };

  /* ---- Is a production item short on materials for its target? ---- */
  const materialShort = (it, progType) => {
    if (progType === 'amazon' || it.type || it.prepType === 'liquid') return false;
    const p = state.products.find(x => x.id === it.productId);
    if (!p) return false;
    return productCapacity(p, Number(it.target) || 0, state).shortages.length > 0;
  };

  /* ---- Stock deduction on item confirm ---- */
  const handleConfirm = ({ pi, ii, action, pendingRows }) => {
    const it = allProgs[pi].items[ii];
    if (it.type === 'prep_instruction') { handlePrepConfirm({ pi, ii, action }); return; }
    if (it.type === 'custom_material') { handleCustomConfirm({ pi, ii, action }); return; }
    if (it.prepType === 'liquid') { handleLiquidConfirm({ pi, ii, action, pendingRows }); return; }
    const p = state.products.find(x => x.id === it.productId);
    if (!p) return;
    const s = state.settings;
    const target = Number(it.target);
    const sign = action === 'done' ? -1 : 1;
    const progItem = allProgs[pi];
    const isAmazonItem = progItem && progItem.progType === 'amazon';

    // Block production confirm when materials aren't enough (Amazon pulls from finished stock, so skip)
    if (action === 'done' && !isAmazonItem) {
      const cap = productCapacity(p, target, state);
      if (cap.shortages.length) {
        const top = [...cap.shortages].sort((a, b) => b.missing - a.missing)[0];
        toast(`${state.lang === 'ar' ? '⛔ مواد ناقصة' : '⛔ Materiali insufficienti'}: ${top.name} (−${Math.ceil(top.missing).toLocaleString()} ${top.unit})`, true);
        setConfirmItem(null); setConfirmBancale(null);
        return;
      }
    }

    if (p.isPasta) {
      const effectiveBoxId = it.pastaBoxId || p.pastaBoxId;
      const effectiveLidId = it.pastaLidId || p.pastaLidId;
      const cartonsTotal = target * 12;
      const updatedPastaBoxes = effectiveBoxId
        ? (state.pastaBoxes || []).map(pb => pb.id !== effectiveBoxId ? pb : { ...pb, stock: Math.max(0, (pb.stock || 0) + sign * cartonsTotal * (1 + (s.wastePastaBox || 2) / 100)) })
        : (state.pastaBoxes || []);
      const updatedPastaLids = effectiveLidId
        ? (state.pastaLids || []).map(pl => pl.id !== effectiveLidId ? pl : { ...pl, stock: Math.max(0, (pl.stock || 0) + sign * cartonsTotal * (1 + (s.wastePastaLid || 2) / 100)) })
        : (state.pastaLids || []);
      let updatedPastaStock = { ...(state.pastaStock || { sponges: 0, spongeLids: 0 }) };
      if (p.hasSponge) {
        updatedPastaStock.sponges = Math.max(0, (updatedPastaStock.sponges || 0) + sign * cartonsTotal * (1 + (s.wastePastaSponge || 2) / 100));
        updatedPastaStock.spongeLids = Math.max(0, (updatedPastaStock.spongeLids || 0) + sign * cartonsTotal * (1 + (s.wastePastaSpongeLid || 2) / 100));
      }
      const liquid = (state.pastaLiquids || []).find(x => x.id === p.pastaLiquidId);
      const updatedPastaLiquids = liquid
        ? (state.pastaLiquids || []).map(lq => lq.id !== liquid.id ? lq : { ...lq, stock: Math.max(0, (lq.stock || 0) + sign * cartonsTotal * (p.liter || 0.5) * (1 + (s.wastePastaLiquid || 2) / 100)) })
        : (state.pastaLiquids || []);
      const rowsUpdate = action === 'done'
        ? { status: 'done', rows: pendingRows ?? makeRows(it).map(r => ({ ...r, done: true })) }
        : { status: 'pending', rows: makeRows(it).map(r => ({ ...r, done: false })) };
      const newProgs = updateProgramItem(state.programs, date, pi, ii, rowsUpdate);
      // Pasta carton production: store finished cartons (1 bancale = 12 cartons)
      const pf = { ...(state.pastaFinished || {}) };
      pf[p.id] = Math.max(0, (pf[p.id] || 0) + (-sign) * target * 12);
      // Composition + attached piece-materials: deduct from warehouses
      const updatedWarehouses = applyItemMaterials(consumeRecipe(p, target, sign), it, sign);
      update({ programs: newProgs, pastaBoxes: updatedPastaBoxes, pastaLids: updatedPastaLids, pastaStock: updatedPastaStock, pastaLiquids: updatedPastaLiquids, pastaFinished: pf, warehouses: updatedWarehouses });
    } else {
      const prog = allProgs[pi];
      const isAmazon = prog && prog.progType === 'amazon';
      const piecesPerBancale = p.jerricansPer || p.capsPer || 1;

      // Carton deduction with waste. Amazon target is in PIECES (1 carton/piece);
      // Linea target is in BANCALE (1 carton per unit = bancale × units/bancale).
      const cartonId = it.cartonId || p.cartonId;
      const cartonUnits = isAmazon ? target : target * piecesPerBancale;
      const updatedCartons = (cartonId && (p.hasCarton || isAmazon))
        ? (state.cartonTypes || []).map(c => c.id !== cartonId ? c : { ...c, stock: Math.max(0, (c.stock || 0) + sign * cartonUnits * (1 + (c.waste || 0) / 100)) })
        : (state.cartonTypes || []);

      const rowsUpdate = action === 'done'
        ? { status: 'done', rows: isAmazon ? [{ done: true }] : (pendingRows ?? makeRows(it).map(r => ({ ...r, done: true }))) }
        : { status: 'pending', rows: isAmazon ? [{ done: false }] : makeRows(it).map(r => ({ ...r, done: false })) };
      const newProgs = updateProgramItem(state.programs, date, pi, ii, rowsUpdate);

      if (isAmazon) {
        // Amazon: deduct bancale from Linea stock (128 cartons = 1 bancale), add cartons to Amazon stock
        const lf = { ...(state.lineaFinished || {}) };
        const af = { ...(state.amazonFinished || {}) };
        lf[p.id] = Math.max(0, (lf[p.id] || 0) + sign * (target / 128));
        af[p.id] = Math.max(0, (af[p.id] || 0) + (-sign) * target);
        update({ programs: newProgs, lineaFinished: lf, amazonFinished: af, cartonTypes: updatedCartons });
      } else {
        // Linea / standard: deduct manufacturing materials + cartons
        const updatedProducts = state.products.map(prod => {
          if (prod.id !== p.id) return prod;
          return { ...prod, stock: { ...prod.stock,
            ticketsFront: Math.max(0, prod.stock.ticketsFront + sign * target * prod.ticketsFront * (1 + s.wasteTicket / 100)),
            ticketsBack:  Math.max(0, prod.stock.ticketsBack  + sign * target * prod.ticketsBack  * (1 + s.wasteTicket / 100)),
            caps:      !prod.coverId  ? Math.max(0, prod.stock.caps      + sign * target * prod.capsPer      * (1 + s.wasteCap / 100))      : prod.stock.caps,
            jerricans: !prod.basketId ? Math.max(0, prod.stock.jerricans + sign * target * prod.jerricansPer * (1 + s.wasteJerrican / 100)) : prod.stock.jerricans,
          }};
        });
        const effectiveCoverId  = it.coverId  || p.coverId;
        const effectiveBasketId = it.basketId || p.basketId;
        const updatedCovers = effectiveCoverId && p.capsPer > 0
          ? state.covers.map(c => c.id !== effectiveCoverId ? c : { ...c, stock: Math.max(0, (c.stock || 0) + sign * target * p.capsPer * (1 + s.wasteCap / 100)) })
          : state.covers;
        const updatedBaskets = effectiveBasketId && p.jerricansPer > 0
          ? state.baskets.map(b => b.id !== effectiveBasketId ? b : { ...b, stock: Math.max(0, (b.stock || 0) + sign * target * p.jerricansPer * (1 + s.wasteJerrican / 100)) })
          : state.baskets;
        // Linea production: add produced bancale to Linea finished stock
        const lf = { ...(state.lineaFinished || {}) };
        lf[p.id] = Math.max(0, (lf[p.id] || 0) + (-sign) * target);

        // Composition + attached piece-materials: deduct from warehouses
        const updatedWarehouses = applyItemMaterials(consumeRecipe(p, target, sign), it, sign);
        update({ programs: newProgs, products: updatedProducts, covers: updatedCovers, baskets: updatedBaskets, cartonTypes: updatedCartons, lineaFinished: lf, warehouses: updatedWarehouses });
      }
    }
    addLog({ type: action === 'done' ? 'produce' : 'undo', product: p.code, target, date, by: state.role });
    toast(action === 'done' ? T.success_done : T.success_undo);
    setConfirmItem(null);
  };

  /* ---- Liquid prep: add liters to base liquid stock, consume recipe ingredients ---- */
  const handleLiquidConfirm = ({ pi, ii, action, pendingRows }) => {
    const it = allProgs[pi].items[ii];
    const liq = (state.pastaLiquids || []).find(x => x.id === it.pastaLiquidId);
    if (!liq) return;
    const liters = Number(it.target) || 0;
    const sign = action === 'done' ? 1 : -1;
    const updatedLiquids = (state.pastaLiquids || []).map(l => l.id !== liq.id ? l : { ...l, stock: Math.max(0, (l.stock || 0) + sign * liters) });

    // Consume recipe ingredients linked to prep warehouses (done → deduct, undo → add back)
    const whSign = action === 'done' ? -1 : 1;
    const linked = (liq.recipe || []).filter(r => r.warehouseId && Number(r.ratio) > 0);
    let updatedWarehouses = state.warehouses || [];
    if (linked.length) {
      updatedWarehouses = updatedWarehouses.map(w => {
        const ing = linked.find(r => r.warehouseId === w.id);
        if (!ing) return w;
        return { ...w, stock: Math.max(0, (w.stock || 0) + whSign * Number(ing.ratio) * liters) };
      });
    }

    const rowsUpdate = action === 'done'
      ? { status: 'done', rows: pendingRows ?? [{ done: true }] }
      : { status: 'pending', rows: [{ done: false }] };
    const newProgs = updateProgramItem(state.programs, date, pi, ii, rowsUpdate);
    update({ programs: newProgs, pastaLiquids: updatedLiquids, warehouses: updatedWarehouses });
    addLog({ type: action === 'done' ? 'liquid_prep' : 'liquid_undo', liquid: liq.name, liters, date, by: state.role });
    toast(action === 'done' ? T.success_done : T.success_undo);
    setConfirmItem(null);
  };

  /* ---- Chemist prep instruction confirm (no stock change; Linea production deducts) ---- */
  const handlePrepConfirm = ({ pi, ii, action }) => {
    const rowsUpdate = action === 'done' ? { status: 'done', rows: [{ done: true }] } : { status: 'pending', rows: [{ done: false }] };
    const newProgs = updateProgramItem(state.programs, date, pi, ii, rowsUpdate);
    update({ programs: newProgs });
    addLog({ type: action === 'done' ? 'prep_done' : 'prep_undo', date, by: state.role });
    toast(action === 'done' ? T.success_done : T.success_undo);
    setConfirmItem(null);
  };

  /* ---- Custom warehouse material confirm ---- */
  const handleCustomConfirm = ({ pi, ii, action }) => {
    const it = allProgs[pi].items[ii];
    const sign = action === 'done' ? -1 : 1;
    const updatedWarehouses = (state.warehouses || []).map(w =>
      w.id !== it.warehouseId ? w : { ...w, stock: Math.max(0, (w.stock || 0) + sign * it.target) }
    );
    const rowsUpdate = action === 'done' ? { status: 'done', rows: [{ done: true }] } : { status: 'pending', rows: [{ done: false }] };
    const newProgs = updateProgramItem(state.programs, date, pi, ii, rowsUpdate);
    update({ programs: newProgs, warehouses: updatedWarehouses });
    addLog({ type: action === 'done' ? 'custom_material_used' : 'custom_material_undo', warehouseId: it.warehouseId, qty: it.target, date, by: state.role });
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
    const pr = allProgs[pi];
    const it = pr.items[ii];
    if (materialShort(it, pr.progType)) {
      const p = state.products.find(x => x.id === it.productId);
      const cap = productCapacity(p, Number(it.target) || 0, state);
      const top = [...cap.shortages].sort((a, b) => b.missing - a.missing)[0];
      toast(`⛔ ${state.lang === 'ar' ? 'مواد ناقصة' : 'Materiali insufficienti'}: ${top.name} (−${Math.ceil(top.missing).toLocaleString()} ${top.unit})`, true);
      return;
    }
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
        </div>

        {/* Manager notes */}
        {state.managerNotes[date] && (
          <div className="notes-card" style={{ marginBottom: 16 }}>
            <h3>📋 {T.manager_notes}</h3>
            <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.7 }}>{state.managerNotes[date]}</p>
          </div>
        )}

        {/* ===== LINE VIEW ===== */}
        {(() => {
            const dailyProgs = allProgs.filter(p => p.progType === 'daily');
            const chimicoProgs = allProgs.filter(p => p.progType === 'location');
            const otherProgs = allProgs.filter(p => p.progType !== 'daily' && p.progType !== 'location');

            // Find maximum target across all daily items for matrix columns
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
                                      {materialShort(it, pr.progType) && it.status !== 'done' && (
                                        <div className="badge bad" style={{ fontSize: 9, marginTop: 2 }}>⛔ {state.lang === 'ar' ? 'مواد ناقصة' : 'Materiali insuff.'}</div>
                                      )}
                                      {matNote(it)}
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

                {/* CHIMICO (location) -> shown to workers/chemist incl. liquid prep */}
                {chimicoProgs.map(pr => {
                  const realPi = allProgs.indexOf(pr);
                  if (!pr.items.length) return null;
                  const chemist = (state.workers || []).find(w => w.id === pr.chemistId);
                  return (
                    <div className="card prog-section" key={pr.id} style={{ marginBottom: 16, borderColor: 'var(--green)' }}>
                      <div className="prog-header" style={{ marginBottom: 10 }}>
                        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <ProgBadge type={pr.progType} T={T} />
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{pr.label || (state.lang === 'ar' ? 'الكيميائي' : 'Chimico')}</span>
                          {chemist && <span className="badge warn" style={{ fontSize: 10 }}>🧪 {chemist.name}</span>}
                        </div>
                      </div>
                      <div className="sched-wrap">
                        <table className="sched-table">
                          <thead>
                            <tr>
                              <th style={{ minWidth: 200 }}>{T.col_product}</th>
                              <th style={{ width: 90 }}>{T.col_target}</th>
                              <th style={{ width: 60, textAlign: 'center' }}>✓</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pr.items.map((it, ii) => {
                              const isDone = it.status === 'done';
                              if (it.type === 'prep_instruction') {
                                return (
                                  <tr key={`${realPi}-${ii}`} className={isDone ? 'row-done' : 'row-pending'} style={{ background: 'rgba(80,180,120,0.07)' }}>
                                    <td style={{ verticalAlign: 'middle' }}>
                                      <div style={{ fontWeight: 700, fontSize: 13 }}>🧪 {state.lang === 'ar' ? 'تحضير' : 'Preparare'}: {it.productName}</div>
                                      <ul style={{ margin: '4px 0 0', paddingInlineStart: 18, fontSize: 12 }}>
                                        {(it.ingredients || []).map((g, gi) => (
                                          <li key={gi}><strong>{g.name}</strong>: {+g.amount.toFixed(2)} {g.unit} <span className="smallmuted">({g.percent}%)</span></li>
                                        ))}
                                      </ul>
                                    </td>
                                    <td className="mono" style={{ fontWeight: 700, verticalAlign: 'middle' }}>{+(it.totalLiters || 0).toFixed(1)} L</td>
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
                              }
                              const isLiq = it.prepType === 'liquid';
                              const isCustom = it.type === 'custom_material';
                              let name = '?', sub = '', qtyLabel = it.target;
                              if (isLiq) {
                                const liq = (state.pastaLiquids || []).find(x => x.id === it.pastaLiquidId);
                                name = `🧪 ${liq ? liq.name : '?'}`;
                                qtyLabel = `${it.target} ${state.lang === 'ar' ? 'لتر' : 'L'}`;
                              } else if (isCustom) {
                                const wh = (state.warehouses || []).find(w => w.id === it.warehouseId);
                                name = `📦 ${wh?.name || '?'}`;
                                const u = wh?.unit === 'liter' ? 'L' : wh?.unit === 'ml' ? 'ml' : wh?.unit === 'kg' ? 'kg' : wh?.unit === 'g' ? 'g' : (state.lang === 'ar' ? 'قطعة' : 'pz');
                                qtyLabel = `${it.target} ${u}`;
                              } else {
                                const p = state.products.find(x => x.id === it.productId);
                                name = p ? p.name : '?';
                                sub = p?.code || '';
                              }
                              return (
                                <tr key={`${realPi}-${ii}`} className={isDone ? 'row-done' : 'row-pending'}>
                                  <td style={{ verticalAlign: 'middle' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{name}</div>
                                    {sub && <div className="smallmuted" style={{ fontSize: 10 }}>{sub}</div>}
                                  </td>
                                  <td className="mono" style={{ fontWeight: 700, verticalAlign: 'middle' }}>{qtyLabel}</td>
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
                                        {materialShort(it, pr.progType) && !isDone && (
                                          <div className="badge bad" style={{ fontSize: 9, marginTop: 2 }}>⛔ {state.lang === 'ar' ? 'مواد ناقصة' : 'Materiali insuff.'}</div>
                                        )}
                                        {p && <div className="smallmuted" style={{ fontSize: 10 }}>{p.code}</div>}
                                        {matNote(it)}
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

                {dailyItems.length === 0 && otherProgs.length === 0 && chimicoProgs.length === 0 && <div className="empty">{T.no_program_today}</div>}
              </>
            );
          })()}

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
            T={T} dailyCode={todayCode} products={state.products} pastaLiquids={state.pastaLiquids || []}
            warehouses={state.warehouses || []} lang={state.lang}
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
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, marginBottom: 2, display: 'block' }}>{T.prog_type}</label>
            <div className="row wrap" style={{ gap: 6 }}>
              <button className={typeFilter === 'all' ? 'primary' : 'ghost'} style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => update({ progTypeFilter: 'all' })}>{T.all_types}</button>
              {PROG_TYPES.map(tp => {
                const cnt = allProgs.filter(p => p.progType === tp).length;
                return (
                  <button key={tp} className={typeFilter === tp ? 'primary' : 'ghost'} style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => update({ progTypeFilter: tp })}>
                    {T[`prog_${tp}`]}{cnt > 0 ? ` (${cnt})` : ''}
                  </button>
                );
              })}
            </div>
          </div>
          {state.role === 'admin' && (
            <button className="primary" onClick={() => setShowAddProg(true)}>+ {T.add_program}</button>
          )}
        </div>
        {/* View switch: programs vs per-worker board */}
        <div className="row" style={{ gap: 6, marginTop: 12 }}>
          <button className={adminView === 'programs' ? 'primary' : 'ghost'} style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setAdminView('programs')}>
            📋 {state.lang === 'ar' ? 'البرامج' : 'Programmi'}
          </button>
          <button className={adminView === 'operai' ? 'primary' : 'ghost'} style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setAdminView('operai')}>
            👷 {state.lang === 'ar' ? 'العمال' : 'Operai'}
          </button>
        </div>
      </div>

      <div className="notes-card" style={{ marginBottom: 16 }}>
        <h3>📋 {T.manager_notes} — {date}</h3>
        <textarea className="notes-ta" placeholder={T.write_notes} value={notesText} onChange={e => setNotesText(e.target.value)} style={{ minHeight: 80 }} />
        <div style={{ marginTop: 8 }}><button className="primary" onClick={saveNotes}>{T.save_notes}</button></div>
      </div>

      {adminView === 'operai' ? (
        <WorkersBoard state={state} update={update} date={date} allProgs={allProgs} T={T} />
      ) : progs.length === 0 ? (
        <div className="empty">{T.no_program_today}</div>
      ) : (() => {
        const curIdx = Math.min(progIndex, progs.length - 1);
        return (
        <>
          {progs.length > 1 && (() => {
            const cur = progs[curIdx];
            const chem = (state.workers || []).find(w => w.id === cur.chemistId);
            return (
              <div className="card" style={{ padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <button className="ghost" disabled={curIdx <= 0} onClick={() => setProgIndex(curIdx - 1)}>← {state.lang === 'ar' ? 'السابق' : 'Prec.'}</button>
                <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <ProgBadge type={cur.progType} T={T} />
                  <strong>{cur.label || T.today_program}</strong>
                  {chem && <span className="badge warn" style={{ fontSize: 10 }}>🧪 {chem.name}</span>}
                  <span className="smallmuted mono">{curIdx + 1} / {progs.length}</span>
                </div>
                <button className="ghost" disabled={curIdx >= progs.length - 1} onClick={() => setProgIndex(curIdx + 1)}>{state.lang === 'ar' ? 'التالي' : 'Succ.'} →</button>
              </div>
            );
          })()}
          {[progs[curIdx]].map(pr => {
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
                    const colSpanName = pr.progType !== 'amazon' ? 3 : 1;
                    if (it.type === 'prep_instruction') {
                      return (
                        <tr key={ii} className={it.status === 'done' ? 'row-done' : 'row-pending'} style={{ background: 'rgba(80,180,120,0.07)' }}>
                          <td className="mono smallmuted">{ii + 1}</td>
                          <td colSpan={colSpanName}>
                            <strong>🧪 {state.lang === 'ar' ? 'تحضير' : 'Preparare'}: {it.productName}</strong>
                            <span className="smallmuted" style={{ fontSize: 11 }}> · {it.target} {T.bancale_equiv}</span>
                            <ul style={{ margin: '4px 0 0', paddingInlineStart: 18, fontSize: 12 }}>
                              {(it.ingredients || []).map((g, gi) => (
                                <li key={gi}><strong>{g.name}</strong>: {+g.amount.toFixed(2)} {g.unit} <span className="smallmuted">({g.percent}%{g.warehouse ? ` · ${g.warehouse}` : ''})</span></li>
                              ))}
                            </ul>
                          </td>
                          <td className="mono smallmuted">{+(it.totalLiters || 0).toFixed(1)} L</td>
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
                    }
                    const isCustom = it.type === 'custom_material';
                    if (isCustom) {
                      const wh = (state.warehouses || []).find(w => w.id === it.warehouseId);
                      const unitLbl = wh?.unit === 'liter' ? 'L' : wh?.unit === 'ml' ? 'ml' : wh?.unit === 'kg' ? 'kg' : wh?.unit === 'g' ? 'g' : (state.lang === 'ar' ? 'قطعة' : 'pz');
                      const nameColSpan = pr.progType !== 'amazon' ? 3 : 1;
                      return (
                        <tr key={ii} className={it.status === 'done' ? 'row-done' : 'row-pending'} style={{ background: 'rgba(100,120,200,0.06)' }}>
                          <td className="mono smallmuted">{ii + 1}</td>
                          <td colSpan={nameColSpan}>
                            <strong>📦 {wh?.name || '?'}</strong>
                          </td>
                          <td className="mono" style={{ fontWeight: 700 }}>{it.target} {unitLbl}</td>
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
                    }
                    const isLiq = it.prepType === 'liquid';
                    const p  = isLiq ? null : state.products.find(x => x.id === it.productId);
                    const liq = isLiq ? (state.pastaLiquids || []).find(x => x.id === it.pastaLiquidId) : null;
                    const cv = p ? state.covers.find(x => x.id === (it.coverId || p?.coverId)) : null;
                    const bk = p ? state.baskets.find(x => x.id === (it.basketId || p?.basketId)) : null;
                    const pBox = p ? (state.pastaBoxes || []).find(x => x.id === (it.pastaBoxId || p?.pastaBoxId)) : null;
                    const pLid = p ? (state.pastaLids || []).find(x => x.id === (it.pastaLidId || p?.pastaLidId)) : null;
                    const displayName = isLiq ? (liq ? `🧪 ${liq.name}` : '?') : (p ? p.name : '?');
                    const isShort = materialShort(it, pr.progType) && it.status !== 'done';
                    return (
                      <tr key={ii} className={it.status === 'done' ? 'row-done' : 'row-pending'}>
                        <td className="mono smallmuted">{ii + 1}</td>
                        <td>
                          <strong>{displayName}</strong>
                          {isShort && <span className="badge bad" style={{ marginInlineStart: 6, fontSize: 10 }}>⛔ {state.lang === 'ar' ? 'مواد ناقصة' : 'Materiali insuff.'}</span>}
                          {p && <><br /><span className="smallmuted">{p.code}</span></>}
                          {matNote(it)}
                          {isLiq && <><br /><span className="smallmuted">{it.target}L</span></>}
                        </td>
                        {pr.progType !== 'amazon' && pr.progType !== 'brazer' && (
                          <><td className="smallmuted">{cv ? cv.name : '—'}</td><td className="smallmuted">{bk ? bk.name : '—'}</td></>
                        )}
                        {pr.progType === 'brazer' && (
                          <><td className="smallmuted">{pBox ? pBox.name : '—'}</td><td className="smallmuted">{pLid ? pLid.name : '—'}</td></>
                        )}
                        <td className="mono" style={{ fontWeight: 700 }}>
                          {isLiq
                            ? `${it.target}L`
                            : (it.status === 'done'
                                ? (it.target || '—')
                                : <input type="number" min={0} defaultValue={it.target} title={state.lang === 'ar' ? 'عدّل الهدف ليتوافق مع الموارد' : "Modifica l'obiettivo per adattarlo alle scorte"}
                                    style={{ width: 64, padding: '4px 6px', fontWeight: 700 }}
                                    onBlur={e => updateInlineField(realPi, ii, 'target', Number(e.target.value) || 0)} />)}
                        </td>
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
        </>
        );
      })()}

      {showAddProg && (() => {
        // Build chemist prep tasks (with computed quantities) for a Linea program
        const buildPrepTasks = (prog) => {
          const preps = [];
          prog.items.forEach(it => {
            if (it.prepType === 'liquid' || it.type === 'custom_material') return;
            const p = state.products.find(x => x.id === it.productId);
            if (!p) return;
            const recipe = (p.recipe || []).filter(r => r.warehouseId && Number(r.percent) > 0);
            if (!recipe.length) return;
            const target = Number(it.target) || 0;
            const litersPerBancale = p.isPasta ? 12 * (Number(p.liter) || 0) : (Number(p.jerricansPer) || 0) * (Number(p.liter) || 0);
            const base = litersPerBancale * target;
            const wasteMul = 1 + (Number(p.liquidWaste) || 0) / 100;
            const UNIT_LBL = { liter: 'L', ml: 'ml', kg: 'kg', g: 'g', carton: 'cart.', piece: 'pz' };
            const ingredients = recipe.map(r => {
              const w = (state.warehouses || []).find(x => x.id === r.warehouseId);
              const grossL = (Number(r.percent) / 100) * base * wasteMul;
              const amount = (w?.unit === 'ml' || w?.unit === 'g') ? grossL * 1000 : grossL;
              return { name: w ? w.name : r.name, warehouse: w?.name || '', unit: UNIT_LBL[w?.unit] || w?.unit || 'L', percent: Number(r.percent), amount };
            });
            preps.push({ id: uid(), type: 'prep_instruction', productId: p.id, productName: p.name, target, totalLiters: base, ingredients, notes: '', status: 'pending', rows: [{ done: false }] });
          });
          return preps;
        };

        const saveProg = (prog) => {
          let progsForDate = [...(state.programs[date] || []), prog];
          // Linea program → auto-add prep tasks to the Chimico (location) program
          if (prog.progType === 'daily') {
            const preps = buildPrepTasks(prog);
            if (preps.length) {
              const idx = progsForDate.findIndex(pp => pp.progType === 'location');
              if (idx >= 0) {
                progsForDate = progsForDate.map((pp, i) => i !== idx ? pp : { ...pp, items: [...pp.items, ...preps] });
              } else {
                progsForDate = [...progsForDate, { id: uid(), label: T.prog_location, progType: 'location', chemistId: prog.chemistId || '', assignedWorkers: [], items: preps }];
              }
            }
          }
          update({ programs: { ...state.programs, [date]: progsForDate } });
          addLog({ type: 'program_added', date, count: prog.items.length, by: state.role });
          toast(T.success_added);
          setShowAddProg(false);
        };
        // Each program type has its own dedicated entry form (focused fields, locked type)
        if (typeFilter === 'amazon') {
          return <AmazonProgramModal date={date} T={T} state={state} onClose={() => setShowAddProg(false)} onSave={saveProg} />;
        }
        return <AddProgramModal date={date} T={T} state={state}
          initialType={typeFilter !== 'all' ? typeFilter : 'daily'}
          lockType={typeFilter !== 'all'}
          onClose={() => setShowAddProg(false)} onSave={saveProg} />;
      })()}
      {confirmItem && (
        <ConfirmCodeModal
          item={allProgs[confirmItem.pi]?.items[confirmItem.ii]}
          action={confirmItem.action} T={T} dailyCode={todayCode}
          products={state.products} pastaLiquids={state.pastaLiquids || []}
          warehouses={state.warehouses || []} lang={state.lang}
          onClose={() => setConfirmItem(null)}
          onConfirm={() => handleConfirm(confirmItem)}
        />
      )}
      {viewingProduct && <ProductDetailsModal product={viewingProduct} state={state} T={T} onClose={() => setViewingProduct(null)} />}
    </>
  );
}

/* ---- Add Program Modal ---- */
function AddProgramModal({ date, T, state, initialType = 'daily', lockType = false, onClose, onSave }) {
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [progType, setProgType] = useState(initialType);
  const [chemistId, setChemistId] = useState('');
  const [prepType, setPrepType] = useState('carton');
  const [assignedWorkers, setAssignedWorkers] = useState([]);

  const emptyRow = () => ({ id: uid(), productId: '', pastaLiquidId: '', coverId: '', basketId: '', pastaBoxId: '', pastaLidId: '', target: '', notes: '', materials: [] });
  const [rows, setRows] = useState([emptyRow()]);

  const setRow = (id, field, value) => setRows(r => r.map(x => x.id === id ? { ...x, [field]: value } : x));

  // Per-row warehouse-piece materials (consumed automatically when the product is confirmed)
  const pieceWarehouses = (state.warehouses || []).filter(w => w.unit === 'piece');
  const addMat = (rowId) => setRows(r => r.map(x => x.id !== rowId ? x : { ...x, materials: [...(x.materials || []), { id: uid(), warehouseId: '', qty: '' }] }));
  const setMat = (rowId, mid, field, val) => setRows(r => r.map(x => x.id !== rowId ? x : { ...x, materials: (x.materials || []).map(m => m.id !== mid ? m : { ...m, [field]: val }) }));
  const delMat = (rowId, mid) => setRows(r => r.map(x => x.id !== rowId ? x : { ...x, materials: (x.materials || []).filter(m => m.id !== mid) }));

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
        // warehouse-piece materials tied to this product (auto-deducted on confirm)
        materials: (r.materials || []).filter(m => m.warehouseId && Number(m.qty) > 0).map(m => ({ warehouseId: m.warehouseId, qty: Number(m.qty) })),
      }));
    }
    if (!items.length) { toast('—', true); return; }
    // Liquid pasta items belong to Chimico (location), not Pasta (brazer)
    const savedType = isLiquidPrep ? 'location' : progType;
    onSave({ id: uid(), label: label || T[`prog_${savedType}`], progType: savedType, chemistId: chemistId || '', assignedWorkers, items });
  };

  return (
    <Modal onClose={onClose} maxWidth={900}>
      <h3>{T.add_program}{lockType ? ` · ${T[`prog_${progType}`]}` : ''} — {date}</h3>
      <div className="grid cols-2" style={{ marginBottom: 14 }}>
        <div className="field"><label>{T.prog_label}</label><input value={label} onChange={e => setLabel(e.target.value)} placeholder={`${T[`prog_${progType}`]}...`} /></div>
        {!lockType && (
          <div className="field"><label>{T.prog_type}</label>
            <select value={progType} onChange={e => { setProgType(e.target.value); setRows([emptyRow()]); setPrepType('carton'); }}>
              {PROG_TYPES.map(tp => <option key={tp} value={tp}>{T[`prog_${tp}`]}</option>)}
            </select>
          </div>
        )}
      </div>

      {isBrazer && (
        <div style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{state.lang === 'ar' ? 'نوع التحضير:' : 'Tipo preparazione:'}</span>
          <button className={prepType === 'carton' ? 'primary' : 'ghost'} style={{ fontSize: 12, padding: '4px 14px' }} onClick={() => { setPrepType('carton'); setChemistId(''); setRows([emptyRow()]); }}>📦 {state.lang === 'ar' ? 'كراتين' : 'Cartoni'}</button>
          <button className={prepType === 'liquid' ? 'primary' : 'ghost'} style={{ fontSize: 12, padding: '4px 14px' }} onClick={() => { setPrepType('liquid'); setAssignedWorkers([]); setRows([emptyRow()]); }}>🧪 {state.lang === 'ar' ? 'سائل' : 'Liquido'}</button>
        </div>
      )}

      {(() => {
        // Chemist shown for chimico-type work; hidden for pasta-cartons.
        // Workers shown for production work; hidden for pasta-liquid (chemist-only) and chimico.
        const showChemist = (progType === 'daily' || progType === 'location' || progType === 'macro' || progType === 'brazer') && !(isBrazer && prepType === 'carton');
        const showWorkers = (progType === 'daily' || progType === 'macro' || progType === 'brazer') && !(isBrazer && prepType === 'liquid');
        if (!showChemist && !showWorkers) return null;
        return (
        <div className={`grid ${showChemist && showWorkers ? 'cols-2' : 'cols-1'}`} style={{ marginBottom: 14 }}>
          {showChemist && (
          <div className="field">
            <label>🧪 {state.lang === 'ar' ? 'الكيميائي المسؤول' : 'Chimico responsabile'}</label>
            <select value={chemistId} onChange={e => setChemistId(e.target.value)}>
              <option value="">{state.lang === 'ar' ? 'بدون' : 'Nessuno'}</option>
              {(state.workers || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          )}
          {showWorkers && (
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
          )}
        </div>
        );
      })()}

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
              <Fragment key={row.id}>
              <tr>
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
              {/* Per-product warehouse-piece materials (auto-deducted with the product) */}
              {!isLiquidPrep && row.productId && pieceWarehouses.length > 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '0 3px 8px 18px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      <span className="smallmuted" style={{ fontSize: 11 }}>📦 {state.lang === 'ar' ? 'مواد مرتبطة:' : 'Materiali collegati:'}</span>
                      {(row.materials || []).map(m => (
                        <span key={m.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          <select className="input-sm" style={{ minWidth: 110 }} value={m.warehouseId} onChange={e => setMat(row.id, m.id, 'warehouseId', e.target.value)}>
                            <option value="">{state.lang === 'ar' ? 'المخزن' : 'Magazzino'}</option>
                            {pieceWarehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.stock || 0})</option>)}
                          </select>
                          <input className="input-sm" type="number" style={{ width: 64 }} placeholder={state.lang === 'ar' ? 'كمية' : 'q.tà'} value={m.qty} onChange={e => setMat(row.id, m.id, 'qty', e.target.value)} />
                          <button className="ghost" style={{ color: 'var(--red)', padding: '2px 6px' }} onClick={() => delMat(row.id, m.id)}>✕</button>
                        </span>
                      ))}
                      <button className="ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => addMat(row.id)}>+ {state.lang === 'ar' ? 'مادة' : 'materiale'}</button>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <button style={{ marginTop: 8 }} onClick={addRow}>+ {isLiquidPrep ? (state.lang === 'ar' ? 'سائل' : 'Liquido') : T.select_product}</button>

      {/* Shortage check: warn if stock can't cover the target */}
      {!isLiquidPrep && (() => {
        const warnings = rows
          .filter(r => r.productId && Number(r.target) > 0)
          .map(r => {
            const prod = state.products.find(p => p.id === r.productId);
            if (!prod) return null;
            const cap = productCapacity(prod, Number(r.target), state);
            if (!cap.shortages.length) return null;
            return { prod, target: Number(r.target), ...cap };
          })
          .filter(Boolean);
        if (!warnings.length) return null;
        return (
          <div style={{ marginTop: 12, border: '1px solid var(--red)', borderRadius: 8, background: 'rgba(220,38,38,0.06)', padding: '10px 14px' }}>
            <div style={{ fontWeight: 800, color: 'var(--red)', marginBottom: 6 }}>
              ⚠️ {state.lang === 'ar' ? 'المخزون مش هيكمّل الهدف' : 'Le scorte non bastano per l\'obiettivo'}
            </div>
            {warnings.map(w => (
              <div key={w.prod.id} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {w.prod.name}: {state.lang === 'ar' ? 'تقدر تعمل' : 'puoi fare'} <span style={{ color: 'var(--orange)' }}>{Number.isFinite(w.possible) ? w.possible : '∞'}</span> / {w.target} {T.bancale_equiv}
                </div>
                <ul style={{ margin: '4px 0 0', paddingInlineStart: 18, fontSize: 12 }}>
                  {w.shortages.map((sh, i) => (
                    <li key={i} style={{ color: 'var(--muted)' }}>
                      <strong>{sh.name}</strong> — {state.lang === 'ar' ? 'ناقص' : 'manca'} <span style={{ color: 'var(--red)', fontWeight: 700 }}>{Math.ceil(sh.missing).toLocaleString()} {sh.unit}</span>
                      <span className="smallmuted"> ({state.lang === 'ar' ? 'متاح' : 'disp.'} {Math.floor(sh.available).toLocaleString()} / {state.lang === 'ar' ? 'مطلوب' : 'serve'} {Math.ceil(sh.needed).toLocaleString()})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      })()}

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={handleSave}>{T.save}</button>
      </div>
    </Modal>
  );
}

/* ---- Amazon Program Modal (dedicated entry form) ---- */
function AmazonProgramModal({ date, T, state, onClose, onSave }) {
  const toast = useToast();
  const L = state.lang;
  const t = (ar, it, en) => (L === 'ar' ? ar : L === 'it' ? it : en);
  const [label, setLabel] = useState('');
  const [assignedWorkers, setAssignedWorkers] = useState([]);
  const products = state.products.filter(p => !p.isPasta);
  const emptyRow = () => ({ id: uid(), productId: '', cartonId: '', target: '', notes: '' });
  const [rows, setRows] = useState([emptyRow()]);

  const setRow = (id, f, v) => setRows(r => r.map(x => x.id === id ? { ...x, [f]: v } : x));
  const onProduct = (id, pid) => {
    const prod = products.find(p => p.id === pid);
    setRows(r => r.map(x => x.id !== id ? x : { ...x, productId: pid, cartonId: prod?.cartonId || x.cartonId }));
  };
  const addRow = () => setRows(r => [...r, emptyRow()]);
  const removeRow = (id) => { if (rows.length > 1) setRows(r => r.filter(x => x.id !== id)); };
  const toggleWorker = (wid) => setAssignedWorkers(aw => aw.includes(wid) ? aw.filter(x => x !== wid) : [...aw, wid]);

  const handleSave = () => {
    const items = rows.filter(r => r.productId && Number(r.target) > 0).map(r => ({
      productId: r.productId, cartonId: r.cartonId || null,
      target: Number(r.target), unit: 'pieces', notes: r.notes || '', status: 'pending',
    }));
    if (!items.length) { toast('—', true); return; }
    onSave({ id: uid(), label: label || T.prog_amazon, progType: 'amazon', chemistId: '', assignedWorkers, items });
  };

  return (
    <Modal onClose={onClose} maxWidth={820}>
      <h3>📦 {T.prog_amazon} — {date}</h3>
      <p className="smallmuted" style={{ marginTop: 0 }}>
        {t('طلبية أمازون: تُخصم من مخزن المنتجات الجاهزة (بدون تصنيع).', 'Ordine Amazon: scala dal magazzino prodotti finiti (nessuna produzione).', 'Amazon order: deducts from finished-goods stock (no manufacturing).')}
      </p>
      <div className="grid cols-2" style={{ marginBottom: 14 }}>
        <div className="field"><label>{T.prog_label}</label><input value={label} onChange={e => setLabel(e.target.value)} placeholder="Amazon..." /></div>
        <div className="field">
          <label>👷 {t('العمال', 'Operai assegnati', 'Workers')}</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(state.workers || []).map(w => (
              <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={assignedWorkers.includes(w.id)} onChange={() => toggleWorker(w.id)} />{w.name}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--muted)', fontSize: 11 }}>
              <th style={{ padding: '6px 4px', textAlign: 'start', fontWeight: 600 }}>{T.col_product}</th>
              <th style={{ padding: '6px 4px', textAlign: 'start', fontWeight: 600 }}>📦 {t('الكرتونة', 'Cartone', 'Carton')}</th>
              <th style={{ padding: '6px 4px', textAlign: 'start', fontWeight: 600 }}>{t('عدد القطع المطلوبة', 'Pezzi richiesti', 'Pieces needed')}</th>
              <th style={{ padding: '6px 4px', textAlign: 'start', fontWeight: 600 }}>{T.col_notes}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const avail = Number((state.lineaFinished || {})[row.productId] || 0);
              return (
                <tr key={row.id}>
                  <td style={{ padding: '4px 3px' }}>
                    <select className="input-sm" style={{ minWidth: 130 }} value={row.productId} onChange={e => onProduct(row.id, e.target.value)}>
                      <option value="">{T.select_product}</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {row.productId && <div className="smallmuted" style={{ fontSize: 10 }}>{t('متاح', 'Disp.', 'Avail')}: {avail.toFixed(1)} bancale</div>}
                  </td>
                  <td style={{ padding: '4px 3px' }}>
                    <select className="input-sm" value={row.cartonId} onChange={e => setRow(row.id, 'cartonId', e.target.value)}>
                      <option value="">{t('بدون', 'Nessuno', 'None')}</option>
                      {(state.cartonTypes || []).map(c => <option key={c.id} value={c.id}>{c.name}{c.size ? ` (${c.size})` : ''}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '4px 3px' }}><input className="input-sm" type="number" style={{ width: 90 }} placeholder={t('قطعة', 'pezzi', 'pcs')} value={row.target} onChange={e => setRow(row.id, 'target', e.target.value)} /></td>
                  <td style={{ padding: '4px 3px' }}><input className="input-sm" type="text" style={{ width: 100 }} placeholder={T.col_notes} value={row.notes} onChange={e => setRow(row.id, 'notes', e.target.value)} /></td>
                  <td style={{ padding: '4px 3px' }}><button className="ghost" style={{ color: 'var(--red)', padding: '4px 8px' }} onClick={() => removeRow(row.id)}>✕</button></td>
                </tr>
              );
            })}
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

/* ---- Confirm Code Modal (uses daily code) ---- */
function ConfirmCodeModal({ item, action, T, dailyCode, products, pastaLiquids, warehouses, lang, onClose, onConfirm }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  if (!item) return null;
  const isCustom = item.type === 'custom_material';
  const isLiq = item.prepType === 'liquid';
  const p = (isCustom || isLiq) ? null : (products || []).find(x => x.id === item.productId);
  const liq = isLiq ? (pastaLiquids || []).find(x => x.id === item.pastaLiquidId) : null;
  const displayName = isCustom
    ? (() => {
        const wh = (warehouses || []).find(w => w.id === item.warehouseId);
        return wh ? `📦 ${wh.name}` : '?';
      })()
    : isLiq ? (liq ? liq.name : '?') : (p ? p.name : '?');

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

/* ---- Per-worker daily board (admin) ---- */
function WorkersBoard({ state, update, date, allProgs, T }) {
  const L = state.lang;
  const t = (ar, it, en) => (L === 'ar' ? ar : L === 'it' ? it : en);
  const workers = state.workers || [];
  const dayNotes = (state.workerDayNotes || {})[date] || {};

  const setNote = (wid, val) => update({
    workerDayNotes: {
      ...(state.workerDayNotes || {}),
      [date]: { ...((state.workerDayNotes || {})[date] || {}), [wid]: val },
    },
  });

  if (workers.length === 0) {
    return <div className="empty">{t('لا يوجد عمال', 'Nessun operaio', 'No workers')}</div>;
  }

  return (
    <div className="grid cols-2" style={{ gap: 12 }}>
      {workers.map(w => {
        // Programs this worker is on today (assigned operaio or chemist)
        const asWorker = allProgs.filter(pr => (pr.assignedWorkers || []).includes(w.id));
        const asChemist = allProgs.filter(pr => pr.chemistId === w.id);
        const seen = new Set();
        const jobs = [...asChemist, ...asWorker].filter(pr => (seen.has(pr.id) ? false : seen.add(pr.id)));

        return (
          <div className="card" key={w.id} style={{ margin: 0 }}>
            <div className="row" style={{ gap: 12, alignItems: 'center', marginBottom: 10 }}>
              {w.photo
                ? <img src={w.photo} alt="" style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--brand)' }} />
                : <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--panel2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👤</div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{w.name}</div>
                <div className="smallmuted" style={{ fontSize: 12 }}>
                  {jobs.length ? `${jobs.length} ${t('مهمة اليوم', 'incarichi oggi', 'jobs today')}` : t('غير مُعيّن اليوم', 'Non assegnato oggi', 'Not assigned today')}
                </div>
              </div>
            </div>

            {jobs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {jobs.map(pr => {
                  const total = pr.items.length;
                  const done = pr.items.filter(i => i.status === 'done').length;
                  const isChemist = pr.chemistId === w.id;
                  return (
                    <div key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line)', flexWrap: 'wrap' }}>
                      <ProgBadge type={pr.progType} T={T} />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{pr.label || T[`prog_${pr.progType}`]}</span>
                      {isChemist && <span className="badge warn" style={{ fontSize: 9 }}>🧪 {t('كيميائي', 'Chimico', 'Chemist')}</span>}
                      <span className="smallmuted mono" style={{ fontSize: 11, marginInlineStart: 'auto' }}>{done}/{total} ✓</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="field" style={{ margin: 0 }}>
              <label style={{ fontSize: 11 }}>📝 {t('ملاحظة المدير لليوم', 'Nota del responsabile (oggi)', "Manager's note (today)")}</label>
              <textarea defaultValue={dayNotes[w.id] || ''} placeholder={t('طريقة عمله اليوم...', 'Come lavora oggi...', 'How he works today...')}
                style={{ minHeight: 54 }} onBlur={e => setNote(w.id, e.target.value)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
