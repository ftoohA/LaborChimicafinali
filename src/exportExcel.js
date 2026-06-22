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
const hoursBetween = (a, b) => (a && b ? Math.max(0, (new Date(b) - new Date(a)) / 3600000) : null);

export function exportDayExcel(ctx) {
  const { log = [], products = [], workers = [], attendance = [], cartonTypes = [],
    covers = [], baskets = [], pastaBoxes = [], pastaLids = [], pastaLiquids = [], date } = ctx;

  const nameById = (id) => {
    if (!id) return '';
    const all = [...products, ...cartonTypes, ...covers, ...baskets, ...pastaBoxes, ...pastaLids, ...pastaLiquids];
    const f = all.find(x => x.id === id);
    return f ? (f.name || f.code || id) : id;
  };
  const workerName = (id) => (workers.find(w => w.id === id)?.name || id || '');

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

  // ── Movements sheet ──
  const dayLog = log.filter(e => (e.time || '').slice(0, 10) === date);
  const movRows = dayLog.map(e => ({
    Ora: fmtTime(e.time),
    Tipo: TYPE_LABEL[e.type] || e.type,
    Dettagli: details(e),
    Operatore: e.by || '',
  }));
  if (movRows.length === 0) movRows.push({ Ora: '', Tipo: 'Nessun movimento', Dettagli: '', Operatore: '' });

  // ── Attendance sheet ──
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
  const wsMov = XLSX.utils.json_to_sheet(movRows);
  wsMov['!cols'] = [{ wch: 8 }, { wch: 26 }, { wch: 50 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsMov, 'Movimenti');
  const wsAtt = XLSX.utils.json_to_sheet(attRows);
  wsAtt['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, wsAtt, 'Presenze');

  XLSX.writeFile(wb, `Laborchimica_${date}.xlsx`);
}
