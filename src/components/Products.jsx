import { useState, useRef } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { I18N } from '../i18n';
import { bancaleEquivalent, stockStatus, uid } from '../helpers';
import Modal from './Modal';

export default function Products() {
  const { state, update, addLog } = useStore();
  const T = I18N[state.lang];
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  const filtered = state.products.filter(p =>
    !search || (p.name + p.company + p.code).toLowerCase().includes(search.toLowerCase())
  );

  const deleteProduct = (id) => {
    if (!confirm(T.confirm_delete)) return;
    update({ products: state.products.filter(p => p.id !== id) });
    addLog({ type: 'delete_product', detail: id });
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
                    <button className="danger" onClick={() => deleteProduct(p.id)}>{T.delete}</button>
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

function ProductModal({ existing, T, covers, baskets, companies, onClose, onSave, pastaLiquids, pastaBoxes = [], pastaLids = [] }) {
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
    isPasta: existing?.isPasta || false,
    hasSponge: existing?.hasSponge || false,
    pastaLiquidId: existing?.pastaLiquidId || '',
    pastaBoxId: existing?.pastaBoxId || '',
    pastaLidId: existing?.pastaLidId || '',
    initFront: 0,
    initBack: 0,
    initCaps: 0,
    initJerricans: 0,
  });
  const toast = useToast();
  const fileRef = useRef();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const [recipe, setRecipe] = useState(
    (existing?.recipe || []).map(r => ({ id: r.id || uid(), name: r.name, ratio: r.ratio }))
  );

  const addRecipeIngredient = () => {
    setRecipe(r => [...r, { id: uid(), name: '', ratio: '' }]);
  };

  const updateRecipeIngredient = (id, field, value) => {
    setRecipe(r => r.map(x => x.id === id ? { ...x, [field]: value } : x));
  };

  const removeRecipeIngredient = (id) => {
    setRecipe(r => r.filter(x => x.id !== id));
  };

  const handleImageFile = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('الصورة أكبر من 5MB', true); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 400;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      set('image', canvas.toDataURL('image/jpeg', 0.82));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

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
      .filter(r => r.name.trim() && Number(r.ratio) > 0)
      .map(r => ({
        id: r.id,
        name: r.name.trim(),
        ratio: Number(r.ratio) || 0
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
      name: `${form.company.trim()} - ${form.type.trim()}`,
      recipe: form.isPasta ? [] : cleanedRecipe,
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
          <label>📷 صورة المنتج</label>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => handleImageFile(e.target.files[0])} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {form.image
              ? <img src={form.image} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
              : <div style={{ width: 72, height: 72, borderRadius: 8, border: '2px dashed var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 22 }}>🖼</div>
            }
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button type="button" onClick={() => fileRef.current.click()}>اختر صورة</button>
              {form.image && <button type="button" className="ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => set('image', '')}>حذف الصورة</button>}
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
          <p className="smallmuted" style={{ margin: '0 0 8px' }}>تيكتا / بانكاله</p>
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
          <p className="smallmuted" style={{ margin: '0 0 8px' }}>غطاءات وجراكن / بانكاله</p>
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

      {!form.isPasta && (
        <>
          {/* Recipe (طريقة التحضير) */}
          <hr className="sep" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p className="smallmuted" style={{ margin: 0, fontWeight: 700 }}>🧪 طريقة التحضير (المكونات لكل 1 لتر)</p>
            <button type="button" className="primary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={addRecipeIngredient}>
              + إضافة مكون
            </button>
          </div>
          
          {recipe.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', fontStyle: 'italic', margin: '8px 0' }}>
              لا توجد مكونات مضافة لطريقة التحضير بعد.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {recipe.map((ing, idx) => (
                <div key={ing.id || idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="input-sm"
                    style={{ flex: 2 }}
                    placeholder={T.dir === 'rtl' ? 'اسم المكون (مثال: ماء، حمض...)' : 'Nome ingrediente (es: acqua, acido...)'}
                    value={ing.name}
                    onChange={e => updateRecipeIngredient(ing.id || idx, 'name', e.target.value)}
                  />
                  <input
                    className="input-sm"
                    type="number"
                    step="any"
                    style={{ flex: 1, minWidth: 80 }}
                    placeholder={T.dir === 'rtl' ? 'النسبة' : 'Proporzione'}
                    value={ing.ratio}
                    onChange={e => updateRecipeIngredient(ing.id || idx, 'ratio', e.target.value)}
                  />
                  <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', width: 45 }}>لتر/لتر</span>
                  <button
                    type="button"
                    className="ghost"
                    style={{ color: 'var(--red)', padding: '4px 8px' }}
                    onClick={() => removeRecipeIngredient(ing.id || idx)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Initial stock — only when creating */}
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
            {!form.coverId && (
              <div className="field">
                <label>{T.caps_per} — {T.stock_count} ({T.pieces})</label>
                <input type="number" value={form.initCaps} onChange={e => set('initCaps', e.target.value)} />
              </div>
            )}
            {!form.basketId && (
              <div className="field">
                <label>{T.jerricans_per} — {T.stock_count} ({T.pieces})</label>
                <input type="number" value={form.initJerricans} onChange={e => set('initJerricans', e.target.value)} />
              </div>
            )}
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
