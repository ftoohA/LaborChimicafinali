import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { todayStr } from './helpers';

const StoreContext = createContext(null);

const DEFAULTS = {
  products: [],
  programs: {},
  covers: [],
  baskets: [],
  managerNotes: {},
  settings: { wasteTicket: 4, wasteCap: 2, wasteJerrican: 1.8, lowStock: 5, wastePastaBox: 2, wastePastaLid: 2, wastePastaSponge: 2, wastePastaSpongeLid: 2, wastePastaLiquid: 2, lowStockPasta: 10 },
  dailyCodes: {},
  log: [],
  companies: [
    { id: 'c1', name: 'شركة الفجر' },
    { id: 'c2', name: 'شركة النور' },
    { id: 'c3', name: 'شركة الأمل' },
  ],
  adminPass: '',
  workerPass: '',
  workers: [],
  pastaStock: { sponges: 0, spongeLids: 0 },
  pastaLiquids: [],
  pastaBoxes: [],
  pastaLids: [],
  cartonTypes: [],   // { id, name, size, stock, lowStock, waste }
  lineaFinished:  {}, // { [productId]: bancale }  — Linea production output
  pastaFinished:  {}, // { [productId]: cartons } — Pasta carton production output
  amazonFinished: {}, // { [productId]: cartons } — Amazon processed cartons
  attendance: [],    // { id, workerId, date, clockIn, clockInPhoto, clockOut, clockOutPhoto, manual }
  breaks: {},        // { [date]: { [workerId]: "12:00 - 12:30" } } — daily break schedule (changes per day)
  warehouses: [],    // custom warehouses: { id, name, unit: 'liter'|'piece'|'carton', items: [{id,name,size,stock,lowStock,waste}] }
  announcements: [], // { id, text, photo, createdAt, active }
  scheduledAlerts: [], // { id, text, dayOfWeek (0=Sun…6=Sat), hour, active }
  manual: [],        // { id, progType, title, body, image, sizeConfigs:[{size,notes}] }
};

// Firestore document references
const REF_MAIN  = (db) => doc(db, 'factory', 'main');
const REF_PROGS = (db) => doc(db, 'factory', 'programs');
const REF_LOG   = (db) => doc(db, 'factory', 'log');

