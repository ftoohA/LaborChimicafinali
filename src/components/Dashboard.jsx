import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { I18N } from '../i18n';
import { bancaleEquivalent, stockStatus, todayStr, uid } from '../helpers';
import ProgBadge from './ProgBadge';
import Modal from './Modal';
import { useToast } from './Toast';

const tr = (L, ar, it, en) => (L === 'ar' ? ar : L === 'it' ? it : en);

// Short attention chime via Web Audio — 'urgent' = 3 rising beeps, 'scheduled' = gentle two-tone
let _audioCtx = null;
function playChime(kind) {
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    const notes = kind === 'urgent'
      ? [[880, 0], [880, 0.2], [1175, 0.4]]
      : [[660, 0], [988, 0.17]];
    notes.forEach(([freq, t]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      const s = t0 + t, dur = 0.16;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.28, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      o.start(s); o.stop(s + dur + 0.02);
    });
  } catch { /* audio not allowed yet */ }
}

const DAY_NAMES = {
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  it: ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

export default function Dashboard() {
  const { state, update } = useStore();
  const T = I18N[state.lang];
  const today = todayStr();
  const progs = state.programs[today] || [];

  const low = state.products.filter(p => bancaleEquivalent(p, p.stock, state.covers, state.baskets, state.pastaStock, state.pastaLiquids, state.settings, state.pastaBoxes, state.pastaLids) < state.settings.lowStock);

  const threshold = state.settings.lowStock;

  // Global baskets below threshold
  const lowBaskets = state.baskets.filter(b => (b.stock || 0) < threshold * 5);

  // Products with per-product jerrican stock below threshold (no global basket assigned)
  const lowJerricanProds = state.products.filter(p =>
    !p.basketId && p.jerricansPer > 0 && (p.stock?.jerricans || 0) < threshold * p.jerricansPer
  );

  const hasBasketAlert = lowBaskets.length > 0 || lowJerricanProds.length > 0;

  // ── Pasta low-stock alerts ──────────────────────────────────────────
  const pastaThreshold = state.settings.lowStockPasta ?? 10; // in cartons

  const pastaAlerts = [];

  // Pasta Boxes
  (state.pastaBoxes || []).forEach(pb => {
    const cartonsAvail = (pb.stock || 0) / (12 * (1 + (state.settings.wastePastaBox ?? 2) / 100));
    if (cartonsAvail < pastaThreshold) {
      pastaAlerts.push({
        type: 'box',
        name: pb.name,
        stock: pb.stock || 0,
        cartons: cartonsAvail,
        unit: state.lang === 'ar' ? 'قطعة' : state.lang === 'it' ? 'pezzi' : 'pcs',
        icon: '📦',
        label: state.lang === 'ar' ? 'علبة باستا' : state.lang === 'it' ? 'Scatola pasta' : 'Pasta Box',
      });
    }
  });

  // Pasta Lids
  (state.pastaLids || []).forEach(pl => {
    const cartonsAvail = (pl.stock || 0) / (12 * (1 + (state.settings.wastePastaLid ?? 2) / 100));
    if (cartonsAvail < pastaThreshold) {
      pastaAlerts.push({
        type: 'lid',
        name: pl.name,
        stock: pl.stock || 0,
        cartons: cartonsAvail,
        unit: state.lang === 'ar' ? 'قطعة' : state.lang === 'it' ? 'pezzi' : 'pcs',
        icon: '🔴',
        label: state.lang === 'ar' ? 'غطاء باستا' : state.lang === 'it' ? 'Coperchio pasta' : 'Pasta Lid',
      });
    }
  });

  // Pasta Liquid
  (state.pastaLiquids || []).forEach(liq => {
    // Each carton needs 12 * liter (we use a generic 0.5L if not product-specific)
    // Estimate: warn if liquid stock < threshold * 12 * 0.5L (conservative)
    const litersPerCarton = 12 * 0.5 * (1 + (state.settings.wastePastaLiquid ?? 2) / 100);
    const cartonsAvail = litersPerCarton > 0 ? (liq.stock || 0) / litersPerCarton : 0;
    if (cartonsAvail < pastaThreshold) {
      pastaAlerts.push({
        type: 'liquid',
        name: liq.name,
        stock: liq.stock || 0,
        cartons: cartonsAvail,
        unit: state.lang === 'ar' ? 'لتر' : 'lt',
        icon: '💧',
        label: state.lang === 'ar' ? 'سائل باستا' : state.lang === 'it' ? 'Liquido pasta' : 'Pasta Liquid',
      });
    }
  });

  // Pasta Sponges
  const spongeStock = state.pastaStock?.sponges || 0;
  const spongeCartons = spongeStock / (12 * (1 + (state.settings.wastePastaSponge ?? 2) / 100));
  if (spongeCartons < pastaThreshold) {
    pastaAlerts.push({
      type: 'sponge',
      name: state.lang === 'ar' ? 'الإسفنجة' : state.lang === 'it' ? 'Spugna' : 'Sponge',
      stock: spongeStock,
      cartons: spongeCartons,
      unit: state.lang === 'ar' ? 'قطعة' : state.lang === 'it' ? 'pezzi' : 'pcs',
      icon: '🧽',
      label: state.lang === 'ar' ? 'إسفنجة باستا' : state.lang === 'it' ? 'Spugna pasta' : 'Pasta Sponge',
    });
  }

  // Pasta Sponge Lids
  const spongeLidStock = state.pastaStock?.spongeLids || 0;
  const spongeLidCartons = spongeLidStock / (12 * (1 + (state.settings.wastePastaSpongeLid ?? 2) / 100));
  if (spongeLidCartons < pastaThreshold) {
    pastaAlerts.push({
      type: 'spongeLid',
      name: state.lang === 'ar' ? 'غطاء الإسفنجة' : state.lang === 'it' ? 'Coperchio Spugna' : 'Sponge Lid',
      stock: spongeLidStock,
      cartons: spongeLidCartons,
      unit: state.lang === 'ar' ? 'قطعة' : state.lang === 'it' ? 'pezzi' : 'pcs',
      icon: '🔴',
      label: state.lang === 'ar' ? 'غطاء إسفنجة باستا' : state.lang === 'it' ? 'Coperchio spugna pasta' : 'Pasta Sponge Lid',
    });
  }

  const hasPastaAlert = pastaAlerts.length > 0;

  let totalTarget = 0, totalDone = 0;
  progs.forEach(pr => {
    // Only sum line programs (daily, location, macro). Ignore 'amazon' and 'brazer' (Pasta).
    if (pr.progType !== 'amazon' && pr.progType !== 'brazer') {
      pr.items.forEach(it => {
        totalTarget += Number(it.target) || 0;
        if (it.status === 'done') totalDone += Number(it.target) || 0;
      });
    }
  });

  const note = state.managerNotes[today] || '';
  const [search, setSearch] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [manageScheduled, setManageScheduled] = useState(false);

  // Re-render every 30s so scheduled alerts appear/disappear (and chime) on time
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 30000); return () => clearInterval(id); }, []);

  const now = new Date();
  const announcements = (state.announcements || []).filter(a => a.active);
  const scheduledAlerts = (state.scheduledAlerts || []).filter(sa =>
    sa.active && sa.dayOfWeek === now.getDay()
    && now.getHours() >= sa.hour
    && now.getHours() < (sa.untilHour ?? 24)
  );

  // Play a chime when a new alert/announcement appears (once per appearance)
  const soundedRef = useRef(new Set());
  const alertKey = announcements.map(a => 'a' + a.id).join() + '|' + scheduledAlerts.map(s => 's' + s.id).join();
  useEffect(() => {
    const activeIds = [...announcements.map(a => 'a' + a.id), ...scheduledAlerts.map(s => 's' + s.id)];
    let played = false;
    for (const a of announcements) {
      const k = 'a' + a.id;
      if (!soundedRef.current.has(k)) { soundedRef.current.add(k); if (!played) { playChime('urgent'); played = true; } }
    }
    for (const s of scheduledAlerts) {
      const k = 's' + s.id;
      if (!soundedRef.current.has(k)) { soundedRef.current.add(k); if (!played) { playChime('scheduled'); played = true; } }
    }
    // forget ids no longer active so they re-sound next time they appear
    [...soundedRef.current].forEach(id => { if (!activeIds.includes(id)) soundedRef.current.delete(id); });
  }, [alertKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissAnnouncement = (id) => {
    update({ announcements: (state.announcements || []).map(a => a.id === id ? { ...a, active: false } : a) });
  };

  // Admin reorder: move an active announcement up/down among the active ones
  const moveAnnouncement = (id, dir) => {
    const arr = [...(state.announcements || [])];
    const activeIdxs = arr.map((a, i) => (a.active ? i : -1)).filter(i => i >= 0);
    const pos = activeIdxs.findIndex(i => arr[i].id === id);
    const target = pos + dir;
    if (pos < 0 || target < 0 || target >= activeIdxs.length) return;
    const i1 = activeIdxs[pos], i2 = activeIdxs[target];
    [arr[i1], arr[i2]] = [arr[i2], arr[i1]];
    update({ announcements: arr });
  };

  const AnnouncementsBlock = () => (
    <>
      {scheduledAlerts.map(sa => (
        <div key={sa.id} className="card" style={{ borderColor: 'var(--yellow)', background: 'rgba(242,183,5,0.06)', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 28 }}>⏰</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--yellow)' }}>
                {tr(state.lang, 'تنبيه مجدول', 'Avviso programmato', 'Scheduled Alert')}
                <span className="smallmuted" style={{ fontSize: 11, marginInlineStart: 8 }}>
                  ⏰ {String(sa.hour).padStart(2, '0')}:00–{String(sa.untilHour ?? 24).padStart(2, '0')}:00
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 15, lineHeight: 1.7 }}>{sa.text}</div>
            </div>
          </div>
        </div>
      ))}
      {announcements.map((a, idx) => (
        <div key={a.id} className="card" style={{ borderColor: 'var(--red)', background: 'rgba(220,38,38,0.04)', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 28 }}>📢</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--red)' }}>
                {tr(state.lang, '⚡ إشعار عاجل', '⚡ Avviso urgente', '⚡ Urgent Notice')}
                {(a.author || a.by === 'worker') && <span className="badge" style={{ marginInlineStart: 8, fontSize: 10 }}>👷 {a.author || tr(state.lang, 'عامل', 'Operaio', 'Worker')}</span>}
              </div>
              <div style={{ marginTop: 4, fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{a.text}</div>
              {a.photo && <img src={a.photo} alt="" style={{ marginTop: 10, maxWidth: '100%', borderRadius: 8, maxHeight: 300, objectFit: 'contain' }} />}
            </div>
            {state.role === 'admin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                <button className="ghost" style={{ fontSize: 12, padding: '2px 8px' }} title={tr(state.lang, 'فوق', 'Su', 'Up')} disabled={idx === 0} onClick={() => moveAnnouncement(a.id, -1)}>▲</button>
                <button className="ghost" style={{ fontSize: 12, padding: '2px 8px' }} title={tr(state.lang, 'تحت', 'Giù', 'Down')} disabled={idx === announcements.length - 1} onClick={() => moveAnnouncement(a.id, 1)}>▼</button>
                <button className="ghost" style={{ fontSize: 12, padding: '2px 8px', color: 'var(--muted)' }} onClick={() => dismissAnnouncement(a.id)}>✕</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );

  /* ── Worker schedule helper ── */
  const renderWorkerSchedule = () => {
    const workers = state.workers || [];
    if (workers.length === 0) return null;

    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          👥 {state.lang === 'ar' ? 'جدول تشغيل العمال وفترات الغداء اليوم' : state.lang === 'it' ? 'Turni operai e pause pranzo di oggi' : 'Worker Schedules & Lunch Breaks Today'}
        </h3>
        <div className="grid cols-3" style={{ gap: 12 }}>
          {workers.map(w => {
            const assignedProgs = progs.filter(pr => pr.assignedWorkers?.includes(w.id));
            return (
              <div key={w.id} className="card" style={{ margin: 0, padding: 12, background: 'var(--panel2)', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>👤 {w.name}</span>
                  <span className="badge blue" style={{ fontSize: 11, padding: '3px 8px' }}>
                    ⏰ {w.lunchTime || '—'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4, color: 'var(--yellow)' }}>
                    {state.lang === 'ar' ? 'البرنامج المعين له:' : state.lang === 'it' ? 'Programma assegnato:' : 'Assigned Program:'}
                  </div>
                  {assignedProgs.length === 0 ? (
                    <span style={{ fontStyle: 'italic' }}>
                      {state.lang === 'ar' ? 'غير معين لأي برنامج اليوم' : state.lang === 'it' ? 'Non assegnato a nessun programma oggi' : 'Not assigned to any program today'}
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {assignedProgs.map(pr => (
                        <div key={pr.id} style={{ background: 'var(--bg)', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--line)' }}>
                          <div style={{ fontWeight: 'bold', color: 'var(--text)' }}>
                            {pr.label || (state.lang === 'ar' ? 'برنامج اليوم' : state.lang === 'it' ? 'Programma di oggi' : 'Today\'s Program')}
                          </div>
                          {pr.notes && (
                            <div style={{ fontSize: 11, color: 'var(--yellow)', marginTop: 2, fontStyle: 'italic' }}>
                              📝 {pr.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ── Worker view ── */
  if (state.role === 'worker') {
    const filtered = state.products.filter(p =>
      !search || (p.name + p.company + p.code).toLowerCase().includes(search.toLowerCase())
    );
    return (
      <>
        <div style={{ marginBottom: 12 }}>
          <button className="primary" onClick={() => setPostingAnnouncement(true)}>
            📢 {tr(state.lang, 'إضافة إشعار عاجل', 'Aggiungi avviso urgente', 'Add urgent notice')}
          </button>
        </div>
        <AnnouncementsBlock />
        {postingAnnouncement && (
          <AnnouncementModal L={state.lang} T={T} requireCode workers={state.workers || []}
            onClose={() => setPostingAnnouncement(false)}
            onSave={ann => { update({ announcements: [...(state.announcements || []), ann] }); setPostingAnnouncement(false); }} />
        )}
        {renderWorkerSchedule()}
        {note && (
          <div className="notes-card" style={{ marginBottom: 16 }}>
            <h3>📋 {T.manager_notes} — {today}</h3>
            <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.7 }}>{note}</p>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <input
            placeholder={T.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 280 }}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty">{T.no_products}</div>
        ) : (
          <div className="grid cols-3">
            {filtered.map(p => {
              const cv  = state.covers.find(x => x.id === p.coverId);
              const bk  = state.baskets.find(x => x.id === p.basketId);
              const be  = bancaleEquivalent(p, p.stock, state.covers, state.baskets, state.pastaStock, state.pastaLiquids, state.settings, state.pastaBoxes, state.pastaLids);
              const st  = stockStatus(be, state.settings.lowStock);
              return (
                <div className="card" key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Image + name */}
                  <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                    {p.image
                      ? <img src={p.image} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', flexShrink: 0 }} />
                      : <div style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🧴</div>
                    }
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{p.name}</div>
                      <div className="smallmuted" style={{ marginTop: 2 }}>{p.company}</div>
                      <div className="smallmuted">{p.type} · {p.liter}L</div>
                    </div>
                  </div>

                  <hr className="sep" style={{ margin: 0 }} />

                  {/* Code — prominent for workers */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 8, padding: '8px 12px' }}>
                    <span className="smallmuted" style={{ fontSize: 11 }}>{T.code}</span>
                    <span className="mono" style={{ fontSize: 20, fontWeight: 800, letterSpacing: 2, color: 'var(--yellow)' }}>{p.code}</span>
                    {p.barcode && <span className="smallmuted" style={{ fontSize: 11, marginInlineStart: 'auto' }}>{p.barcode}</span>}
                  </div>

                  {/* Cover + basket */}
                  {(cv || bk) && (
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      {cv && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                          🎩 <span className="color-chip">{cv.color}</span>
                          {cv.size && <span className="size-chip">{cv.size}</span>}
                        </span>
                      )}
                      {bk && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                          🪣 <span className="color-chip">{bk.color}</span>
                          {bk.size && <span className="size-chip">{bk.size}</span>}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stock summary */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="smallmuted" style={{ fontSize: 11 }}>{T.bancale_equiv}</span>
                    <span className={`badge ${st}`} style={{ fontSize: 13, fontWeight: 700 }}>{isFinite(be) ? be.toFixed(1) : '∞'}</span>
                  </div>

                  {/* Tickets */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
                      <div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{(p.stock?.ticketsFront || 0).toLocaleString()}</div>
                      <div className="smallmuted" style={{ fontSize: 10 }}>{T.tickets_front}</div>
                    </div>
                    <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
                      <div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{(p.stock?.ticketsBack || 0).toLocaleString()}</div>
                      <div className="smallmuted" style={{ fontSize: 10 }}>{T.tickets_back}</div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Daily confirmation code — reminder + quick change */}
      <DailyCodeCard state={state} update={update} today={today} />

      {/* Admin announcement controls */}
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="primary" onClick={() => setPostingAnnouncement(true)}>
          📢 {tr(state.lang, 'نشر إشعار عاجل', 'Pubblica avviso urgente', 'Post Urgent Notice')}
        </button>
        <button className="ghost" onClick={() => setManageScheduled(true)}>
          ⏰ {tr(state.lang, 'التنبيهات المجدولة', 'Avvisi programmati', 'Scheduled Alerts')}
        </button>
      </div>
      <AnnouncementsBlock />
      {renderWorkerSchedule()}
      {note && (
        <div className="notes-card">
          <h3>📋 {T.manager_notes} — {today}</h3>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.7 }}>{note}</p>
        </div>
      )}
      {!note && state.role === 'admin' && (
        <div className="notes-card" style={{ opacity: .6 }}>
          <h3>📋 {T.manager_notes}</h3>
          <p className="smallmuted">{T.write_notes}</p>
        </div>
      )}

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="num">{state.products.length}</div>
          <div className="lbl">{T.products}</div>
        </div>
        <div className="stat">
          <div className="num">{progs.length}</div>
          <div className="lbl">{T.today_program}</div>
        </div>
        <div className="stat">
          <div className="num">
            {totalDone}
            <span style={{ fontSize: 16, color: 'var(--muted)' }}>/{totalTarget}</span>
          </div>
          <div className="lbl">{T.total_done} / {T.total_target}</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: low.length ? 'var(--red)' : 'var(--green)' }}>
            {low.length}
          </div>
          <div className="lbl">{T.low_stock_warning}</div>
        </div>
        {hasBasketAlert && (
          <div className="stat" style={{ borderColor: 'var(--orange)' }}>
            <div className="num" style={{ color: 'var(--orange)' }}>
              {lowBaskets.length + lowJerricanProds.length}
            </div>
            <div className="lbl">🪣 Taniche basse</div>
          </div>
        )}
      </div>

      {low.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--red)', marginBottom: 16 }}>
          <h3 style={{ color: 'var(--red)' }}>⚠ {T.low_stock_warning}</h3>
          <table>
            <thead>
              <tr><th>{T.products}</th><th>{T.company}</th><th>{T.bancale_equiv}</th></tr>
            </thead>
            <tbody>
              {low.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.company}</td>
                  <td className="mono">{bancaleEquivalent(p, p.stock, state.covers, state.baskets, state.pastaStock, state.pastaLiquids, state.settings, state.pastaBoxes, state.pastaLids).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasBasketAlert && (
        <div className="card" style={{ borderColor: 'var(--orange)', marginBottom: 16 }}>
          <h3 style={{ color: 'var(--orange)', marginBottom: 12 }}>🪣 Taniche basse — da rifornire</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lowBaskets.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🪣</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    {(b.color || b.size) && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                        {b.color && <span className="color-chip">{b.color}</span>}
                        {b.size  && <span className="size-chip">{b.size}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'end' }}>
                  <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>
                    {(b.stock || 0).toLocaleString()}
                  </span>
                  <span className="smallmuted" style={{ marginInlineStart: 4 }}>{T.pieces}</span>
                </div>
              </div>
            ))}
            {lowJerricanProds.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>📦</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="smallmuted" style={{ fontSize: 11 }}>{p.company}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'end' }}>
                  <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>
                    {(p.stock?.jerricans || 0).toLocaleString()}
                  </span>
                  <span className="smallmuted" style={{ marginInlineStart: 4 }}>{T.pieces}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasPastaAlert && (
        <div className="card" style={{ borderColor: 'var(--red)', marginBottom: 16, background: 'rgba(220,38,38,0.04)' }}>
          <h3 style={{ color: 'var(--red)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            {state.lang === 'ar' ? 'تحذير — مخزون الباستا ناقص!' :
             state.lang === 'it' ? 'Attenzione — scorte pasta in esaurimento!' :
             'Warning — Pasta stock running low!'}
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginInlineStart: 8 }}>
              {state.lang === 'ar' ? `(أقل من ${pastaThreshold} كرتونة)` :
               state.lang === 'it' ? `(meno di ${pastaThreshold} cartoni)` :
               `(under ${pastaThreshold} cartons)`}
            </span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pastaAlerts.map((a, idx) => {
              const isZero = a.cartons <= 0;
              const pct = Math.min(100, (a.cartons / pastaThreshold) * 100);
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: 'var(--bg)', borderRadius: 8,
                  border: `1px solid ${isZero ? 'var(--red)' : 'rgba(220,38,38,0.3)'}`,
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{a.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</span>
                        <span className="smallmuted" style={{ fontSize: 11 }}>— {a.label}</span>
                      </div>
                      {/* progress bar */}
                      <div style={{ height: 6, background: 'var(--panel)', borderRadius: 4, overflow: 'hidden', width: '100%' }}>
                        <div style={{
                          height: '100%', borderRadius: 4, transition: 'width .3s',
                          width: `${pct}%`,
                          background: isZero ? 'var(--red)' : pct < 40 ? 'var(--orange)' : 'var(--yellow)',
                        }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'end', flexShrink: 0 }}>
                    <div>
                      <span className="mono" style={{ fontSize: 16, fontWeight: 800, color: isZero ? 'var(--red)' : 'var(--orange)' }}>
                        {a.stock.toLocaleString()}
                      </span>
                      <span className="smallmuted" style={{ fontSize: 11, marginInlineStart: 4 }}>{a.unit}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      ≈ <strong>{a.cartons.toFixed(1)}</strong> {state.lang === 'ar' ? 'كرتونة' : state.lang === 'it' ? 'cartoni' : 'cartons'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{T.today_program} — {today}</h3>
          <button style={{ fontSize: 12 }} onClick={() => update({ tab: 'program' })}>
            {T.program} →
          </button>
        </div>
        {progs.length === 0 ? (
          <div className="empty">{T.no_program_today}</div>
        ) : progs.map((pr, pi) => (
          <ProgramSummary key={pi} pr={pr} T={T} state={state} />
        ))}
      </div>

      {postingAnnouncement && (
        <AnnouncementModal L={state.lang} T={T}
          onClose={() => setPostingAnnouncement(false)}
          onSave={ann => {
            update({ announcements: [...(state.announcements || []), ann] });
            setPostingAnnouncement(false);
          }} />
      )}
      {manageScheduled && (
        <ScheduledAlertsModal L={state.lang} T={T}
          alerts={state.scheduledAlerts || []}
          onClose={() => setManageScheduled(false)}
          onSave={alerts => { update({ scheduledAlerts: alerts }); setManageScheduled(false); }} />
      )}
    </>
  );
}

function ProgramSummary({ pr, T, state }) {
  const isPasta = pr.progType === 'brazer';
  const isAmazon = pr.progType === 'amazon';

  return (
    <div className="prog-section">
      <div className="prog-header">
        <ProgBadge type={pr.progType} T={T} />
        <span className="prog-title">{pr.label || ''}</span>
      </div>
      <div className="sched-wrap">
        <table className="sched-table">
          <thead>
            <tr>
              <th>{T.col_product}</th>
              {isPasta && (
                <>
                  <th>{state.lang === 'ar' ? 'علبة الباستا' : state.lang === 'it' ? 'Scatola pasta' : 'Pasta Box'}</th>
                  <th>{state.lang === 'ar' ? 'غطاء الباستا' : state.lang === 'it' ? 'Coperchio pasta' : 'Pasta Lid'}</th>
                </>
              )}
              {!isPasta && !isAmazon && (
                <>
                  <th>{T.col_cover}</th>
                  <th>{T.col_basket}</th>
                </>
              )}
              <th>{T.col_target}</th>
              <th>{T.col_notes}</th>
              <th>{T.col_confirm}</th>
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
                <tr key={ii} className={it.status === 'done' ? 'row-done' : 'row-pending'}>
                  <td><strong>{p ? p.name : '?'}</strong></td>
                  {isPasta && (
                    <>
                      <td className="smallmuted">{pb ? pb.name : '—'}</td>
                      <td className="smallmuted">{pl ? pl.name : '—'}</td>
                    </>
                  )}
                  {!isPasta && !isAmazon && (
                    <>
                      <td className="smallmuted">{cv ? cv.name : '—'}</td>
                      <td className="smallmuted">{bk ? bk.name : '—'}</td>
                    </>
                  )}
                  <td className="mono">{it.target || '—'}</td>
                  <td className="smallmuted" style={{ maxWidth: 120 }}>{it.notes || ''}</td>
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
    </div>
  );
}

function AnnouncementModal({ L, T, requireCode, workers = [], onClose, onSave }) {
  const toast = useToast();
  const fileRef = useRef();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  const doPost = () => {
    if (!text.trim()) { toast(tr(L, 'اكتب نص الإشعار', 'Scrivi il testo', 'Write the notice'), true); return; }
    if (requireCode) {
      const w = workers.find(x => x.pin && x.pin === code.trim());
      if (!w) { setErr(tr(L, 'الرقم السري غلط', 'PIN errato', 'Wrong PIN')); return; }
      onSave({ id: uid(), text: text.trim(), photo, createdAt: new Date().toISOString(), active: true, by: 'worker', author: w.name });
      return;
    }
    onSave({ id: uid(), text: text.trim(), photo, createdAt: new Date().toISOString(), active: true, by: 'admin' });
  };

  const compress = (file) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 900;
      const sc = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * sc); canvas.height = Math.round(img.height * sc);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      setPhoto(canvas.toDataURL('image/jpeg', 0.75));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <Modal onClose={onClose} maxWidth={460}>
      <h3>📢 {tr(L, 'نشر إشعار عاجل', 'Pubblica avviso urgente', 'Post Urgent Notice')}</h3>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => compress(e.target.files?.[0])} />
      <div className="field">
        <label>{tr(L, 'نص الإشعار', 'Testo avviso', 'Notice text')}</label>
        <textarea autoFocus value={text} onChange={e => setText(e.target.value)} style={{ minHeight: 80 }}
          placeholder={tr(L, 'اكتب الإشعار العاجل هنا...', 'Scrivi qui l\'avviso urgente...', 'Write the urgent notice here...')} />
      </div>
      <div className="field">
        <label>{tr(L, 'صورة (اختياري)', 'Immagine (opzionale)', 'Photo (optional)')}</label>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          {photo && <img src={photo} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6 }} />}
          <button type="button" onClick={() => fileRef.current?.click()}>📷 {tr(L, 'إضافة صورة', 'Aggiungi foto', 'Add photo')}</button>
          {photo && <button type="button" className="danger ghost" onClick={() => setPhoto('')}>✕</button>}
        </div>
      </div>
      {requireCode && (
        <div className="field">
          <label>🔒 {tr(L, 'رقمك السري (لمعرفة اسمك)', 'Il tuo PIN (per identificarti)', 'Your PIN (to identify you)')}</label>
          <input type="password" value={code} onChange={e => { setCode(e.target.value); setErr(''); }} onKeyDown={e => e.key === 'Enter' && doPost()}
            placeholder="••••" style={{ textAlign: 'center', fontSize: 18, fontWeight: 800, letterSpacing: 3 }} />
        </div>
      )}
      {err && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 6 }}>{err}</div>}
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={doPost}>📢 {tr(L, 'نشر الآن', 'Pubblica ora', 'Post now')}</button>
      </div>
    </Modal>
  );
}

function ScheduledAlertsModal({ L, T, alerts, onClose, onSave }) {
  const [rows, setRows] = useState(alerts.map(a => ({ ...a })));
  const addRow = () => setRows(r => [...r, { id: uid(), text: '', dayOfWeek: 4, hour: 8, untilHour: 9, active: true }]);
  const del = (id) => setRows(r => r.filter(x => x.id !== id));
  const setR = (id, f, v) => setRows(r => r.map(x => x.id !== id ? x : { ...x, [f]: v }));
  const days = DAY_NAMES[L] || DAY_NAMES.en;

  return (
    <Modal onClose={onClose} maxWidth={560}>
      <h3>⏰ {tr(L, 'التنبيهات المجدولة الأسبوعية', 'Avvisi programmati settimanali', 'Weekly Scheduled Alerts')}</h3>
      <p className="smallmuted" style={{ marginBottom: 14 }}>
        {tr(L, 'تظهر تلقائياً على الصفحة الرئيسية في اليوم والوقت المحدد', 'Appaiono automaticamente nella dashboard al giorno e all\'ora impostati', 'Appear automatically on the dashboard on the set day and time')}
      </p>
      {rows.map(row => (
        <div key={row.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 2, margin: 0 }}>
              <label style={{ fontSize: 11 }}>{tr(L, 'اليوم', 'Giorno', 'Day')}</label>
              <select value={row.dayOfWeek} onChange={e => setR(row.id, 'dayOfWeek', Number(e.target.value))}>
                {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1, margin: 0 }}>
              <label style={{ fontSize: 11 }}>{tr(L, 'من الساعة', 'Dalle ore', 'From hour')}</label>
              <input type="number" min={0} max={23} value={row.hour} onChange={e => setR(row.id, 'hour', Number(e.target.value))} />
            </div>
            <div className="field" style={{ flex: 1, margin: 0 }}>
              <label style={{ fontSize: 11 }}>{tr(L, 'حتى الساعة', 'Fino alle', 'Until hour')}</label>
              <input type="number" min={1} max={24} value={row.untilHour ?? 24} onChange={e => setR(row.id, 'untilHour', Number(e.target.value))} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 2, cursor: 'pointer' }}>
              <input type="checkbox" checked={row.active} onChange={e => setR(row.id, 'active', e.target.checked)} />
              {tr(L, 'فعّال', 'Attivo', 'Active')}
            </label>
            <button className="danger ghost" style={{ padding: '6px 10px', marginBottom: 2 }} onClick={() => del(row.id)}>✕</button>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>{tr(L, 'نص التنبيه', 'Testo avviso', 'Alert text')}</label>
            <input value={row.text} onChange={e => setR(row.id, 'text', e.target.value)}
              placeholder={tr(L, 'مثال: أخرجوا القمامة', 'es: Portare fuori la spazzatura', 'e.g. Take out the garbage')} />
          </div>
        </div>
      ))}
      <button className="ghost" style={{ width: '100%', marginBottom: 14 }} onClick={addRow}>
        + {tr(L, 'إضافة تنبيه', 'Aggiungi avviso', 'Add alert')}
      </button>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={() => onSave(rows.filter(r => r.text.trim()))}>{T.save}</button>
      </div>
    </Modal>
  );
}

/* ---- Daily confirmation code: reminder + one-tap change (admin) ---- */
function DailyCodeCard({ state, update, today }) {
  const toast = useToast();
  const L = state.lang;
  const code = (state.dailyCodes || {})[today] || '';
  const [draft, setDraft] = useState(code);

  const save = () => {
    const v = draft.trim();
    if (!v) { toast(tr(L, 'اكتب كود اليوم', 'Inserisci il codice di oggi', 'Enter today\'s code'), true); return; }
    update({ dailyCodes: { ...(state.dailyCodes || {}), [today]: v } });
    toast(tr(L, 'تم حفظ كود اليوم', 'Codice di oggi salvato', "Today's code saved"));
  };
  const random = () => setDraft(String(Math.floor(1000 + Math.random() * 9000)));

  const notSet = !code;

  return (
    <div className="card" style={{ marginBottom: 12, borderColor: notSet ? 'var(--red)' : 'var(--yellow)', background: notSet ? 'rgba(220,38,38,0.05)' : 'rgba(242,183,5,0.05)' }}>
      <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 30 }}>🔑</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            {tr(L, 'كود التأكيد اليومي', 'Codice di conferma giornaliero', 'Daily confirmation code')}
          </div>
          <div className="smallmuted" style={{ fontSize: 12 }}>
            {notSet
              ? tr(L, '⚠️ لم يتم تعيين كود اليوم — العمال لن يقدروا يأكدوا أي عملية', '⚠️ Codice di oggi non impostato — gli operai non potranno confermare', "⚠️ Today's code not set — workers can't confirm")
              : tr(L, 'غيّره كل يوم وشاركه مع العمال شفهياً', 'Cambialo ogni giorno e comunicalo agli operai a voce', 'Change it daily and share it with workers verbally')}
          </div>
        </div>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <input
            data-dailycode="1"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="••••"
            style={{ width: 110, textAlign: 'center', fontSize: 20, fontWeight: 800, letterSpacing: 3, border: '2px solid var(--yellow)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg)' }}
          />
          <button onClick={random} title={tr(L, 'رقم عشوائي', 'Casuale', 'Random')}>🎲</button>
          <button className="primary" onClick={save}>{tr(L, 'حفظ', 'Salva', 'Save')}</button>
        </div>
      </div>
    </div>
  );
}
