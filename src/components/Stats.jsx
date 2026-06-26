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

  // Daily production trend (last 30 days)
  const dayTrend = (() => {
    const out = [];
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      const key = dt.toISOString().slice(0, 10);
      let v = 0;
      (state.programs[key] || []).forEach(pr => pr.items.forEach(it => {
        if (it.status === 'done' && it.productId) v += Number(it.target) || 0;
      }));
      out.push({ key, label: key.slice(5), value: v });
    }
    return out;
  })();

  // This-month aggregations by product and by program type
  const TYPE_LABEL = { daily: 'Linea', location: 'Chimico', brazer: 'Pasta', amazon: 'Amazon', macro: 'Marco' };
  const byProduct = {}, byType = {};
  Object.entries(state.programs).forEach(([d, progs]) => {
    if (!d.startsWith(month)) return;
    progs.forEach(pr => pr.items.forEach(it => {
      if (it.status !== 'done') return;
      const t = Number(it.target) || 0;
      byType[TYPE_LABEL[pr.progType] || pr.progType] = (byType[TYPE_LABEL[pr.progType] || pr.progType] || 0) + t;
      const p = state.products.find(x => x.id === it.productId);
      if (p) byProduct[p.name] = (byProduct[p.name] || 0) + t;
    }));
  });

  const topLeast = (byCompany) => {
    const arr = Object.entries(byCompany).sort((a, b) => b[1] - a[1]);
    return { top: arr[0], least: arr[arr.length - 1] };
  };
  const monthTL = topLeast(monthAgg.byCompany);

  return (
    <>
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

      <div className="card">
        <h3>📈 {state.lang === 'ar' ? 'الإنتاج اليومي (آخر 30 يوم)' : 'Produzione giornaliera (30 giorni)'}</h3>
        <DayTrend data={dayTrend} />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>🏭 {state.lang === 'ar' ? 'حسب نوع البرنامج (الشهر)' : 'Per tipo programma (mese)'}</h3>
          <CompanyBars byCompany={byType} T={T} />
        </div>
        <div className="card">
          <h3>📦 {state.lang === 'ar' ? 'أكثر المنتجات إنتاجاً (الشهر)' : 'Prodotti più prodotti (mese)'}</h3>
          <CompanyBars byCompany={byProduct} T={T} limit={8} />
        </div>
      </div>
    </>
  );
}

function DayTrend({ data }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const W = 720, H = 170, pad = 22;
  const bw = (W - pad * 2) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--line)" />
      {data.map((d, i) => {
        const h = (d.value / max) * (H - pad * 2);
        const x = pad + i * bw;
        return (
          <g key={i}>
            <rect x={x + 1} y={H - pad - h} width={Math.max(1, bw - 2)} height={h} fill="var(--yellow)" rx="2">
              <title>{d.key}: {d.value}</title>
            </rect>
            {d.value > 0 && h > 14 && <text x={x + bw / 2} y={H - pad - h - 2} fontSize="7" fill="var(--muted)" textAnchor="middle">{d.value}</text>}
            {i % 5 === 0 && <text x={x + bw / 2} y={H - pad + 10} fontSize="7" fill="var(--muted)" textAnchor="middle">{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function CompanyBars({ byCompany, T, limit }) {
  let entries = Object.entries(byCompany).sort((a, b) => b[1] - a[1]);
  if (limit) entries = entries.slice(0, limit);
  if (entries.length === 0) return <div className="empty">{T.no_data}</div>;
  const max = entries[0][1] || 1;
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
