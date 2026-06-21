import { useStore } from '../store';
import { I18N } from '../i18n';
import { todayStr } from '../helpers';

export default function Stats() {
  const { state } = useStore();
  const T = I18N[state.lang];
  const today = todayStr();
  const month = today.slice(0, 7);

  function aggregate(predicate) {
    const byCompany = {};
    let total = 0;
    Object.entries(state.programs).forEach(([d, progs]) => {
      if (!predicate(d)) return;
      progs.forEach(pr => pr.items.forEach(it => {
        if (it.status !== 'done') return;
        const p = state.products.find(x => x.id === it.productId);
        if (!p) return;
        byCompany[p.company] = (byCompany[p.company] || 0) + Number(it.target);
        total += Number(it.target);
      }));
    });
    return { byCompany, total };
  }

  const dayAgg = aggregate(d => d === today);
  const monthAgg = aggregate(d => d.startsWith(month));

  const topLeast = (byCompany) => {
    const arr = Object.entries(byCompany).sort((a, b) => b[1] - a[1]);
    return { top: arr[0], least: arr[arr.length - 1] };
  };
  const monthTL = topLeast(monthAgg.byCompany);

  return (
    <div className="grid cols-2">
      <div className="card">
        <h3>{T.today}</h3>
        <div className="stat" style={{ marginBottom: 10 }}>
          <div className="num">{dayAgg.total}</div>
          <div className="lbl">{T.total_produced_bancale}</div>
        </div>
        <CompanyBars byCompany={dayAgg.byCompany} T={T} />
      </div>
      <div className="card">
        <h3>{T.this_month_label} ({month})</h3>
        <div className="stat" style={{ marginBottom: 10 }}>
          <div className="num">{monthAgg.total}</div>
          <div className="lbl">{T.total_produced_bancale}</div>
        </div>
        {monthTL.top && (
          <div className="smallmuted">{T.top_company}: <strong>{monthTL.top[0]}</strong> ({monthTL.top[1]})</div>
        )}
        {monthTL.least && monthTL.least !== monthTL.top && (
          <div className="smallmuted">{T.least_company}: <strong>{monthTL.least[0]}</strong> ({monthTL.least[1]})</div>
        )}
        <CompanyBars byCompany={monthAgg.byCompany} T={T} />
      </div>
    </div>
  );
}

function CompanyBars({ byCompany, T }) {
  const entries = Object.entries(byCompany).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <div className="empty">{T.no_data}</div>;
  const max = entries[0][1];
  return (
    <div style={{ marginTop: 10 }}>
      {entries.map(([c, v]) => (
        <div key={c} style={{ marginBottom: 8 }}>
          <div className="flex-between smallmuted">
            <span>{c}</span>
            <span className="mono">{v}</span>
          </div>
          <div className="bar-bg">
            <div className="bar-fill" style={{ width: `${(v / max) * 100}%`, background: 'var(--yellow)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
