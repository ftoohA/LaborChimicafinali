import { useStore } from '../store';
import { I18N } from '../i18n';
import ProgBadge from './ProgBadge';

export default function History() {
  const { state } = useStore();
  const T = I18N[state.lang];
  const dates = Object.keys(state.programs).sort().reverse();

  return (
    <>
      <div className="card">
        <h3>{T.history}</h3>
        {dates.length === 0 ? (
          <div className="empty">{T.no_program_today}</div>
        ) : dates.map(d => {
          const progs = state.programs[d];
          let target = 0, done = 0;
          progs.forEach(pr => pr.items.forEach(i => {
            target += Number(i.target);
            if (i.status === 'done') done += Number(i.target);
          }));
          return (
            <div key={d} style={{ marginBottom: 16 }}>
              <div className="flex-between" style={{ marginBottom: 6 }}>
                <strong>{d}</strong>
                <span className={`badge ${done >= target ? 'ok' : 'warn'}`}>{done}/{target} {T.bancale_equiv}</span>
              </div>
              {progs.map((pr, pi) => (
                <div key={pi} style={{ marginBottom: 8 }}>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <ProgBadge type={pr.progType} T={T} />
                    <span className="smallmuted">{pr.label || ''}</span>
                  </div>
                  <table>
                    <tbody>
                      {pr.items.map((it, ii) => {
                        const p = state.products.find(x => x.id === it.productId);
                        const cv = state.covers.find(x => x.id === it.coverId);
                        const bk = state.baskets.find(x => x.id === it.basketId);
                        return (
                          <tr key={ii}>
                            <td className="mono smallmuted">{it.time || '—'}</td>
                            <td>{p ? p.name : '?'}</td>
                            <td className="smallmuted">{cv ? cv.name : '—'}</td>
                            <td className="smallmuted">{bk ? bk.name : '—'}</td>
                            <td className="mono">{it.target}</td>
                            <td className="mono smallmuted">{it.kilos ? `${it.kilos}kg` : ''}</td>
                            <td>
                              {it.status === 'done'
                                ? <span className="badge ok">✓</span>
                                : <span className="badge warn">{T.pending}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
              <hr className="sep" />
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3>{T.deduction_log}</h3>
        {state.log.length === 0 ? (
          <div className="empty">{T.no_log}</div>
        ) : (
          <table>
            <tbody>
              {[...state.log].reverse().slice(0, 150).map((l, i) => (
                <tr key={i}>
                  <td className="smallmuted">{new Date(l.time).toLocaleString()}</td>
                  <td>{l.type}</td>
                  <td className="mono">{l.product || ''}</td>
                  <td className="smallmuted">{T.logged_by}: {l.by || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
