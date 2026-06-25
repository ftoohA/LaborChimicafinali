export const todayStr = () => new Date().toISOString().slice(0, 10);

// covers/baskets: arrays from state for global stock lookup
export function bancaleEquivalent(p, stock, covers = [], baskets = [], pastaStock = { sponges: 0, spongeLids: 0 }, pastaLiquids = [], settings = {}, pastaBoxes = [], pastaLids = []) {
  const s = settings || {};
  if (p.isPasta) {
    const wasteBox = s.wastePastaBox ?? 2;
    const wasteLid = s.wastePastaLid ?? 2;
    const wasteSponge = s.wastePastaSponge ?? 2;
    const wasteSpongeLid = s.wastePastaSpongeLid ?? 2;
    const wasteLiquid = s.wastePastaLiquid ?? 2;

    const boxObj = (pastaBoxes || []).find(x => x.id === p.pastaBoxId);
    const boxStock = boxObj ? (boxObj.stock || 0) : 0;
    const boxLimit = boxStock / (12 * (1 + wasteBox / 100));

    const lidObj = (pastaLids || []).find(x => x.id === p.pastaLidId);
    const lidStock = lidObj ? (lidObj.stock || 0) : 0;
    const lidLimit = lidStock / (12 * (1 + wasteLid / 100));

    let limitInCartons = Math.min(boxLimit, lidLimit);

    if (p.hasSponge) {
      const spongeLimit = (pastaStock?.sponges || 0) / (12 * (1 + wasteSponge / 100));
      const spongeLidLimit = (pastaStock?.spongeLids || 0) / (12 * (1 + wasteSpongeLid / 100));
      limitInCartons = Math.min(limitInCartons, spongeLimit, spongeLidLimit);
    }

    const liquid = (pastaLiquids || []).find(x => x.id === p.pastaLiquidId);
    if (liquid) {
      const liquidStock = liquid.stock || 0;
      const liquidNeededPerCarton = 12 * (p.liter || 0.5) * (1 + wasteLiquid / 100);
      const maxCartonsFromLiquid = liquidNeededPerCarton > 0 ? (liquidStock / liquidNeededPerCarton) : 0;
      limitInCartons = Math.min(limitInCartons, maxCartonsFromLiquid);
    } else {
      // If no liquid is assigned, carton limit is 0
      limitInCartons = 0;
    }
    return limitInCartons;
  }

  const wasteTicket = s.wasteTicket ?? 4;
  const wasteCap = s.wasteCap ?? 2;
  const wasteJerrican = s.wasteJerrican ?? 1.8;

  const f = p.ticketsFront > 0 ? stock.ticketsFront / (p.ticketsFront * (1 + wasteTicket / 100)) : Infinity;
  const b = p.ticketsBack > 0 ? stock.ticketsBack / (p.ticketsBack * (1 + wasteTicket / 100)) : Infinity;

  let c = Infinity;
  if (p.coverId) {
    const cv = covers.find(x => x.id === p.coverId);
    c = cv && p.capsPer > 0 ? (cv.stock || 0) / (p.capsPer * (1 + wasteCap / 100)) : Infinity;
  } else if (p.capsPer > 0) {
    c = stock.caps / (p.capsPer * (1 + wasteCap / 100));
  }

  let j = Infinity;
  if (p.basketId) {
    const bk = baskets.find(x => x.id === p.basketId);
    j = bk && p.jerricansPer > 0 ? (bk.stock || 0) / (p.jerricansPer * (1 + wasteJerrican / 100)) : Infinity;
  } else if (p.jerricansPer > 0) {
    j = stock.jerricans / (p.jerricansPer * (1 + wasteJerrican / 100));
  }

  return Math.min(f, b, c, j);
}

export function stockStatus(be, threshold) {
  if (be < threshold) return 'bad';
  if (be < threshold * 1.5) return 'warn';
  return 'ok';
}

