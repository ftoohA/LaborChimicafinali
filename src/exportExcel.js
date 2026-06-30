import * as XLSX from 'xlsx';
import { productCapacity, netHours } from './helpers';

const today10 = () => new Date().toISOString().slice(0, 10);
const UNIT = { liter: 'L', ml: 'ml', kg: 'kg', g: 'g', piece: 'pz', carton: 'cart.' };
// last log time matching a predicate → formatted date
const lastLogDate = (log, matchFn) => {
  let t = '';
  (log || []).forEach(e => { if (matchFn(e) && e.time && e.time > t) t = e.time; });
  return t ? fmtDate(t) : '';
};
const download = (rows, sheet, file, cols) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '—': 'Nessun dato' }]);
  if (cols) ws['!cols'] = cols;
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, file);
};

/* ── Warehouses / stock sheet: every material, current stock, unit, last restock ── */
export function exportWarehousesExcel(s) {
  const log = s.log || [];
  const rows = [];
  (s.warehouses || []).forEach(w => rows.push({
    Categoria: w.unit === 'piece' ? 'Materiale (programma)' : 'Materiale (preparazione)',
    Articolo: w.name, Giacenza: w.stock || 0, Unità: UNIT[w.unit] || w.unit,
    'Ultimo rifornimento': lastLogDate(log, e => e.type === 'warehouse_stock_add' && e.name === w.name),
  }));
  (s.cartonTypes || []).forEach(c => rows.push({ Categoria: 'Cartoni', Articolo: c.name + (c.size ? ` (${c.size})` : ''), Giacenza: c.stock || 0, Unità: 'pz', 'Ultimo rifornimento': lastLogDate(log, e => e.id === c.id) }));
  (s.covers || []).forEach(c => rows.push({ Categoria: 'Coperchi', Articolo: c.name, Giacenza: c.stock || 0, Unità: 'pz', 'Ultimo rifornimento': lastLogDate(log, e => e.id === c.id) }));
  (s.baskets || []).forEach(b => rows.push({ Categoria: 'Taniche', Articolo: b.name, Giacenza: b.stock || 0, Unità: 'pz', 'Ultimo rifornimento': lastLogDate(log, e => e.id === b.id) }));
  (s.pastaLids || []).forEach(l => rows.push({ Categoria: 'Coperchi pasta', Articolo: l.name, Giacenza: l.stock || 0, Unità: 'pz', 'Ultimo rifornimento': lastLogDate(log, e => e.id === l.id || e.name === l.name) }));
  (s.pastaLiquids || []).forEach(l => rows.push({ Categoria: 'Liquidi pasta', Articolo: l.name, Giacenza: l.stock || 0, Unità: 'L', 'Ultimo rifornimento': lastLogDate(log, e => e.id === l.id || e.name === l.name) }));
  (s.products || []).filter(p => !p.isPasta).forEach(p => {
    const d = lastLogDate(log, e => e.type === 'restock' && e.product === p.code);
    rows.push({ Categoria: 'Etichette fronte', Articolo: p.name, Giacenza: p.stock?.ticketsFront || 0, Unità: 'pz', 'Ultimo rifornimento': d });
    rows.push({ Categoria: 'Etichette retro', Articolo: p.name, Giacenza: p.stock?.ticketsBack || 0, Unità: 'pz', 'Ultimo rifornimento': d });
  });
  rows.push({ Categoria: 'Materie pasta', Articolo: 'Spugne', Giacenza: s.pastaStock?.sponges || 0, Unità: 'pz', 'Ultimo rifornimento': lastLogDate(log, e => e.material === 'sponges') });
  rows.push({ Categoria: 'Materie pasta', Articolo: 'Coperchi spugna', Giacenza: s.pastaStock?.spongeLids || 0, Unità: 'pz', 'Ultimo rifornimento': lastLogDate(log, e => e.material === 'spongeLids') });
  download(rows, 'Magazzini', `Magazzini_${today10()}.xlsx`, [{ wch: 22 }, { wch: 34 }, { wch: 12 }, { wch: 8 }, { wch: 18 }]);
}

