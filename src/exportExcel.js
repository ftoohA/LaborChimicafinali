import * as XLSX from 'xlsx';

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
    finishedStock = {}, pastaStock = {}, date } = ctx;

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
  Object.entries(finishedStock).forEach(([pid, q]) => {
    if ((q || 0) !== 0) pushStock('Prodotti finiti', nameById(pid), Number(q) || 0, 'bancale', e => e.productId === pid);
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
