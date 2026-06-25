import { useState } from 'react';
import { useStore } from '../store';
import { productCapacity } from '../helpers';

const CATS = [
  { key: 'etichette', icon: '🏷️', label: 'Etichette' },
  { key: 'liquidi',   icon: '🧪', label: 'Liquidi / Materiali' },
  { key: 'coperchi',  icon: '🎩', label: 'Coperchi' },
  { key: 'taniche',   icon: '🪣', label: 'Taniche' },
  { key: 'cartoni',   icon: '📦', label: 'Cartoni' },
  { key: 'pasta',     icon: '🍝', label: 'Pasta' },
];

export default function Shortages() {
  const { state } = useStore();
  const [target, setTarget] = useState(state.settings?.lowStock || 5);

  // Gather shortages across all products for the desired per-product target,
  // deduped per material (worst case kept), grouped by category.
  const byCat = {};
  (state.products || []).forEach(p => {
    const { shortages } = productCapacity(p, Number(target) || 0, state);
    shortages.forEach(sh => {
      const cat = byCat[sh.type] || (byCat[sh.type] = {});
      const prev = cat[sh.name];
      if (!prev || sh.missing > prev.missing) cat[sh.name] = sh;
    });
  });

  const totalCount = Object.values(byCat).reduce((s, c) => s + Object.keys(c).length, 0);

  return (
    <>
      <div className="flex-between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--brand)' }}>⚠️ Carenze (materiali mancanti)</h2>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="smallmuted" style={{ fontSize: 12 }}>Obiettivo per prodotto:</span>
          <input type="number" value={target} min={1} onChange={e => setTarget(e.target.value)} style={{ width: 90 }} />
          <span className="smallmuted" style={{ fontSize: 12 }}>bancale</span>
        </div>
      </div>

      <div className="card">
        <p className="smallmuted" style={{ marginTop: 0 }}>
          Elenco di tutto ciò che non basta per produrre <strong>{target}</strong> bancale di ogni prodotto, diviso per categoria.
        </p>
        {totalCount === 0 ? (
          <div className="empty" style={{ padding: 28 }}>✅ Nessuna carenza: le scorte coprono l'obiettivo.</div>
        ) : (
          CATS.filter(c => byCat[c.key] && Object.keys(byCat[c.key]).length).map(c => {
            const items = Object.values(byCat[c.key]).sort((a, b) => b.missing - a.missing);
            return (
              <div key={c.key} style={{ marginBottom: 18 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>
                  {c.icon} {c.label} <span className="badge bad" style={{ marginInlineStart: 6 }}>{items.length}</span>
                </h3>
                <table>
                  <thead>
                    <tr>
                      <th>Articolo</th>
                      <th>Disponibile</th>
                      <th>Serve</th>
                      <th>Manca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((sh, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{sh.name}</td>
                        <td className="mono">{Math.floor(sh.available).toLocaleString()} {sh.unit}</td>
                        <td className="mono smallmuted">{Math.ceil(sh.needed).toLocaleString()} {sh.unit}</td>
                        <td><span className="mono" style={{ color: 'var(--red)', fontWeight: 800 }}>−{Math.ceil(sh.missing).toLocaleString()} {sh.unit}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