/* ── Products: full details (3 sheets: Linea, Pasta, Ricette) ── */
export function exportProductsExcel(s) {
  const covers      = s.covers      || [];
  const baskets     = s.baskets     || [];
  const cartonTypes = s.cartonTypes || [];
  const pastaLiquids = s.pastaLiquids || [];
  const pastaBoxes  = s.pastaBoxes  || [];
  const pastaLids   = s.pastaLids   || [];
  const warehouses  = s.warehouses  || [];

  const lineaRows = (s.products || []).filter(p => !p.isPasta).map(p => {
    const cover  = covers.find(c => c.id === p.coverId);
    const basket = baskets.find(b => b.id === p.basketId);
    const carton = cartonTypes.find(c => c.id === p.cartonId);
    return {
      Nome:               p.name,
      Azienda:            p.company   || '',
      Tipo:               p.type      || '',
      Codice:             p.code      || '',
      Barcode:            p.barcode   || '',
      Litri:              p.liter     || 0,
      'Etich. fronte/bancale': p.ticketsFront || 0,
      'Etich. retro/bancale':  p.ticketsBack  || 0,
      'Stock etich. fronte':   p.stock?.ticketsFront || 0,
      'Stock etich. retro':    p.stock?.ticketsBack  || 0,
      'Coperchi/bancale':  p.capsPer      || 0,
      'Taniche/bancale':   p.jerricansPer || 0,
      Coperchio:  cover  ? `${cover.name} · ${cover.color || '—'} · ${cover.size || '?'}`  : '—',
      Tanica:     basket ? `${basket.name} · ${basket.color || '—'} · ${basket.size || '?'}` : '—',
      Cartone:    carton ? carton.name + (carton.size ? ` (${carton.size})` : '') : '—',
      'Scarto %': p.liquidWaste || 0,
      'Passaggi prep.': p.prepSteps || '',
    };
  });

  const pastaRows = (s.products || []).filter(p => p.isPasta).map(p => {
    const liquid = pastaLiquids.find(l => l.id === p.pastaLiquidId);
    const box    = pastaBoxes.find(b => b.id === p.pastaBoxId);
    const lid    = pastaLids.find(l => l.id === p.pastaLidId);
    const carton = cartonTypes.find(c => c.id === p.cartonId);
    return {
      Nome:             p.name,
      Azienda:          p.company  || '',
      Tipo:             p.type     || '',
      Codice:           p.code     || '',
      Barcode:          p.barcode  || '',
      Litri:            p.liter    || 0,
      'Liquido pasta':  liquid ? liquid.name : '—',
      'Scatola pasta':  box    ? box.name    : '—',
      'Coperchio pasta': lid   ? lid.name    : '—',
      Cartone:          carton ? carton.name + (carton.size ? ` (${carton.size})` : '') : '—',
      'Con spugna':     p.hasSponge ? 'Sì' : 'No',
    };
  });

  const recipeRows = [];
  (s.products || []).forEach(p => {
    const recipe = (p.recipe || []).filter(r => r.name && Number(r.percent) > 0);
    if (!recipe.length) return;
    const litersPerBancale = p.isPasta
      ? 12 * (Number(p.liter) || 0)
      : (Number(p.jerricansPer) || 0) * (Number(p.liter) || 0);
    const wasteMul = 1 + (Number(p.liquidWaste) || 0) / 100;
    recipe.forEach(r => {
      const w = warehouses.find(x => x.id === r.warehouseId);
      const grossL = (Number(r.percent) / 100) * litersPerBancale * wasteMul;
      const amount = (w?.unit === 'ml' || w?.unit === 'g') ? grossL * 1000 : grossL;
      recipeRows.push({
        Prodotto:         p.name,
        Codice:           p.code || '',
        'Tipo prodotto':  p.isPasta ? 'Pasta' : 'Linea',
        Ingrediente:      r.name || '',
        Magazzino:        w ? w.name : '—',
        '%':              Number(r.percent) || 0,
        'Q.tà/bancale':   +amount.toFixed(3),
        Unità:            UNIT[w?.unit] || w?.unit || 'L',
      });
    });
  });

  const wb = XLSX.utils.book_new();
  const addSh = (rows, name, cols) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '—': 'Nessun dato' }]);
    if (cols) ws['!cols'] = cols;
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  addSh(lineaRows, 'Linea', [
    { wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 7 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 26 }, { wch: 26 }, { wch: 20 },
    { wch: 9 }, { wch: 60 },
  ]);
  addSh(pastaRows, 'Pasta', [
    { wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 7 },
    { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 10 },
  ]);
  addSh(recipeRows, 'Ricette', [
    { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 24 }, { wch: 7 }, { wch: 12 }, { wch: 8 },
  ]);
  XLSX.writeFile(wb, `Prodotti_${today10()}.xlsx`);
}

