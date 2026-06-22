import { useEffect } from 'react';
import { useStore } from './store';
import { I18N } from './i18n';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Inventory from './components/Inventory';
import Program from './components/Program';
import History from './components/History';
import Stats from './components/Stats';
import Admin from './components/Admin';

const TABS_ADMIN = ['dashboard', 'products', 'inventory', 'program', 'history', 'stats', 'admin'];
const TABS_WORKER = ['dashboard', 'program', 'history'];

export default function App() {
  const { state, update } = useStore();
  const T = I18N[state.lang];

  useEffect(() => {
    document.documentElement.dir = T.dir;
    document.body.className = T.dir === 'ltr' ? 'ltr' : '';
  }, [T.dir]);

  if (!state.loaded) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16, color: 'var(--muted)' }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--line)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 14 }}>Caricamento...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!state.role) return <Login />;

  const tabs = state.role === 'admin' ? TABS_ADMIN : TABS_WORKER;

  return (
    <div id="app">
      <div className="hazard" />
      <header>
        <div className="logo"><img src="/logo.svg" alt="Laborchimica" /></div>
        <div className="spacer" />
        <span className="tag">{state.role === 'admin' ? T.role_admin : T.role_worker}</span>
        <select value={state.lang} onChange={e => update({ lang: e.target.value })}>
          <option value="ar">العربية</option>
          <option value="it">Italiano</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
        <button onClick={() => update({ role: null })}>{T.logout}</button>
      </header>
      <nav>
        {tabs.map(tb => (
          <button
            key={tb}
            className={state.tab === tb ? 'active' : ''}
            onClick={() => update({ tab: tb })}
          >
            {T[tb]}
          </button>
        ))}
      </nav>
      <main>
        {state.tab === 'dashboard'  && <Dashboard />}
        {state.tab === 'products'   && <Products />}
        {state.tab === 'inventory'  && <Inventory />}
        {state.tab === 'program'    && <Program />}
        {state.tab === 'history'    && <History />}
        {state.tab === 'stats'      && <Stats />}
        {state.tab === 'admin'      && <Admin />}
      </main>
    </div>
  );
}
