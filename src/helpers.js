export const todayStr = () => new Date().toISOString().slice(0, 10);

// covers/baskets: arrays from state for global stock lookup
export function bancaleEquivalent(p, stock, covers = [], baskets = []) {
  const f = p.ticketsFront > 0 ? stock.ticketsFront / p.ticketsFront : Infinity;
  const b = p.ticketsBack > 0 ? stock.ticketsBack / p.ticketsBack : Infinity;

  let c = Infinity;
  if (p.coverId) {
    const cv = covers.find(x => x.id === p.coverId);
    c = cv && p.capsPer > 0 ? (cv.stock || 0) / p.capsPer : Infinity;
  } else if (p.capsPer > 0) {
    c = stock.caps / p.capsPer;
  }

  let j = Infinity;
  if (p.basketId) {
    const bk = baskets.find(x => x.id === p.basketId);
    j = bk && p.jerricansPer > 0 ? (bk.stock || 0) / p.jerricansPer : Infinity;
  } else if (p.jerricansPer > 0) {
    j = stock.jerricans / p.jerricansPer;
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