/* ── Finished products + orders out ── */
export function exportFinishedExcel(s) {
  const name = (id) => (s.products || []).find(p => p.id === id)?.name || id;
  const lastProd = (id) => lastLogDate(s.log, e => e.type === 'produce' && e.productId === id);
  const stock = [];
  const push = (obj, reparto, unit) => Object.entries(obj || {}).forEach(([id, q]) => { if ((q || 0) > 0) stock.push({ Reparto: reparto, Prodotto: name(id), Quantità: Number(q), Unità: unit, 'Ultima produzione': lastProd(id) }); });
  push(s.lineaFinished, 'Linea', 'bancale');
  push(s.pastaFinished, 'Pasta', 'cartoni');
  push(s.amazonFinished, 'Amazon', 'cartoni');
  const orders = [];
  (s.orders || []).forEach(o => (o.items || []).forEach(it => orders.push({
    Data: o.ts ? fmtDateTime(new Date(o.ts).toISOString()) : '', Ordine: o.note || '',
    Reparto: it.source, Prodotto: it.name, Quantità: it.qty, Unità: it.unit, Operatore: o.by || '',
  })));
  const wb = XLSX.utils.book_new();
  const a = XLSX.utils.json_to_sheet(stock.length ? stock : [{ '—': 'Nessuno stock' }]);
  a['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, a, 'Giacenza finiti');
  const b = XLSX.utils.json_to_sheet(orders.length ? orders : [{ '—': 'Nessun ordine' }]);
  b['!cols'] = [{ wch: 17 }, { wch: 16 }, { wch: 10 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, b, 'Ordini usciti');
  XLSX.writeFile(wb, `Prodotti_finiti_${today10()}.xlsx`);
}

/* ── Shortages by category ── */
export function exportShortagesExcel(s, target) {
  const byName = {};
  (s.products || []).forEach(p => {
    productCapacity(p, Number(target) || 0, s).shortages.forEach(sh => {
      const k = sh.type + '|' + sh.name;
      if (!byName[k] || sh.missing > byName[k].Manca) byName[k] = { Categoria: sh.type, Articolo: sh.name, Disponibile: Math.floor(sh.available), Serve: Math.ceil(sh.needed), Manca: Math.ceil(sh.missing), Unità: sh.unit };
    });
  });
  const rows = Object.values(byName).sort((a, b) => (a.Categoria < b.Categoria ? -1 : 1) || b.Manca - a.Manca);
  download(rows, 'Carenze', `Carenze_${today10()}.xlsx`, [{ wch: 14 }, { wch: 36 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }]);
}

/* ── Attendance: every record, all days (for review) ── */
export function exportAttendanceExcel(s) {
  const wname = (id) => (s.workers || []).find(w => w.id === id)?.name || id;
  const rows = (s.attendance || [])
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map(r => ({
      Data: r.date, Operaio: wname(r.workerId),
      Entrata: fmtTime(r.clockIn), Uscita: fmtTime(r.clockOut),
      'Pausa (h)': Number(r.lunch) || 0,
      'Ore lavorate': netHours(r) != null ? Number(netHours(r).toFixed(2)) : '',
      Manuale: r.manual ? 'Sì' : '',
    }));
  download(rows, 'Presenze', `Presenze_${today10()}.xlsx`, [{ wch: 12 }, { wch: 22 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 12 }, { wch: 9 }]);
}

// Italian-first labels for log entry types
const TYPE_LABEL = {
  produce: 'Produzione (bancale)',
  undo: 'Annullo produzione',
  liquid_prep: 'Preparazione liquido',
  liquid_undo: 'Annullo liquido',
  carry_over: 'Riporto giorno dopo',
  program_added: 'Programma aggiunto',
  delete_program: 'Programma eliminato',
  product_saved: 'Prodotto salvato',
  delete_product: 'Prodotto eliminato',
  settings_updated: 'Impostazioni aggiornate',
  restock: 'Rifornimento',
  cover_stock_add: 'Entrata stock coperchio',
  basket_stock_add: 'Entrata stock tanica',
  carton_stock_add: 'Entrata stock cartone',
  carton_added: 'Cartone aggiunto',
  finished_stock_add: 'Entrata produzione finita',
  pasta_box_stock_add: 'Entrata scatola pasta',
  pasta_lid_stock_add: 'Entrata coperchio pasta',
  pasta_liquid_stock_add: 'Entrata liquido pasta',
  pasta_stock_add: 'Entrata materie pasta',
  clock_in: 'Entrata operaio',
  clock_out: 'Uscita operaio',
};

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '');
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('it-IT') : '');
const fmtDateTime = (iso) => (iso ? `${fmtDate(iso)} ${fmtTime(iso)}` : '');
const hoursBetween = (a, b) => (a && b ? Math.max(0, (new Date(b) - new Date(a)) / 3600000) : null);

