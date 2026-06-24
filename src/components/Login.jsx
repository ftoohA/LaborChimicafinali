import { useState } from 'react';
import { useStore } from '../store';
import { I18N, ADMIN_PASS, WORKER_PASS } from '../i18n';

export default function Login() {
  const { state, update } = useStore();
  const T = I18N[state.lang];
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  const effectiveAdminPass  = state.adminPass  || ADMIN_PASS;
  const effectiveWorkerPass = state.workerPass || WORKER_PASS;

  const loginAdmin = () => {
    if (pass === effectiveAdminPass) update({ role: 'admin', tab: 'dashboard' });
    else setErr(T.wrong_pass);
  };

  const loginWorker = () => {
    if (!effectiveWorkerPass || pass === effectiveWorkerPass) {
      update({ role: 'worker', tab: 'dashboard' });
    } else {
      setErr(T.wrong_pass);
    }
  };

  return (
    <>
      <div className="hazard" />
      <header>
        <div className="logo"><div className="dot" />{T.title}</div>
        <div className="spacer" />
      </header>
      <div className="login-wrap">
        <div className="login-box">
          <h2>{T.title}</h2>
          <p className="smallmuted">{T.users_note}</p>
          <hr className="sep" />
          <div className="field">
            <label>{T.password}</label>
            <input
              type="password"
              placeholder="••••••"
              value={pass}
              onChange={e => { setPass(e.target.value); setErr(''); }}
              onKeyDown={e => e.key === 'Enter' && loginAdmin()}
              autoFocus
            />
          </div>
          {err && <div style={{ color: '#d6473a', fontSize: 13, marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ flex: 1 }} onClick={loginWorker}>{T.role_worker}</button>
            <button className="primary" style={{ flex: 1 }} onClick={loginAdmin}>{T.role_admin}</button>
          </div>
        </div>
      </div>
    </>
  );
}