export function StoreProvider({ children }) {
  const [state, setState] = useState({
    lang: localStorage.getItem('lang') || 'it',
    role: localStorage.getItem('role') || null,
    ...DEFAULTS,
    tab: 'dashboard',
    progDate: todayStr(),
    progTypeFilter: 'all',
    loaded: false,
  });

  // keep DATA_KEYS in sync with what we save to Firestore
  // (defined here so saveToFirestore closure can reference it)

  // Prevent echo: when WE write → ignore the resulting onSnapshot for a short window
  const writingRef = useRef(false);
  const saveTimerRef = useRef(null);

  /* ── Subscribe to Firestore ── */
  useEffect(() => {
    let mainLoaded = false, progsLoaded = false, logLoaded = false;

    const markLoaded = () => {
      if (mainLoaded && progsLoaded && logLoaded) {
        setState(s => ({ ...s, loaded: true }));
      }
    };

    const unsubMain = onSnapshot(REF_MAIN(db), (snap) => {
      mainLoaded = true;
      if (!writingRef.current) {
        const d = snap.exists() ? snap.data() : {};
        setState(s => ({
          ...s,
          products:     d.products     ?? DEFAULTS.products,
          covers:       d.covers       ?? DEFAULTS.covers,
          baskets:      d.baskets      ?? DEFAULTS.baskets,
          settings:     d.settings     ?? DEFAULTS.settings,
          managerNotes: d.managerNotes ?? DEFAULTS.managerNotes,
          companies:    d.companies    ?? DEFAULTS.companies,
          adminPass:    d.adminPass    ?? DEFAULTS.adminPass,
          workerPass:   d.workerPass   ?? DEFAULTS.workerPass,
          workers:      d.workers      ?? DEFAULTS.workers,
           pastaStock:   d.pastaStock   ?? DEFAULTS.pastaStock,
          pastaLiquids: d.pastaLiquids ?? DEFAULTS.pastaLiquids,
          pastaBoxes:   d.pastaBoxes   ?? DEFAULTS.pastaBoxes,
          pastaLids:    d.pastaLids    ?? DEFAULTS.pastaLids,
          cartonTypes:   d.cartonTypes   ?? DEFAULTS.cartonTypes,
          lineaFinished: d.lineaFinished ?? d.finishedStock ?? DEFAULTS.lineaFinished,
          pastaFinished: d.pastaFinished ?? DEFAULTS.pastaFinished,
          amazonFinished:d.amazonFinished?? DEFAULTS.amazonFinished,
          attendance:    d.attendance    ?? DEFAULTS.attendance,
          breaks:       d.breaks       ?? DEFAULTS.breaks,
          warehouses:      d.warehouses      ?? DEFAULTS.warehouses,
          dailyCodes:      d.dailyCodes      ?? DEFAULTS.dailyCodes,
          announcements:   d.announcements   ?? DEFAULTS.announcements,
          scheduledAlerts: d.scheduledAlerts ?? DEFAULTS.scheduledAlerts,
          manual:          d.manual          ?? DEFAULTS.manual,
        }));
      }
      markLoaded();
    });

    const unsubProgs = onSnapshot(REF_PROGS(db), (snap) => {
      progsLoaded = true;
      if (!writingRef.current) {
        const d = snap.exists() ? snap.data() : {};
        setState(s => ({ ...s, programs: d.programs ?? DEFAULTS.programs }));
      }
      markLoaded();
    });

    const unsubLog = onSnapshot(REF_LOG(db), (snap) => {
      logLoaded = true;
      if (!writingRef.current) {
        const d = snap.exists() ? snap.data() : {};
        setState(s => ({ ...s, log: d.entries ?? DEFAULTS.log }));
      }
      markLoaded();
    });

    return () => { unsubMain(); unsubProgs(); unsubLog(); };
  }, []);

  /* ── Debounced Firestore write ── */
  const saveToFirestore = useCallback((newState) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      writingRef.current = true;
      try {
        await Promise.all([
          setDoc(REF_MAIN(db), {
            products:     newState.products,
            covers:       newState.covers,
            baskets:      newState.baskets,
            settings:     newState.settings,
            managerNotes: newState.managerNotes,
            companies:    newState.companies,
            adminPass:    newState.adminPass,
            workerPass:   newState.workerPass,
            workers:      newState.workers,
            pastaStock:   newState.pastaStock,
            pastaLiquids: newState.pastaLiquids,
            pastaBoxes:   newState.pastaBoxes,
            pastaLids:    newState.pastaLids,
            cartonTypes:   newState.cartonTypes,
            lineaFinished: newState.lineaFinished,
            pastaFinished: newState.pastaFinished,
            amazonFinished:newState.amazonFinished,
            attendance:      newState.attendance,
            breaks:          newState.breaks,
            warehouses:      newState.warehouses,
            dailyCodes:      newState.dailyCodes,
            announcements:   newState.announcements,
            scheduledAlerts: newState.scheduledAlerts,
            manual:          newState.manual,
          }),
          setDoc(REF_PROGS(db), { programs: newState.programs }),
          setDoc(REF_LOG(db),   { entries: newState.log.slice(-800) }),
        ]);
      } catch (e) {
        console.error('Firestore save error:', e);
      } finally {
        // Keep flag up a little longer so the echo snapshot is skipped
        setTimeout(() => { writingRef.current = false; }, 600);
      }
    }, 700);
  }, []);

  /* ── update() — replaces partial state and triggers save ── */
  const DATA_KEYS = new Set(['products', 'covers', 'baskets', 'programs', 'settings', 'managerNotes', 'log', 'companies', 'adminPass', 'workerPass', 'workers', 'pastaStock', 'pastaLiquids', 'pastaBoxes', 'pastaLids', 'cartonTypes', 'lineaFinished', 'pastaFinished', 'amazonFinished', 'attendance', 'breaks', 'warehouses', 'dailyCodes', 'announcements', 'scheduledAlerts', 'manual']);

  const update = useCallback((partial) => {
    setState(s => {
      const next = { ...s, ...partial };
      if (Object.keys(partial).some(k => DATA_KEYS.has(k))) {
        saveToFirestore(next);
      }
      return next;
    });
  }, [saveToFirestore]);

  /* ── addLog() ── */
  const addLog = useCallback((entry) => {
    setState(s => {
      const newLog = [...s.log, { ...entry, time: new Date().toISOString() }];
      const trimmed = newLog.length > 800 ? newLog.slice(-800) : newLog;
      const next = { ...s, log: trimmed };
      saveToFirestore(next);
      return next;
    });
  }, [saveToFirestore]);

  /* ── lang + role persist locally only ── */
  useEffect(() => { localStorage.setItem('lang', state.lang); }, [state.lang]);
  useEffect(() => {
    if (state.role) localStorage.setItem('role', state.role);
    else localStorage.removeItem('role');
  }, [state.role]);

  return (
    <StoreContext.Provider value={{ state, update, addLog }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