// which log types are "stock-in" (delivery) events, mapped to a category label
const DELIVERY_TYPES = {
  carton_stock_add: 'Cartoni',
  cover_stock_add: 'Coperchi',
  basket_stock_add: 'Taniche',
  pasta_box_stock_add: 'Scatole pasta',
  pasta_lid_stock_add: 'Coperchi pasta',
  pasta_liquid_stock_add: 'Liquidi pasta',
  pasta_stock_add: 'Materie pasta',
  finished_stock_add: 'Prodotti finiti',
  restock: 'Rifornimento',
};

export function exportDayExcel(ctx) {
  const { log = [], products = [], workers = [], attendance = [], cartonTypes = [],
    covers = [], baskets = [], pastaBoxes = [], pastaLids = [], pastaLiquids = [],
    lineaFinished = {}, pastaFinished = {}, amazonFinished = {}, pastaStock = {}, date } = ctx;

  const nameById = (id) => {
    if (!id) return '';
    const all = [...products, ...cartonTypes, ...covers, ...baskets, ...pastaBoxes, ...pastaLids, ...pastaLiquids];
    const f = all.find(x => x.id === id);
    return f ? (f.name || f.code || id) : id;
  };
  const workerName = (id) => (workers.find(w => w.id === id)?.name || id || '');

  // resolve the warehouse item name for a delivery log entry
  const deliveryItemName = (e) => {
    if (e.productId) return nameById(e.productId);
    if (e.id) return nameById(e.id);
    if (e.material === 'sponges') return 'Spugne';
    if (e.material === 'spongeLids') return 'Coperchi spugna';
    if (e.name) return e.name;
    return '';
  };

  const details = (e) => {
    const parts = [];
    if (e.product) parts.push(`Prodotto: ${e.product}`);
    if (e.liquid) parts.push(`Liquido: ${e.liquid}`);
    if (e.name) parts.push(e.name);
    if (e.id && !e.product) parts.push(nameById(e.id));
    if (e.productId) parts.push(nameById(e.productId));
    if (e.workerId) parts.push(`Operaio: ${workerName(e.workerId)}`);
    if (e.target != null) parts.push(`Obiettivo: ${e.target}`);
    if (e.qty != null) parts.push(`Q.tà: ${e.qty}`);
    if (e.liters != null) parts.push(`Litri: ${e.liters}`);
    if (e.count != null) parts.push(`N.: ${e.count}`);
    if (e.reason) parts.push(`Motivo: ${e.reason}`);
    if (e.manual) parts.push('(manuale)');
    return parts.join(' · ');
  };

  // ── 1. Movements (selected day) ──
  const dayLog = log.filter(e => (e.time || '').slice(0, 10) === date);
  const movRows = dayLog.map(e => ({
    Ora: fmtTime(e.time),
    Tipo: TYPE_LABEL[e.type] || e.type,
    Dettagli: details(e),
    Operatore: e.by || '',
  }));
  if (movRows.length === 0) movRows.push({ Ora: '', Tipo: 'Nessun movimento', Dettagli: '', Operatore: '' });

  // ── 2. Warehouse stock (giacenze) with LAST DELIVERY DATE ──
  const lastDeliveryFor = (matchFn) => {
    let last = '';
    log.forEach(e => {
      if (DELIVERY_TYPES[e.type] && matchFn(e) && e.time && e.time > last) last = e.time;
    });
    return last;
  };
  const stockRows = [];
  const pushStock = (cat, name, stock, unit, matchFn) => {
    stockRows.push({ Magazzino: cat, Articolo: name, Giacenza: stock, Unità: unit, 'Ultima consegna': fmtDate(lastDeliveryFor(matchFn)) });
  };
  cartonTypes.forEach(c => pushStock('Cartoni', `${c.name}${c.size ? ` (${c.size})` : ''}`, c.stock || 0, 'pz', e => e.id === c.id));
  covers.forEach(c => pushStock('Coperchi', c.name, c.stock || 0, 'pz', e => e.id === c.id));
  baskets.forEach(b => pushStock('Taniche', b.name, b.stock || 0, 'pz', e => e.id === b.id));
  pastaBoxes.forEach(b => pushStock('Scatole pasta', b.name, b.stock || 0, 'pz', e => e.id === b.id || e.name === b.name));
  pastaLids.forEach(l => pushStock('Coperchi pasta', l.name, l.stock || 0, 'pz', e => e.id === l.id || e.name === l.name));
  pastaLiquids.forEach(l => pushStock('Liquidi pasta', l.name, l.stock || 0, 'L', e => e.id === l.id || e.name === l.name));
  pushStock('Materie pasta', 'Spugne', pastaStock.sponges || 0, 'pz', e => e.material === 'sponges');
  pushStock('Materie pasta', 'Coperchi spugna', pastaStock.spongeLids || 0, 'pz', e => e.material === 'spongeLids');
  Object.entries(lineaFinished).forEach(([pid, q]) => {
    if ((q || 0) !== 0) pushStock('Linea finiti', nameById(pid), Number(q) || 0, 'bancale', e => e.productId === pid);
  });
  Object.entries(pastaFinished).forEach(([pid, q]) => {
    if ((q || 0) !== 0) pushStock('Pasta finita', nameById(pid), Number(q) || 0, 'cartoni', e => e.productId === pid);
  });
  Object.entries(amazonFinished).forEach(([pid, q]) => {
    if ((q || 0) !== 0) pushStock('Amazon', nameById(pid), Number(q) || 0, 'cartoni', e => e.productId === pid);
  });
  if (stockRows.length === 0) stockRows.push({ Magazzino: 'Nessun articolo', Articolo: '', Giacenza: '', Unità: '', 'Ultima consegna': '' });

  // ── 3. Deliveries (all stock-in events with date) ──
  const delRows = log.filter(e => DELIVERY_TYPES[e.type]).map(e => ({
    Data: fmtDateTime(e.time),
    Magazzino: DELIVERY_TYPES[e.type],
    Articolo: deliveryItemName(e),
    Quantità: e.qty != null ? e.qty : (e.adds ? JSON.stringify(e.adds) : ''),
    Motivo: e.reason || '',
    Operatore: e.by || '',
  }));
  delRows.sort((a, b) => (a.Data < b.Data ? 1 : -1));
  if (delRows.length === 0) delRows.push({ Data: '', Magazzino: 'Nessuna consegna', Articolo: '', Quantità: '', Motivo: '', Operatore: '' });

  // ── 4. Production (all produce events with production date) ──
  const prodRows = log.filter(e => e.type === 'produce' || e.type === 'liquid_prep').map(e => ({
    'Data produzione': e.date || fmtDate(e.time),
    Ora: fmtTime(e.time),
    Tipo: e.type === 'liquid_prep' ? 'Liquido' : 'Bancale',
    Prodotto: e.product || e.liquid || '',
    Quantità: e.target != null ? e.target : (e.liters != null ? e.liters : ''),
    Operatore: e.by || '',
  }));
  prodRows.sort((a, b) => (a['Data produzione'] < b['Data produzione'] ? 1 : -1));
  if (prodRows.length === 0) prodRows.push({ 'Data produzione': '', Ora: '', Tipo: 'Nessuna produzione', Prodotto: '', Quantità: '', Operatore: '' });

  // ── 5. Attendance (selected day) ──
  const dayAtt = attendance.filter(a => a.date === date);
  const attRows = dayAtt.map(a => {
    const h = hoursBetween(a.clockIn, a.clockOut);
    return {
      Operaio: workerName(a.workerId),
      Entrata: fmtTime(a.clockIn),
      Uscita: fmtTime(a.clockOut),
      Ore: h != null ? Number(h.toFixed(2)) : '',
      Manuale: a.manual ? 'Sì' : '',
    };
  });
  if (attRows.length === 0) attRows.push({ Operaio: 'Nessuna presenza', Entrata: '', Uscita: '', Ore: '', Manuale: '' });

  const wb = XLSX.utils.book_new();
  const addSheet = (rows, name, cols) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    if (cols) ws['!cols'] = cols;
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  addSheet(movRows, 'Movimenti', [{ wch: 8 }, { wch: 26 }, { wch: 50 }, { wch: 12 }]);
  addSheet(stockRows, 'Giacenze', [{ wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 14 }]);
  addSheet(delRows, 'Consegne', [{ wch: 17 }, { wch: 16 }, { wch: 26 }, { wch: 10 }, { wch: 18 }, { wch: 12 }]);
  addSheet(prodRows, 'Produzione', [{ wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 26 }, { wch: 10 }, { wch: 12 }]);
  addSheet(attRows, 'Presenze', [{ wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }]);

  XLSX.writeFile(wb, `Laborchimica_${date}.xlsx`);
}