export function updateProgramItem(programs, date, pi, ii, changes) {
  return {
    ...programs,
    [date]: programs[date].map((pr, pIdx) =>
      pIdx !== pi ? pr : {
        ...pr,
        items: pr.items.map((item, iIdx) => iIdx !== ii ? item : { ...item, ...changes }),
      }
    ),
  };
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* Per-bancale material consumption of a product + how many bancale are feasible
   with current stock, and what is short for a given target.
   Returns { possible, consumers:[{type,name,perBancale,available,unit}], shortages:[…+needed,missing] } */
export function productCapacity(p, target, state) {
  const s = state.settings || {};
  const wasteTicket = s.wasteTicket ?? 4, wasteCap = s.wasteCap ?? 2, wasteJer = s.wasteJerrican ?? 1.8;
  const cons = [];
  const add = (type, name, perBancale, available, unit) => { if (perBancale > 0) cons.push({ type, name, perBancale, available: available || 0, unit }); };

  // Liquid/material composition (shared by Linea & pasta)
  const litersPerBancale = p.isPasta ? 12 * (Number(p.liter) || 0) : (Number(p.jerricansPer) || 0) * (Number(p.liter) || 0);
  const wasteMul = 1 + (Number(p.liquidWaste) || 0) / 100;
  (p.recipe || []).filter(r => r.warehouseId && Number(r.percent) > 0).forEach(r => {
    const w = (state.warehouses || []).find(x => x.id === r.warehouseId);
    const grossL = (Number(r.percent) / 100) * litersPerBancale * wasteMul;
    const perB = (w?.unit === 'ml' || w?.unit === 'g') ? grossL * 1000 : grossL;
    add('liquidi', w ? w.name : r.name, perB, w?.stock || 0, w?.unit || 'L');
  });

  if (!p.isPasta) {
    add('etichette', `${p.name} · etichetta fronte`, (Number(p.ticketsFront) || 0) * (1 + wasteTicket / 100), p.stock?.ticketsFront, 'pz');
    add('etichette', `${p.name} · etichetta retro`, (Number(p.ticketsBack) || 0) * (1 + wasteTicket / 100), p.stock?.ticketsBack, 'pz');
    if (Number(p.capsPer) > 0) {
      if (p.coverId) { const c = (state.covers || []).find(x => x.id === p.coverId); add('coperchi', c ? c.name : 'Coperchio', p.capsPer * (1 + wasteCap / 100), c?.stock, 'pz'); }
      else add('coperchi', `${p.name} · tappi`, p.capsPer * (1 + wasteCap / 100), p.stock?.caps, 'pz');
    }
    if (Number(p.jerricansPer) > 0) {
      if (p.basketId) { const b = (state.baskets || []).find(x => x.id === p.basketId); add('taniche', b ? b.name : 'Tanica', p.jerricansPer * (1 + wasteJer / 100), b?.stock, 'pz'); }
      else add('taniche', `${p.name} · taniche`, p.jerricansPer * (1 + wasteJer / 100), p.stock?.jerricans, 'pz');
    }
    if (p.hasCarton && p.cartonId) { const c = (state.cartonTypes || []).find(x => x.id === p.cartonId); add('cartoni', c ? c.name : 'Cartone', (Number(p.capsPer) || 0) * (1 + ((c?.waste || 0) / 100)), c?.stock, 'pz'); }
  } else {
    const cartons = 12;
    if (p.pastaBoxId) { const b = (state.pastaBoxes || []).find(x => x.id === p.pastaBoxId); add('pasta', b ? b.name : 'Scatola pasta', cartons * (1 + (s.wastePastaBox ?? 2) / 100), b?.stock, 'pz'); }
    if (p.pastaLidId) { const l = (state.pastaLids || []).find(x => x.id === p.pastaLidId); add('pasta', l ? l.name : 'Coperchio pasta', cartons * (1 + (s.wastePastaLid ?? 2) / 100), l?.stock, 'pz'); }
    if (p.hasSponge) {
      add('pasta', `${p.name} · spugne`, cartons * (1 + (s.wastePastaSponge ?? 2) / 100), (state.pastaStock?.sponges) || 0, 'pz');
      add('pasta', `${p.name} · coperchi spugna`, cartons * (1 + (s.wastePastaSpongeLid ?? 2) / 100), (state.pastaStock?.spongeLids) || 0, 'pz');
    }
  }

  let possible = Infinity;
  cons.forEach(c => { possible = Math.min(possible, c.available / c.perBancale); });
  possible = possible === Infinity ? Infinity : Math.floor(possible + 1e-9);

  const shortages = cons
    .filter(c => c.available < target * c.perBancale - 1e-9)
    .map(c => ({ ...c, needed: target * c.perBancale, missing: target * c.perBancale - c.available }));

  return { possible, consumers: cons, shortages };
}

/* Drop clock-in/out selfies once they pass retention: a photo dated in month M is
   kept through day `cleanupDay` of month M+1, then stripped (record/times kept).
   Returns { changed, attendance }. */
export function purgeOldAttendancePhotos(attendance, cleanupDay = 10) {
  const now = new Date();
  const day = Math.max(1, Math.min(28, Number(cleanupDay) || 10));
  let changed = false;
  const out = (attendance || []).map(r => {
    if (!r || (!r.clockInPhoto && !r.clockOutPhoto) || !r.date) return r;
    const [y, m] = r.date.split('-').map(Number); // m is 1-based; new Date(y,m,…) = next month
    if (!y || !m) return r;
    const purgeDate = new Date(y, m, day, 0, 0, 0, 0);
    if (now >= purgeDate) {
      changed = true;
      const { clockInPhoto, clockOutPhoto, ...rest } = r;
      return rest;
    }
    return r;
  });
  return { changed, attendance: changed ? out : (attendance || []) };
}

// Worked hours for a record = rounded session minus lunch hours (never below 0)
export function netHours(rec) {
  if (!rec) return null;
  const h = roundedHours(rec.clockIn, rec.clockOut);
  if (h == null) return null;
  return Math.max(0, h - (Number(rec.lunch) || 0));
}

// Persistent per-device identifier (stored in this browser's localStorage)
export function getDeviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('deviceId', id);
  }
  return id;
}

// Round a session to the nearest 0.5h using factory rules:
// ≤20 min → 0, 21-44 min → 0.5h, ≥45 min → 1h per block
export function roundedHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null;
  const ms = new Date(clockOut) - new Date(clockIn);
  if (ms <= 0) return 0;
  const totalMins = ms / 60000;
  const full = Math.floor(totalMins / 60);
  const rem = totalMins % 60;
  return full + (rem > 45 ? 1 : rem > 20 ? 0.5 : 0);
}
