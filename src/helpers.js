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
