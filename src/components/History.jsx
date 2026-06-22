import { useState } from 'react';
import { useStore } from '../store';
import { I18N } from '../i18n';
import { todayStr } from '../helpers';
import { exportDayExcel } from '../exportExcel';
import ProgBadge from './ProgBadge';

export default function History() {
  const { state } = useStore();
  const T = I18N[state.lang];
  const L = state.lang;
  const dates = Object.keys(state.programs).sort().reverse();
  const [expDate, setExpDate] = useState(todayStr());

  const doExport = () => {
    exportDayExcel({
      log: state.log, products: state.products, workers: state.workers, attendance: state.attendance,
      cartonTypes: state.cartonTypes, covers: state.covers, baskets: state.baskets,
      pastaBoxes: state.pastaBoxes, pastaLids: state.pastaLids, pastaLiquids: state.pastaLiquids,
      date: expDate,
    });
  };

  return (
    <>
      <div className="card" style={{ borderColor: 'var(--brand)' }}>
        <h3 style={{ margin: '0 0 12px 0' }}>📊 {L === 'ar' ? 'تصدير تقرير اليوم (Excel)' : L === 'it' ? 'Esporta report giornaliero (Excel)' : 'Export Daily Report (Excel)'}</h3>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} style={{ maxWidth: 180 }} />
          <button className="primary" onClick={doExport}>⬇️ {L === 'ar' ? 'تنزيل Excel' : L === 'it' ? 'Scarica Excel' : 'Download Excel'}</button>
        </div>
        <p className="smallmuted" style={{ marginTop: 8, marginBottom: 0 }}>
          {L === 'ar' ? 'يشمل كل حركات اليوم (إدخال/إخراج/إنتاج/طلبيات) والحضور.' : L === 'it' ? 'Include tutti i movimenti del giorno (entrate/uscite/produzione/ordini) e le presenze.' : 'Includes all day movements (in/out/production/orders) and attendance.'}
        </p>
      </div>

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
                    <thead>
                      <tr style={{ color: 'var(--muted)', fontSize: 11 }}>
                        <th style={{ textAlign: 'start' }}>{T.col_product}</th>
                        {pr.progType === 'brazer' && (
                          <>
                            <th style={{ textAlign: 'start' }}>{state.lang === 'ar' ? 'علبة الباستا' : state.lang === 'it' ? 'Scatola pasta' : 'Pasta Box'}</th>
                            <th style={{ textAlign: 'start' }}>{state.lang === 'ar' ? 'غطاء الباستا' : state.lang === 'it' ? 'Coperchio pasta' : 'Pasta Lid'}</th>
                          </>
                        )}
                        {pr.progType !== 'brazer' && pr.progType !== 'amazon' && (
                          <>
                            <th style={{ textAlign: 'start' }}>{T.col_cover}</th>
                            <th style={{ textAlign: 'start' }}>{T.col_basket}</th>
                          </>
                        )}
                        <th style={{ textAlign: 'start' }}>{T.col_target}</th>
                        <th style={{ textAlign: 'start' }}>{T.col_confirm}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pr.items.map((it, ii) => {
                        const p = state.products.find(x => x.id === it.productId);
                        const cv = state.covers.find(x => x.id === it.coverId);
                        const bk = state.baskets.find(x => x.id === it.basketId);
                        const pb = state.pastaBoxes?.find(x => x.id === (it.pastaBoxId || p?.pastaBoxId));
                        const pl = state.pastaLids?.find(x => x.id === (it.pastaLidId || p?.pastaLidId));
                        return (
                          <tr key={ii}>
                            <td>{p ? p.name : '?'}</td>
                            {pr.progType === 'brazer' && (
                              <>
                                <td className="smallmuted">{pb ? pb.name : '—'}</td>
                                <td className="smallmuted">{pl ? pl.name : '—'}</td>
                              </>
                            )}
                            {pr.progType !== 'brazer' && pr.progType !== 'amazon' && (
                              <>
                                <td className="smallmuted">{cv ? cv.name : '—'}</td>
                                <td className="smallmuted">{bk ? bk.name : '—'}</td>
                              </>
                            )}
                            <td className="mono">{it.target}</td>
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
