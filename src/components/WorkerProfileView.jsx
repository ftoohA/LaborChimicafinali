import { useState } from 'react';
import { useStore } from '../store';

const tr = (L, ar, it, en) => (L === 'ar' ? ar : L === 'it' ? it : en);

const DAYS = {
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  it: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

import { netHours } from '../helpers';

/* Reusable profile content for a single worker (used by the worker tab + admin). */
export default function WorkerProfileView({ worker, actions = null, compact = false }) {
  const { state } = useStore();
  const L = state.lang;
  const [viewingDoc, setViewingDoc] = useState(null);

  const records = (state.attendance || [])
    .filter(r => r.workerId === worker.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyHrs = records.filter(r => r.date?.startsWith(thisMonth)).reduce((s, r) => s + (netHours(r) || 0), 0);
  const totalHrs = records.reduce((s, r) => s + (netHours(r) || 0), 0);
  const monthRating = worker?.monthlyRatings?.[thisMonth] ?? worker?.grade ?? 0;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayNote = (state.workerDayNotes || {})[todayKey]?.[worker.id];

  return (
    <>
      {/* Header */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {worker?.photo
            ? <img src={worker.photo} alt="" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--brand)' }} />
            : <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--panel2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>👤</div>}
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{worker?.name}</div>
            {worker?.codiceFiscale && <div className="smallmuted mono" style={{ marginTop: 2, fontSize: 12 }}>🆔 {worker.codiceFiscale}</div>}
            {worker?.details && <div className="smallmuted" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{worker.details}</div>}
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="smallmuted" style={{ fontSize: 12 }}>{tr(L, `تقييم ${thisMonth}:`, `Voto ${thisMonth}:`, `Rating ${thisMonth}:`)}</span>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ fontSize: 18, color: i < monthRating ? 'var(--yellow)' : 'var(--line)' }}>★</span>
              ))}
            </div>
          </div>
          {actions && <div className="row" style={{ gap: 8, flexShrink: 0 }}>{actions}</div>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid cols-3" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="num" style={{ color: 'var(--green)' }}>{monthlyHrs.toFixed(1)}h</div>
          <div className="lbl">{tr(L, 'ساعات هذا الشهر', 'Ore questo mese', 'This month')}</div>
        </div>
        <div className="stat">
          <div className="num">{totalHrs.toFixed(1)}h</div>
          <div className="lbl">{tr(L, 'إجمالي الساعات', 'Ore totali', 'Total hours')}</div>
        </div>
        <div className="stat">
          <div className="num">{records.filter(r => r.date?.startsWith(thisMonth)).length}</div>
          <div className="lbl">{tr(L, 'أيام هذا الشهر', 'Giorni questo mese', 'Days this month')}</div>
        </div>
      </div>

      {todayNote && (
        <div className="notes-card" style={{ marginBottom: 14, borderColor: 'var(--brand)' }}>
          <h3>📝 {tr(L, 'مهمة اليوم', 'Compito di oggi', 'Task today')}</h3>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.7 }}>{todayNote}</p>
        </div>
      )}

      {(worker?.idCardPhoto || (worker?.documents || []).length > 0) && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 12px' }}>📎 {tr(L, 'المستندات والصور', 'Documenti e foto', 'Documents & Photos')}</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {worker?.idCardPhoto && (
              <div style={{ textAlign: 'center' }}>
                <img src={worker.idCardPhoto} alt="" onClick={() => setViewingDoc(worker.idCardPhoto)}
                  style={{ width: 130, height: 86, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer' }} />
                <div className="smallmuted" style={{ fontSize: 11, marginTop: 4 }}>🪪 {tr(L, 'البطاقة', "Carta d'identità", 'ID card')}</div>
              </div>
            )}
            {(worker?.documents || []).map(doc => (
              <div key={doc.id} style={{ textAlign: 'center' }}>
                <img src={doc.image} alt={doc.name} onClick={() => setViewingDoc(doc.image)}
                  style={{ width: 100, height: 86, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer' }} />
                {doc.name && <div className="smallmuted" style={{ fontSize: 11, marginTop: 4, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ margin: '0 0 12px' }}>📅 {tr(L, 'سجل الحضور', 'Storico presenze', 'Attendance History')}</h3>
        {records.length === 0 ? (
          <div className="empty">{tr(L, 'لا يوجد سجلات بعد', 'Nessun record ancora', 'No records yet')}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{tr(L, 'التاريخ', 'Data', 'Date')}</th>
                <th>{tr(L, 'اليوم', 'Giorno', 'Day')}</th>
                <th>🟢 {tr(L, 'دخول', 'Entrata', 'In')}</th>
                <th>🔴 {tr(L, 'خروج', 'Uscita', 'Out')}</th>
                {!compact && <th>📸 {tr(L, 'الصور', 'Foto', 'Photos')}</th>}
                <th>{tr(L, 'الساعات', 'Ore', 'Hours')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const h = netHours(r);
                const dayIdx = r.date ? new Date(r.date + 'T12:00:00').getDay() : null;
                const thumb = (src, ring) => (
                  <img src={src} alt="" onClick={() => setViewingDoc(src)}
                    style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, border: `2px solid ${ring}`, cursor: 'pointer' }} />
                );
                return (
                  <tr key={r.id}>
                    <td className="mono">{r.date}</td>
                    <td className="smallmuted">{dayIdx != null ? (DAYS[L] || DAYS.en)[dayIdx] : '—'}</td>
                    <td className="mono">{fmtTime(r.clockIn)}</td>
                    <td className="mono">{fmtTime(r.clockOut)}</td>
                    {!compact && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {r.clockInPhoto ? thumb(r.clockInPhoto, 'var(--green)') : null}
                          {r.clockOutPhoto ? thumb(r.clockOutPhoto, 'var(--red)') : null}
                          {!r.clockInPhoto && !r.clockOutPhoto && <span className="smallmuted">—</span>}
                        </div>
                      </td>
                    )}
                    <td>
                      <span className="mono" style={{ fontWeight: 700, color: h ? 'var(--green)' : 'var(--muted)' }}>
                        {h != null ? `${h.toFixed(1)}h` : '—'}
                      </span>
                      {r.lunch > 0 && <span className="smallmuted" style={{ fontSize: 10, marginInlineStart: 3 }}>🍽️−{r.lunch}</span>}
                      {r.manual && <span className="smallmuted" style={{ fontSize: 10, marginInlineStart: 3 }}>✏️</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {viewingDoc && (
        <div onClick={() => setViewingDoc(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20, cursor: 'zoom-out' }}>
          <img src={viewingDoc} alt="" style={{ maxWidth: '95%', maxHeight: '95%', borderRadius: 8 }} />
        </div>
      )}
    </>
  );
}
