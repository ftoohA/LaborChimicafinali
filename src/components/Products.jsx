import { useState, useRef } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { I18N } from '../i18n';
import { bancaleEquivalent, stockStatus, uid } from '../helpers';
import Modal from './Modal';

export default function Products() {
  const { state, update, addLog } = useStore();
  const T = I18N[state.lang];
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  const filtered = state.products.filter(p =>
    !search || (p.name + p.company + p.code).toLowerCase().includes(search.toLowerCase())
  );

  const deleteProduct = async (p) => {
    if (!(await confirm({ danger: true, title: T.confirm_delete, message: p.name }))) return;
    update({ products: state.products.filter(x => x.id !== p.id) });
    addLog({ type: 'delete_product', detail: p.id });
    toast(T.deleted);
  };

  return (
    <>
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <input placeholder={T.search} value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
        {state.role === 'admin' && (
          <button className="primary" onClick={() => setEditing(false)}>+ {T.add_product}</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{T.no_products}</div>
      ) : (
        <div className="grid cols-3">
          {filtered.map(p => {
            const be = bancaleEquivalent(p, p.stock, state.covers, state.baskets, state.pastaStock, state.pastaLiquids, state.settings, state.pastaBoxes, state.pastaLids);
            const st = stockStatus(be, state.settings.lowStock);
            const cv = state.covers.find(x => x.id === p.coverId);
            const bk = state.baskets.find(x => x.id === p.basketId);
            return (
              <div className="card" key={p.id}>
                <div className="row">
                  {p.image
                    ? <img src={p.image} className="prodimg" alt="" />
                    : <div className="prodimg row" style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 11 }}>{T.no_image}</div>}
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div className="smallmuted">{p.company} · {p.type} · {p.liter}L</div>
                  </div>
                </div>
                <hr className="sep" />
                <div className="smallmuted mono">{T.code}: {p.code} | {T.barcode}: {p.barcode || '-'}</div>
                {/* cover / basket chips */}
                <div className="row" style={{ marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
                  {cv && (
                    <span title={T.cover_for_product}>
                      🎩 <span className="color-chip">{cv.color}</span>
                      {cv.size && <span className="size-chip" style={{ marginInlineStart: 4 }}>{cv.size}</span>}
                    </span>
                  )}
                  {bk && (
                    <span title={T.basket_for_product}>
                      🪣 <span className="color-chip">{bk.color}</span>
                      {bk.size && <span className="size-chip" style={{ marginInlineStart: 4 }}>{bk.size}</span>}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span className={`badge ${st}`}>
                    {be.toFixed(1)} {p.isPasta ? (state.lang === 'ar' ? 'كرتونة' : state.lang === 'it' ? 'Cartoni' : 'Cartons') : T.bancale_equiv}
                  </span>
                  {p.isPasta && (
                    <>
                      <span className="badge blue" style={{ marginInlineStart: 6, fontSize: 10 }}>
                        {state.lang === 'ar' ? 'باستا' : 'Pasta'}
                      </span>
                      {(() => {
                        const pl = state.pastaLiquids?.find(x => x.id === p.pastaLiquidId);
                        const pb = state.pastaBoxes?.find(x => x.id === p.pastaBoxId);
                        const plid = state.pastaLids?.find(x => x.id === p.pastaLidId);
                        return (
                          <>
                            {pl && (
                              <span className="badge warning" style={{ marginInlineStart: 6, fontSize: 10 }}>
                                🧪 {pl.name}
                              </span>
                            )}
                            {pb && (
                              <span className="badge blue" style={{ marginInlineStart: 6, fontSize: 10 }}>
                                📦 {pb.name}
                              </span>
                            )}
                            {plid && (
                              <span className="badge blue" style={{ marginInlineStart: 6, fontSize: 10 }}>
                                🔴 {plid.name}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </>
                  )}
                </div>
                {state.role === 'admin' && (
                  <div className="row" style={{ marginTop: 10 }}>
                    <button onClick={() => setEditing(p)}>{T.edit}</button>
                    <button className="danger" onClick={() => deleteProduct(p)}>{T.delete}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <ProductModal
          existing={editing || null}
          T={T}
          covers={state.covers}
          baskets={state.baskets}
          companies={state.companies}
          pastaLiquids={state.pastaLiquids}
          pastaBoxes={state.pastaBoxes}
          pastaLids={state.pastaLids}
          cartonTypes={state.cartonTypes}
          warehouses={state.warehouses}
          onClose={() => setEditing(null)}
          onSave={(prod) => {
            if (editing) {
              update({ products: state.products.map(p => p.id === prod.id ? prod : p) });
            } else {
              update({ products: [...state.products, prod] });
            }
            addLog({ type: 'product_saved', product: prod.code });
            toast(T.success_added);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ProductModal({ existing, T, covers, baskets, companies, onClose, onSave, pastaLiquids, pastaBoxes = [], pastaLids = [], cartonTypes = [], warehouses = [] }) {
  // Ingredient options = non-piece warehouses (liquids in L/ml, powders in kg/g)
  const PREP_UNITS = ['liter', 'ml', 'kg', 'g'];
  const UNIT_LBL = { liter: 'L', ml: 'ml', kg: 'kg', g: 'g', carton: 'cart.', piece: 'pz' };
  const prepOptions = warehouses
    .filter(w => PREP_UNITS.includes(w.unit))
    .map(w => ({ warehouseId: w.id, name: w.name, unit: w.unit }));
  const [form, setForm] = useState({
    company: existing?.company || '',
    type: existing?.type || '',
    liter: existing?.liter ?? 5,
    code: existing?.code || '',
    barcode: existing?.barcode || '',
    image: existing?.image || '',
    ticketsFront: existing?.ticketsFront ?? 90,
    ticketsBack: existing?.ticketsBack ?? 0,
    capsPer: existing?.capsPer ?? 128,
    jerricansPer: existing?.jerricansPer ?? 128,
    coverId: existing?.coverId || '',
    basketId: existing?.basketId || '',
    hasCarton: existing?.hasCarton || false,
    cartonId: existing?.cartonId || '',
    isPasta: existing?.isPasta || false,
    hasSponge: existing?.hasSponge || false,
    pastaLiquidId: existing?.pastaLiquidId || '',
    pastaBoxId: existing?.pastaBoxId || '',
    pastaLidId: existing?.pastaLidId || '',
    liquidWaste: existing?.liquidWaste ?? 2,
    prepSteps: existing?.prepSteps || '',
    prepImage: existing?.prepImage || '',
    initFront: 0,
    initBack: 0,
    initCaps: 0,
    initJerricans: 0,
  });
  const toast = useToast();
  const fileRef = useRef();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const [recipe, setRecipe] = useState(
    (existing?.recipe || []).map(r => ({ id: r.id || uid(), name: r.name || '', percent: r.percent ?? '', warehouseId: r.warehouseId || '', unit: r.unit || '' }))
  );

  const addRecipeIngredient = () => {
    setRecipe(r => [...r, { id: uid(), name: '', percent: '', warehouseId: '', unit: '' }]);
  };

  const updateRecipeIngredient = (id, field, value) => {
    setRecipe(r => r.map(x => x.id === id ? { ...x, [field]: value } : x));
  };

  const pickRecipeSource = (id, key) => {
    const opt = prepOptions.find(o => o.warehouseId === key);
    setRecipe(r => r.map(x => x.id !== id ? x : opt
      ? { ...x, warehouseId: opt.warehouseId, name: opt.name, unit: opt.unit }
      : { ...x, warehouseId: '', unit: '' }));
  };

  const removeRecipeIngredient = (id) => {
    setRecipe(r => r.filter(x => x.id !== id));
  };

  const totalPercent = recipe.reduce((s, r) => s + (Number(r.percent) || 0), 0);

  const compressTo = (file, key, max = 400) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Immagine oltre 5MB', true); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      set(key, canvas.toDataURL('image/jpeg', 0.82));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  const handleImageFile = (file) => compressTo(file, 'image', 400);
  const prepFileRef = useRef();

  // Group covers/baskets by color for display
  const coversByColor = covers.reduce((acc, c) => {
    const key = c.color || '—';
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  const handleSave = () => {
    if (!form.company.trim() || !form.code.trim()) {
      toast(`${T.company} / ${T.code} required`, true);
      return;
    }
    const cleanedRecipe = recipe
      .filter(r => r.name.trim() && Number(r.percent) > 0)
      .map(r => ({
        id: r.id,
        name: r.name.trim(),
        percent: Number(r.percent) || 0,
        warehouseId: r.warehouseId || '',
        unit: r.unit || '',
      }));

    onSave({
      id: existing?.id || uid(),
      company: form.company.trim(),
      type: form.type.trim(),
      liter: Number(form.liter) || 0,
      code: form.code.trim(),
      barcode: form.barcode.trim(),
      image: form.image.trim(),
      ticketsFront: form.isPasta ? 0 : (Number(form.ticketsFront) || 0),
      ticketsBack: form.isPasta ? 0 : (Number(form.ticketsBack) || 0),
      capsPer: form.isPasta ? 0 : (Number(form.capsPer) || 0),
      jerricansPer: form.isPasta ? 0 : (Number(form.jerricansPer) || 0),
      coverId: form.isPasta ? null : (form.coverId || null),
      basketId: form.isPasta ? null : (form.basketId || null),
      hasCarton: form.isPasta ? false : !!form.hasCarton,
      cartonId: (!form.isPasta && form.hasCarton) ? (form.cartonId || null) : null,
      name: `${form.company.trim()} - ${form.type.trim()}`,
      recipe: cleanedRecipe,
      liquidWaste: Number(form.liquidWaste) || 0,
      prepSteps: (form.prepSteps || '').trim(),
      prepImage: form.prepImage || '',
      isPasta: !!form.isPasta,
      hasSponge: !!form.isPasta && !!form.hasSponge,
      pastaLiquidId: form.isPasta ? form.pastaLiquidId : null,
      pastaBoxId: form.isPasta ? form.pastaBoxId : null,
      pastaLidId: form.isPasta ? form.pastaLidId : null,
      stock: existing?.stock || {
        ticketsFront: Number(form.initFront) || 0,
        ticketsBack:  Number(form.initBack)  || 0,
        caps:         Number(form.initCaps)  || 0,
        jerricans:    Number(form.initJerricans) || 0,
      },
    });
  };

  return (
    <Modal onClose={onClose} maxWidth={600}>
      <h3>{existing ? T.edit : T.add_product}</h3>

      {/* Basic info */}
      <div className="grid cols-2">
        <div className="field">
          <label>{T.company}</label>
          <select value={form.company} onChange={e => set('company', e.target.value)}>
            <option value="">— {T.company} —</option>
            {(companies || []).map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        {[['type', T.type, 'text'],
          ['liter', T.liter, 'number'], ['code', T.code, 'text'],
          ['barcode', T.barcode, 'text']].map(([k, label, typ]) => (
          <div className="field" key={k}>
            <label>{label}</label>
            <input type={typ} value={form[k]} onChange={e => set(k, e.target.value)} />
          </div>
        ))}
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>📷 Immagine prodotto</label>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => handleImageFile(e.target.files[0])} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {form.image
              ? <img src={form.image} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
              : <div style={{ width: 72, height: 72, borderRadius: 8, border: '2px dashed var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 22 }}>🖼</div>
            }
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button type="button" onClick={() => fileRef.current.click()}>Scegli immagine</button>
              {form.image && <button type="button" className="ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => set('image', '')}>Rimuovi immagine</button>}
            </div>
          </div>
        </div>
      </div>

      {/* Pasta settings */}
      <hr className="sep" />
      <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 'bold' }}>
          <input 
            type="checkbox" 
            checked={form.isPasta} 
            onChange={e => {
              set('isPasta', e.target.checked);
              if (!e.target.checked) set('hasSponge', false);
            }} 
            style={{ width: 18, height: 18 }}
          />
          {T.dir === 'rtl' ? 'هل المنتج باستا؟ (Pasta Abrasiva)' : 'Is this product Pasta?'}
        </label>

        {!form.isPasta && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 'bold' }}>
            <input
              type="checkbox"
              checked={form.hasCarton}
              onChange={e => set('hasCarton', e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            📦 {T.dir === 'rtl' ? 'هل المنتج له كرتونة؟' : 'Has a carton?'}
          </label>
        )}

        {form.isPasta && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 'bold' }}>
            <input 
              type="checkbox" 
              checked={form.hasSponge} 
              onChange={e => set('hasSponge', e.target.checked)} 
              style={{ width: 18, height: 18 }}
            />
            {T.dir === 'rtl' ? 'هل يحتاج إسفنجة وغطاء إسفنجة؟' : 'Requires sponge & sponge lid?'}
          </label>
        )}
      </div>

      {!form.isPasta && form.hasCarton && (
        <div className="field" style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 'bold' }}>📦 {T.dir === 'rtl' ? 'نوع الكرتونة (من المخزن)' : 'Carton type (from warehouse)'}</label>
          <select value={form.cartonId} onChange={e => set('cartonId', e.target.value)}>
            <option value="">— {T.dir === 'rtl' ? 'اختر الكرتونة' : 'Select carton'} —</option>
            {(cartonTypes || []).map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.size ? ` (${c.size})` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {form.isPasta && (
        <>
          <div className="field" style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 'bold' }}>🧪 {T.dir === 'rtl' ? 'سائل الباستا المستخدم (من المخزن)' : 'Used Pasta Liquid'}</label>
            <select 
              value={form.pastaLiquidId} 
              onChange={e => set('pastaLiquidId', e.target.value)}
            >
              <option value="">— {T.dir === 'rtl' ? 'اختر سائل الباستا' : 'Select Pasta Liquid'} —</option>
              {(pastaLiquids || []).map(pl => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} [{(pl.stock || 0).toLocaleString()} {T.dir === 'rtl' ? 'لتر' : 'L'}]
                </option>
              ))}
            </select>
          </div>

          <div className="grid cols-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label style={{ fontWeight: 'bold' }}>📦 {T.dir === 'rtl' ? 'نوع العلبة' : 'Box Type'}</label>
              <select 
                value={form.pastaBoxId} 
                onChange={e => set('pastaBoxId', e.target.value)}
              >
                <option value="">— {T.dir === 'rtl' ? 'اختر نوع العلبة' : 'Select Box Type'} —</option>
                {(pastaBoxes || []).map(pb => (
                  <option key={pb.id} value={pb.id}>
                    {pb.name} [{(pb.stock || 0).toLocaleString()} {T.dir === 'rtl' ? 'قطعة' : 'pcs'}]
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label style={{ fontWeight: 'bold' }}>🔴 {T.dir === 'rtl' ? 'نوع الغطاء' : 'Lid Type'}</label>
              <select 
                value={form.pastaLidId} 
                onChange={e => set('pastaLidId', e.target.value)}
              >
                <option value="">— {T.dir === 'rtl' ? 'اختر نوع الغطاء' : 'Select Lid Type'} —</option>
                {(pastaLids || []).map(pl => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} [{(pl.stock || 0).toLocaleString()} {T.dir === 'rtl' ? 'قطعة' : 'pcs'}]
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      {!form.isPasta && (
        <>
          {/* Labels per bancale */}
          <hr className="sep" />
          <p className="smallmuted" style={{ margin: '0 0 8px' }}>Etichette / bancale</p>
          <div className="grid cols-2">
            <div className="field">
              <label>{T.tickets_front}</label>
              <input type="number" value={form.ticketsFront} onChange={e => set('ticketsFront', e.target.value)} />
            </div>
            <div className="field">
              <label>{T.tickets_back}</label>
              <input type="number" value={form.ticketsBack} onChange={e => set('ticketsBack', e.target.value)} />
            </div>
          </div>

          {/* Covers & baskets */}
          <hr className="sep" />
          <p className="smallmuted" style={{ margin: '0 0 8px' }}>Coperchi e taniche / bancale</p>
          <div className="grid cols-2">
            <div className="field">
              <label>{T.caps_per} ({T.pieces})</label>
              <input type="number" value={form.capsPer} onChange={e => set('capsPer', e.target.value)} />
            </div>
            <div className="field">
              <label>{T.jerricans_per} ({T.pieces})</label>
              <input type="number" value={form.jerricansPer} onChange={e => set('jerricansPer', e.target.value)} />
            </div>
          </div>

          {/* Cover selector */}
          <div className="field">
            <label>🎩 {T.cover_for_product}</label>
            <select value={form.coverId} onChange={e => set('coverId', e.target.value)}>
              <option value="">{T.no_cover}</option>
              {Object.entries(coversByColor).map(([color, items]) => (
                <optgroup key={color} label={`${T.color}: ${color}`}>
                  {items.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.size || '?'} [{(c.stock || 0).toLocaleString()} {T.pieces}]
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Basket selector */}
          <div className="field">
            <label>🪣 {T.basket_for_product}</label>
            <select value={form.basketId} onChange={e => set('basketId', e.target.value)}>
              <option value="">{T.no_basket}</option>
              {baskets.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.size || '?'} · {b.color || '—'} [{(b.stock || 0).toLocaleString()} {T.pieces}]
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {(() => {
        // Base liquid/material volume per bancale: pasta = 12 cartoni × L, Linea = taniche × L
        const litersPerBancale = form.isPasta
          ? 12 * (Number(form.liter) || 0)
          : (Number(form.jerricansPer) || 0) * (Number(form.liter) || 0);
        return (
        <>
          {/* Composition from prep warehouses (% per ingredient) — liquids & powders */}
          <hr className="sep" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <p className="smallmuted" style={{ margin: 0, fontWeight: 700 }}>🧪 Composizione (materiali · % per ingrediente)</p>
            <button type="button" className="primary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={addRecipeIngredient}>
              + Aggiungi materiale
            </button>
          </div>
          <p className="smallmuted" style={{ fontSize: 11, margin: '0 0 8px' }}>
            Scegli i materiali dai magazzini (liquidi in L/ml, polveri in kg/g) e indica la % di ciascuno (totale 100%).
            Alla produzione: {+litersPerBancale.toFixed(3)} L (≈ {Math.round(litersPerBancale * 1000)} ml/g) per bancale, ripartiti per % + scarto, scalati dal magazzino.
          </p>

          {recipe.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', fontStyle: 'italic', margin: '8px 0' }}>
              Nessun liquido aggiunto.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
              {recipe.map((ing) => {
                const curKey = ing.warehouseId || '';
                return (
                <div key={ing.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {prepOptions.length > 0 && (
                    <select className="input-sm" style={{ flex: 1, minWidth: 120 }} value={curKey} onChange={e => pickRecipeSource(ing.id, e.target.value)}>
                      <option value="">✏️ Manuale</option>
                      {prepOptions.map(o => <option key={o.warehouseId} value={o.warehouseId}>{o.name} ({UNIT_LBL[o.unit] || o.unit})</option>)}
                    </select>
                  )}
                  <input
                    className="input-sm"
                    style={{ flex: 2, minWidth: 110 }}
                    placeholder="Nome ingrediente"
                    value={ing.name}
                    onChange={e => updateRecipeIngredient(ing.id, 'name', e.target.value)}
                    disabled={!!curKey}
                  />
                  <input
                    className="input-sm"
                    type="number"
                    step="any"
                    style={{ width: 80 }}
                    placeholder="%"
                    value={ing.percent}
                    onChange={e => updateRecipeIngredient(ing.id, 'percent', e.target.value)}
                  />
                  <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', width: 16 }}>%</span>
                  {ing.unit && <span className="badge" style={{ fontSize: 10 }}>{UNIT_LBL[ing.unit] || ing.unit}</span>}
                  <button type="button" className="ghost" style={{ color: 'var(--red)', padding: '4px 8px' }} onClick={() => removeRecipeIngredient(ing.id)}>✕</button>
                </div>
                );
              })}
            </div>
          )}

          {recipe.length > 0 && (
            <div style={{ textAlign: 'end', fontSize: 12, marginBottom: 10, fontWeight: 700, color: totalPercent === 100 ? 'var(--green)' : 'var(--orange)' }}>
              Totale: {totalPercent}% {totalPercent === 100 ? '✓' : `(${totalPercent > 100 ? '−' : '+'}${Math.abs(100 - totalPercent)}% per 100%)`}
            </div>
          )}

          <div className="field" style={{ maxWidth: 220 }}>
            <label>♻️ Scarto materiale %</label>
            <input type="number" step="any" value={form.liquidWaste} onChange={e => set('liquidWaste', e.target.value)} />
          </div>

          {/* Preparation steps (shown to the chemist in the Chimico program) */}
          <div className="field">
            <label>📝 {T.dir === 'rtl' ? 'خطوات التحضير الكاملة (للكيميائي)' : 'Passaggi di preparazione (per il chimico)'}</label>
            <textarea value={form.prepSteps} onChange={e => set('prepSteps', e.target.value)} style={{ minHeight: 90 }}
              placeholder={T.dir === 'rtl' ? 'اكتب خطوات التحضير بالترتيب...' : 'Scrivi i passaggi di preparazione in ordine...'} />
          </div>
          <div className="field">
            <label>🖼 {T.dir === 'rtl' ? 'صورة التحضير (اختياري)' : 'Immagine preparazione (opzionale)'}</label>
            <input ref={prepFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => compressTo(e.target.files[0], 'prepImage', 700)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {form.prepImage && <img src={form.prepImage} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />}
              <button type="button" onClick={() => prepFileRef.current?.click()}>📷 {T.dir === 'rtl' ? 'اختر صورة' : 'Scegli immagine'}</button>
              {form.prepImage && <button type="button" className="ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => set('prepImage', '')}>✕</button>}
            </div>
          </div>
        </>
        );
      })()}

      {/* Initial label stock — only when creating a new product */}
      {!existing && !form.isPasta && (
        <>
          <hr className="sep" />
          <p className="smallmuted" style={{ margin: '0 0 8px' }}>📦 {T.initial_stock}</p>
          <div className="grid cols-2">
            <div className="field">
              <label>{T.tickets_front} ({T.pieces})</label>
              <input type="number" value={form.initFront} onChange={e => set('initFront', e.target.value)} />
            </div>
            <div className="field">
              <label>{T.tickets_back} ({T.pieces})</label>
              <input type="number" value={form.initBack} onChange={e => set('initBack', e.target.value)} />
            </div>
          </div>
        </>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose}>{T.cancel}</button>
        <button className="primary" onClick={handleSave}>{T.save}</button>
      </div>
    </Modal>
  );
}
