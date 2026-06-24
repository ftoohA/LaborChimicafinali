import { useState, useRef } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import { uid } from '../helpers';
import Modal from './Modal';

const tr = (L, ar, it, en) => (L === 'ar' ? ar : L === 'it' ? it : en);

const PROG_LABELS = {
  daily:    { icon: '🔵', ar: 'Linea', it: 'Linea', en: 'Linea' },
  location: { icon: '🟢', ar: 'Chimico', it: 'Chimico', en: 'Chimico' },
  brazer:   { icon: '🟡', ar: 'Pasta', it: 'Pasta', en: 'Pasta' },
  amazon:   { icon: '🟠', ar: 'Amazon', it: 'Amazon', en: 'Amazon' },
  macro:    { icon: '🔴', ar: 'Marco', it: 'Marco', en: 'Marco' },
  general:  { icon: '📖', ar: 'عام', it: 'Generale', en: 'General' },
};

const ALL_TYPES = ['general', 'daily', 'location', 'brazer', 'amazon', 'macro'];

export default function Manual() {
  const { state, update } = useStore();
  const L = state.lang;
  const toast = useToast();
  const isAdmin = state.role === 'admin';

  const [activeType, setActiveType] = useState('general');
  const [editing, setEditing] = useState(null);    // null | false | section obj
  const [viewing, setViewing] = useState(null);     // section to view detail

  const manual = state.manual || [];
  const sections = manual.filter(s => s.progType === activeType);

  const saveSection = (sec) => {
    if (sec.id && manual.find(s => s.id === sec.id)) {
      update({ manual: manual.map(s => s.id === sec.id ? sec : s) });
    } else {
      update({ manual: [...manual, { ...sec, id: sec.id || uid() }] });
    }
    toast(tr(L, 'تم الحفظ', 'Salvato', 'Saved'));
    setEditing(null);
  };

  const deleteSection = (id) => {
    if (!confirm(tr(L, 'حذف هذا القسم؟', 'Eliminare questa sezione?', 'Delete this section?'))) return;
    update({ manual: manual.filter(s => s.id !== id) });
    toast(tr(L, 'تم الحذف', 'Eliminato', 'Deleted'));
    if (viewing?.id === id) setViewing(null);
  };

  return (
    <>
      <div className="flex-between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--brand)' }}>
          📖 {tr(L, 'دليل المصنع', 'Manuale di fabbrica', 'Factory Guide')}
        </h2>
        {isAdmin && (
          <button className="primary" onClick={() => setEditing({ progType: activeType })}>
            + {tr(L, 'إضافة قسم', 'Aggiungi sezione', 'Add Section')}
          </button>
        )}
      </div>

      {/* Type tabs */}
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {ALL_TYPES.map(t => {
          const lbl = PROG_LABELS[t];
          return (
            <button key={t}
              className={activeType === t ? 'primary' : 'ghost'}
              style={{ fontSize: 13, padding: '6px 14px' }}
              onClick={() => { setActiveType(t); setViewing(null); }}>
              {lbl.icon} {lbl[L] || lbl.en}
            </button>
          );
        })}
      </div>

      {viewing ? (
        <SectionDetail L={L} section={viewing} isAdmin={isAdmin}
          onBack={() => setViewing(null)}
          onEdit={() => setEditing(viewing)}
          onDelete={() => deleteSection(viewing.id)} />
      ) : (
        <>
          {sections.length === 0 ? (
            <div className="card">
              <div className="empty" style={{ padding: 32 }}>
                {isAdmin
                  ? tr(L, 'لا يوجد محتوى بعد. اضغط "+ إضافة قسم" لإضافة معلومات.', 'Nessun contenuto ancora. Premi "+ Aggiungi sezione" per iniziare.', 'No content yet. Press "+ Add Section" to start.')
                  : tr(L, 'لا يوجد محتوى في هذا القسم بعد.', 'Nessun contenuto in questa sezione.', 'No content in this section yet.')}
              </div>
            </div>
          ) : (
            <div className="grid cols-2" style={{ gap: 12 }}>
              {sections.map(sec => (
                <div key={sec.id} className="card" style={{ cursor: 'pointer', padding: 0, overflow: 'hidden', transition: 'box-shadow .15s' }}
                  onClick={() => setViewing(sec)}>
                  {sec.image && (
                    <img src={sec.image} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                  )}
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{sec.title}</div>
                    {sec.body && (
                      <div className="smallmuted" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {sec.body}
                      </div>
                    )}
                    {sec.sizeConfigs?.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {sec.sizeConfigs.map(sc => (
                          <span key={sc.size} className="size-chip">{sc.size}</span>
                        ))}
                      </div>
                    )}
                    {isAdmin && (
                      <div className="row" style={{ gap: 6, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                        <button className="ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setEditing(sec)}>✏️ {tr(L, 'تعديل', 'Modifica', 'Edit')}</button>
                        <button className="danger ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => deleteSection(sec.id)}>🗑️</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editing !== null && (
        <SectionEditModal L={L} section={editing || null} activeType={activeType}
          onClose={() => setEditing(null)}
          onSave={saveSection} />
      )}
    </>
  );
}

function SectionDetail({ L, section, isAdmin, onBack, onEdit, onDelete }) {
  const [activeSize, setActiveSize] = useState(section.sizeConfigs?.[0]?.size || null);
  const [zoom, setZoom] = useState(null);
  const currentConfig = section.sizeConfigs?.find(sc => sc.size === activeSize);

  return (
    <div className="card">
      <div className="row" style={{ gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <button className="ghost" onClick={onBack}>← {tr(L, 'رجوع', 'Indietro', 'Back')}</button>
        {isAdmin && (
          <>
            <button className="ghost" style={{ fontSize: 12 }} onClick={onEdit}>✏️ {tr(L, 'تعديل', 'Modifica', 'Edit')}</button>
            <button className="danger ghost" style={{ fontSize: 12 }} onClick={onDelete}>🗑️</button>
          </>
        )}
      </div>

      {section.image && (
        <img src={section.image} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 10, marginBottom: 16 }} />
      )}

      <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>{section.title}</h2>

      {section.body && (
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: 'var(--text)', marginBottom: 16 }}>{section.body}</p>
      )}

      <AttachmentsView L={L} attachments={section.attachments} onZoom={setZoom} />

      {section.sizeConfigs?.length > 0 && (
        <>
          <h3 style={{ marginBottom: 10, color: 'var(--muted)', fontSize: 14 }}>
            {tr(L, 'إعدادات حسب الحجم:', 'Configurazione per dimensione:', 'Config by size:')}
          </h3>
          <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {section.sizeConfigs.map(sc => (
              <button key={sc.size}
                className={activeSize === sc.size ? 'primary' : 'ghost'}
                style={{ padding: '6px 16px', fontWeight: 700 }}
                onClick={() => setActiveSize(sc.size)}>
                {sc.size}
              </button>
            ))}
          </div>
          {currentConfig && (
            <div className="card" style={{ background: 'var(--panel)', margin: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>⚙️ {activeSize}</div>
              <AttachmentsView L={L} attachments={getAttachments(currentConfig)} onZoom={setZoom} />
              {currentConfig.notes && <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, margin: 0 }}>{currentConfig.notes}</p>}
            </div>
          )}
        </>
      )}

      {zoom && (
        <div onClick={() => setZoom(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, cursor: 'zoom-out' }}>
          <img src={zoom} alt="" style={{ maxWidth: '95%', maxHeight: '95%', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}

function SectionEditModal({ L, section, activeType, onClose, onSave }) {
  const toast = useToast();
  const fileRef = useRef();

  const [f, setF] = useState({
    id: section?.id || uid(),
    progType: section?.progType || activeType,
    title: section?.title || '',
    body: section?.body || '',
    image: section?.image || '',
    attachments: section?.attachments ? [...section.attachments] : [],
    sizeConfigs: section?.sizeConfigs ? section.sizeConfigs.map(sc => ({
      size: sc.size || '',
      notes: sc.notes || '',
      // migrate legacy single `image` into the attachments array
      attachments: sc.attachments ? [...sc.attachments] : (sc.image ? [{ id: uid(), kind: 'image', data: sc.image }] : []),
    })) : [],
  });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const compress = (file, cb) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      const sc = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', 0.75));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const addSize = () => set('sizeConfigs', [...f.sizeConfigs, { size: '', notes: '', attachments: [] }]);
  const delSize = (i) => set('sizeConfigs', f.sizeConfigs.filter((_, idx) => idx !== i));
  const setSize = (i, field, val) => set('sizeConfigs', f.sizeConfigs.map((sc, idx) => idx !== i ? sc : { ...sc, [field]: val }));

  const handleSave = () => {
    if (!f.title.trim()) { toast(tr(L, 'العنوان مطلوب', 'Titolo obbligatorio', 'Title required'), true); return; }
    onSave({ ...f, sizeConfigs: f.sizeConfigs.filter(sc => sc.size.trim()) });
  };

  return (
    <Modal onClose={onClose} maxWidth={600}>
      <h3>{section?.id ? tr(L, 'تعديل القسم', 'Modifica sezione', 'Edit Section') : tr(L, 'إضافة قسم جديد', 'Nuova sezione', 'New Section')}</h3>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => compress(e.target.files?.[0], img => set('image', img))} />

      <div className="field">
        <label>{tr(L, 'نوع البرنامج', 'Tipo programma', 'Program type')}</label>
        <select value={f.progType} onChange={e => set('progType', e.target.value)}>
          {ALL_TYPES.map(t => <option key={t} value={t}>{PROG_LABELS[t].icon} {PROG_LABELS[t][L] || PROG_LABELS[t].en}</option>)}
        </select>
      </div>

      <div className="field">
        <label>{tr(L, 'العنوان', 'Titolo', 'Title')}</label>
        <input autoFocus value={f.title} onChange={e => set('title', e.target.value)} placeholder={tr(L, 'مثال: ماكينة التعبئة', 'es: Macchina di riempimento', 'e.g. Filling machine')} />
      </div>

      <div className="field">
        <label>{tr(L, 'الصورة الرئيسية', 'Immagine principale', 'Main image')}</label>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          {f.image && <img src={f.image} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />}
          <button type="button" onClick={() => fileRef.current?.click()}>📷 {tr(L, 'اختر صورة', 'Scegli immagine', 'Choose image')}</button>
          {f.image && <button type="button" className="danger ghost" onClick={() => set('image', '')}>✕</button>}
        </div>
      </div>

      <div className="field">
        <label>{tr(L, 'الوصف / التفاصيل', 'Descrizione / dettagli', 'Description / details')}</label>
        <textarea value={f.body} onChange={e => set('body', e.target.value)} style={{ minHeight: 90 }}
          placeholder={tr(L, 'اكتب هنا طريقة الاستخدام والنصائح...', 'Scrivi qui le istruzioni e i consigli...', 'Write usage instructions and tips here...')} />
      </div>

      <div className="field">
        <label>📎 {tr(L, 'مرفقات إضافية (صور وملفات)', 'Allegati extra (immagini e file)', 'Extra attachments (images & files)')}</label>
        <AttachmentsEditor L={L} attachments={f.attachments} onChange={(arr) => set('attachments', arr)} />
      </div>

      {/* Size configs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontWeight: 700 }}>{tr(L, 'إعدادات حسب الحجم (اختياري)', 'Configurazione per dimensione (opzionale)', 'Size-specific config (optional)')}</label>
        <button type="button" className="primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={addSize}>
          + {tr(L, 'حجم', 'Dimensione', 'Size')}
        </button>
      </div>
      {f.sizeConfigs.map((sc, i) => (
        <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <div className="field" style={{ flex: 1, margin: 0 }}>
              <label style={{ fontSize: 11 }}>{tr(L, 'الحجم', 'Dimensione', 'Size')}</label>
              <input value={sc.size} onChange={e => setSize(i, 'size', e.target.value)} placeholder="5L / 2L ..." />
            </div>
            <button className="danger ghost" style={{ marginTop: 22, padding: '6px 10px' }} onClick={() => delSize(i)}>✕</button>
          </div>
          <div className="field" style={{ margin: '0 0 8px' }}>
            <label style={{ fontSize: 11 }}>{tr(L, 'صور وملفات', 'Immagini e file', 'Images & files')}</label>
            <AttachmentsEditor L={L} attachments={sc.attachments || []} onChange={(arr) => setSize(i, 'attachments', arr)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>{tr(L, 'التفاصيل لهذا الحجم', 'Dettagli per questa dimensione', 'Details for this size')}</label>
            <textarea value={sc.notes} onChange={e => setSize(i, 'notes', e.target.value)} style={{ minHeight: 70 }}
              placeholder={tr(L, 'الإعدادات والنصائح الخاصة بهذا الحجم...', 'Impostazioni e consigli per questa dimensione...', 'Settings and tips for this size...')} />
          </div>
        </div>
      ))}

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button onClick={onClose}>{tr(L, 'إلغاء', 'Annulla', 'Cancel')}</button>
        <button className="primary" onClick={handleSave}>{tr(L, 'حفظ', 'Salva', 'Save')}</button>
      </div>
    </Modal>
  );
}

/* ---- Attachments (images + arbitrary files) ---- */
// Merge legacy single `image` field into the attachments array for display
function getAttachments(obj) {
  const arr = obj?.attachments ? [...obj.attachments] : [];
  if (obj?.image) arr.unshift({ id: 'legacy', kind: 'image', data: obj.image });
  return arr;
}

function downloadAttachment(att) {
  const a = document.createElement('a');
  a.href = att.data;
  a.download = att.name || 'file';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function AttachmentsEditor({ L, attachments = [], onChange }) {
  const toast = useToast();
  const imgRef = useRef();
  const fileRef = useRef();

  const compressImg = (file, cb) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1000;
      const sc = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', 0.72));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const addImage = (file) => {
    if (!file) return;
    compressImg(file, data => onChange([...attachments, { id: uid(), kind: 'image', name: file.name?.slice(0, 40) || '', data }]));
  };
  const addFile = (file) => {
    if (!file) return;
    if (file.size > 900 * 1024) { toast(tr(L, 'الملف كبير جداً (أقصى 900KB)', 'File troppo grande (max 900KB)', 'File too large (max 900KB)'), true); return; }
    const fr = new FileReader();
    fr.onload = () => onChange([...attachments, { id: uid(), kind: 'file', name: file.name || 'file', data: fr.result }]);
    fr.readAsDataURL(file);
  };
  const del = (id) => onChange(attachments.filter(a => a.id !== id));

  return (
    <div>
      <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { addImage(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => { addFile(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="row" style={{ gap: 8, marginBottom: attachments.length ? 8 : 0 }}>
        <button type="button" style={{ fontSize: 11 }} onClick={() => imgRef.current?.click()}>📷 {tr(L, 'صورة', 'Immagine', 'Image')}</button>
        <button type="button" style={{ fontSize: 11 }} onClick={() => fileRef.current?.click()}>📎 {tr(L, 'ملف', 'File', 'File')}</button>
      </div>
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {attachments.map(a => (
            <div key={a.id} style={{ position: 'relative' }}>
              {a.kind === 'image'
                ? <img src={a.data} alt="" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />
                : <div style={{ width: 90, height: 70, borderRadius: 6, border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 4, fontSize: 18, background: 'var(--bg)' }}>
                    📄<span style={{ fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 82 }}>{a.name}</span>
                  </div>}
              <button type="button" className="danger" style={{ position: 'absolute', top: -6, insetInlineEnd: -6, borderRadius: '50%', width: 20, height: 20, padding: 0, fontSize: 11 }} onClick={() => del(a.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttachmentsView({ L, attachments, onZoom }) {
  if (!attachments?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
      {attachments.map(a => a.kind === 'image'
        ? <img key={a.id} src={a.data} alt="" onClick={() => onZoom?.(a.data)}
            style={{ width: 130, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer' }} />
        : <button key={a.id} type="button" onClick={() => downloadAttachment(a)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '8px 12px' }}>
            📄 {a.name || tr(L, 'ملف', 'File', 'File')}
          </button>
      )}
    </div>
  );
}
