"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Icon } from "@/components/icons";
import { backend, errorMessage } from "@/lib/client-api";
import { getStoredPreference, setStoredPreference } from "@/lib/browser-storage";
import { downloadEmployee, type ExportFormat } from "@/lib/export-data";
import { employeeName, type UiAccount, type UiCategory, type UiEmployee, type UiField } from "@/lib/ui-model";

const dialogLayers: HTMLElement[] = [];
const originalInert = new Map<HTMLElement, boolean>();
let originalOverflow = "";
let originalFocus: HTMLElement | null = null;

function dialogControls(layer: HTMLElement) {
  return [...layer.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], summary, [tabindex]')].filter((element) =>
    element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[inert]") && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden",
  );
}

function updateDialogLayers() {
  if (!dialogLayers.length) {
    for (const [element, inert] of originalInert) element.inert = inert;
    originalInert.clear();
    document.body.style.overflow = originalOverflow;
    return;
  }
  const top = dialogLayers.at(-1);
  for (const element of document.body.children) {
    if (!(element instanceof HTMLElement)) continue;
    if (!originalInert.has(element)) originalInert.set(element, element.inert);
    element.inert = element !== top;
  }
}

function useDialogLayer(ref: RefObject<HTMLElement | null>, enabled: boolean, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const layer = ref.current;
    if (!enabled || !layer) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialogLayers.length) { originalOverflow = document.body.style.overflow; originalFocus = opener; }
    dialogLayers.push(layer);
    document.body.style.overflow = "hidden";
    updateDialogLayers();
    const focusFirst = () => (dialogControls(layer)[0] ?? layer).focus({ preventScroll: true });
    focusFirst();
    const keydown = (event: KeyboardEvent) => {
      if (dialogLayers.at(-1) !== layer) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close.current(); return; }
      if (event.key !== "Tab") return;
      const controls = dialogControls(layer), first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); layer.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === layer)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const focusin = (event: FocusEvent) => {
      if (dialogLayers.at(-1) === layer && event.target instanceof Node && !layer.contains(event.target)) focusFirst();
    };
    window.addEventListener("keydown", keydown);
    document.addEventListener("focusin", focusin);
    return () => {
      window.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", focusin);
      dialogLayers.splice(dialogLayers.indexOf(layer), 1);
      updateDialogLayers();
      const target = dialogLayers.length ? opener : originalFocus;
      if (target?.isConnected && !target.closest("[inert]")) target.focus({ preventScroll: true });
      if (!dialogLayers.length) originalFocus = null;
    };
  }, [enabled, ref]);
}

export function Modal({ title, eyebrow, children, onClose, wide = false, dismissible = true }: { title: string; eyebrow?: string; children: React.ReactNode; onClose: () => void; wide?: boolean; dismissible?: boolean }) {
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const layer = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogLayer(layer, mounted, () => { if (dismissible) onClose(); });
  if (!mounted) return null;
  return createPortal(<div ref={layer} className="modal-layer" role="presentation" tabIndex={-1} onMouseDown={(event) => event.target === event.currentTarget && dismissible && onClose()}>
    <section className={`modal ${wide ? "modal--wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="modal__header"><div>{eyebrow && <span>{eyebrow}</span>}<h2 id={titleId}>{title}</h2></div><button type="button" onClick={onClose} aria-label="Tutup" disabled={!dismissible}><Icon name="close"/></button></header>
      {children}
    </section>
  </div>, document.body);
}

export function ConfirmDialog({ title, description, confirmLabel = "Lanjutkan", danger = false, pending = false, onCancel, onConfirm }: { title: string; description: string; confirmLabel?: string; danger?: boolean; pending?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <Modal title={title} eyebrow="Konfirmasi tindakan" onClose={onCancel} dismissible={!pending}><div className="confirm-dialog"><span className={danger ? "confirm-dialog__icon is-danger" : "confirm-dialog__icon"}><Icon name={danger ? "alert" : "check"}/></span><p>{description}</p><div className="modal__actions"><button className="button button--secondary" onClick={onCancel} disabled={pending}>Batal</button><button className={`button ${danger ? "button--danger" : "button--primary"}`} onClick={onConfirm} disabled={pending}>{pending ? "Memproses…" : confirmLabel}</button></div></div></Modal>;
}

const FIELD_GROUPS = [
  { id: "personal", label: "Data Pribadi", keys: ["photo", "nip", "name", "birthPlace", "birthDate", "gender", "religion", "addressCity"] },
  { id: "rank", label: "Kepangkatan", keys: ["cpnsRank", "cpnsRankTmt", "latestRank", "latestRankTmt", "serviceYears", "serviceMonths"] },
  { id: "position", label: "Jabatan", keys: ["position", "echelon", "echelonTmt"] },
  { id: "education", label: "KGB & Pendidikan", keys: ["kgb", "nextKgb", "lastEducation", "educationMajor"] },
];

type DetailTextSize = "small" | "medium" | "large";
const DETAIL_TEXT_SIZE_KEY = "kominfo-detail-text-size";
const DETAIL_TEXT_SIZE_EVENT = "kominfo-detail-text-size-change";
let transientDetailTextSize: DetailTextSize = "medium";

function detailTextSizeSnapshot(): DetailTextSize {
  const saved = getStoredPreference(DETAIL_TEXT_SIZE_KEY);
  return saved === "small" || saved === "large" || saved === "medium" ? saved : transientDetailTextSize;
}

function subscribeDetailTextSize(onStoreChange: () => void) {
  const listener = () => onStoreChange();
  window.addEventListener("storage", listener);
  window.addEventListener(DETAIL_TEXT_SIZE_EVENT, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(DETAIL_TEXT_SIZE_EVENT, listener); };
}

function groupedFields(fields: UiField[]) {
  const assigned = new Set(FIELD_GROUPS.flatMap((group) => group.keys));
  const result = FIELD_GROUPS.map((group) => ({ ...group, fields: fields.filter((field) => group.keys.includes(field.key)) })).filter((group) => group.fields.length);
  const extra = fields.filter((field) => !assigned.has(field.key));
  if (extra.length) result.push({ id: "extra", label: "Data Tambahan", keys: [], fields: extra });
  return result;
}

export function EmployeeForm({ employee, categories, fields, onClose, onSave }: { employee?: UiEmployee; categories: UiCategory[]; fields: UiField[]; onClose: () => void; onSave: (value: { categoryId: string; data: Record<string, unknown>; active: boolean; photo?: File; removePhoto: boolean }) => Promise<void> }) {
  const [categoryId, setCategoryId] = useState(employee?.categoryId ?? categories.find((item) => item.active)?.id ?? "");
  const activeFields = useMemo(() => fields.filter((field) => field.categoryId === categoryId && field.active).sort((a, b) => a.sortOrder - b.sortOrder), [categoryId, fields]);
  const groups = useMemo(() => groupedFields(activeFields), [activeFields]);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, unknown>>(employee?.data ?? {});
  const [active, setActive] = useState(employee?.active ?? true);
  const [photo, setPhoto] = useState<File>();
  const [removePhoto, setRemovePhoto] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const current = groups[Math.min(step, Math.max(groups.length - 1, 0))];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step < groups.length - 1) { setStep((value) => value + 1); return; }
    setConfirming(true);
  }

  async function save() {
    setPending(true); setError("");
    try { await onSave({ categoryId, data: values, active, photo, removePhoto }); onClose(); }
    catch (cause) { setError(errorMessage(cause)); setPending(false); setConfirming(false); }
  }

  return <Modal wide title={employee ? "Edit data pegawai" : "Tambah pegawai"} eyebrow={employee ? employeeName(employee) : "Data baru"} onClose={onClose}>
    <form className="wizard" onSubmit={submit}>
      {!employee && <div className="wizard__category field"><label htmlFor="employee-category">Kategori pegawai</label><select id="employee-category" className="select" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setStep(0); setValues({}); }} required>{categories.filter((item) => item.active).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div>}
      <div className="wizard-tabs" role="tablist">{groups.map((group, index) => <button key={group.id} type="button" className={index === step ? "is-active" : index < step ? "is-done" : ""} onClick={() => index <= step && setStep(index)}><span>{index < step ? <Icon name="check" size={14}/> : index + 1}</span><em>{group.label}</em></button>)}</div>
      <div className="wizard__body">
        {error && <div className="form-alert"><Icon name="alert" size={18}/>{error}</div>}
        <div className="form-grid">
          {current?.fields.map((field) => field.type === "photo" ? <PhotoInput key={field.id} file={photo} existing={Boolean(employee?.photoFileId)} removeExisting={removePhoto} onChange={(next) => { setPhoto(next); if (next) setRemovePhoto(false); }} onRemoveExisting={() => setRemovePhoto((value) => !value)}/> : <DynamicField key={field.id} field={field} value={values[field.key]} onChange={(value) => setValues((currentValues) => ({ ...currentValues, [field.key]: value }))}/>)}
        </div>
        {step === groups.length - 1 && <label className="toggle-row"><span><strong>Status pegawai aktif</strong><small>Data aktif akan tampil pada daftar sesuai hak akses.</small></span><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)}/><i/></label>}
      </div>
      <footer className="modal__actions wizard__actions"><div>{step > 0 && <button type="button" className="button button--secondary" onClick={() => setStep((value) => value - 1)}><span>←</span> Kembali</button>}</div><div><button type="button" className="button button--ghost" onClick={onClose}>Batal</button><button type="submit" className="button button--primary" disabled={pending}>{pending ? "Menyimpan…" : step < groups.length - 1 ? <>Lanjut <Icon name="chevron" size={17}/></> : <><Icon name="check" size={17}/> Simpan data</>}</button></div></footer>
    </form>
    {confirming && <ConfirmDialog title={employee ? "Simpan perubahan pegawai?" : "Tambahkan data pegawai?"} description={employee ? `Perubahan data ${employeeName(employee)} akan disimpan dan dicatat dalam aktivitas sistem.` : "Data pegawai baru akan disimpan ke Google Sheets dan langsung tersedia sesuai hak akses."} confirmLabel="Ya, simpan" onCancel={() => setConfirming(false)} onConfirm={save} pending={pending}/>} 
  </Modal>;
}

function DynamicField({ field, value, onChange }: { field: UiField; value: unknown; onChange: (value: unknown) => void }) {
  const options = field.options?.length ? field.options : field.key === "gender" ? ["Laki-laki", "Perempuan"] : field.key === "religion" ? ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"] : [];
  if (field.type === "boolean") return <label className="toggle-row toggle-row--field"><span><strong>{field.label}</strong><small>{field.required ? "Wajib diisi" : "Opsional"}</small></span><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)}/><i/></label>;
  return <div className={`field ${field.type === "textarea" ? "field--wide" : ""}`}><label htmlFor={`field-${field.id}`}>{field.label}{field.required && <b> *</b>}</label>
    {field.type === "select" || options.length ? <select id={`field-${field.id}`} className="select" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} required={field.required}><option value="">Pilih {field.label.toLocaleLowerCase("id-ID")}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea id={`field-${field.id}`} className="textarea" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} required={field.required}/> : <input id={`field-${field.id}`} className="input" type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={String(value ?? "")} onChange={(event) => onChange(field.type === "number" ? Number(event.target.value) : event.target.value)} required={field.required}/>} 
  </div>;
}

function PhotoInput({ file, existing, removeExisting, onChange, onRemoveExisting }: { file?: File; existing: boolean; removeExisting: boolean; onChange: (file?: File) => void; onRemoveExisting: () => void }) {
  const [preview, setPreview] = useState("");
  useEffect(() => { if (!file) return; const reader = new FileReader(); reader.onload = () => setPreview(String(reader.result ?? "")); reader.readAsDataURL(file); return () => { if (reader.readyState === FileReader.LOADING) reader.abort(); }; }, [file]);
  return <div className="photo-input field--wide"><div className="photo-input__preview">{file && preview ? <Image src={preview} width={82} height={82} unoptimized alt="Pratinjau foto pegawai"/> : <Icon name="user" size={32}/>}</div><div><strong>Foto pegawai</strong><p>{removeExisting ? "Foto tersimpan akan dihapus setelah data disimpan." : existing && !file ? "Foto saat ini tetap digunakan. Pilih file untuk menggantinya." : "JPEG, PNG, atau WebP. Maksimal 2 MB."}</p><label className="button button--secondary button--small">Pilih foto<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const next = event.target.files?.[0]; if (next && next.size <= 2 * 1024 * 1024) onChange(next); }}/></label>{file && <button type="button" className="button button--ghost button--small" onClick={() => onChange(undefined)}>Hapus pilihan</button>}{existing && !file && <button type="button" className="button button--ghost button--small" onClick={onRemoveExisting}>{removeExisting ? "Batalkan hapus foto" : "Hapus foto tersimpan"}</button>}</div></div>;
}

export function EmployeeDetail({ employee, category, fields, canEdit, onClose, onEdit }: { employee: UiEmployee; category?: UiCategory; fields: UiField[]; canEdit: boolean; onClose: () => void; onEdit: () => void }) {
  const relevant = fields.filter((field) => field.categoryId === employee.categoryId && field.active && !field.deletedAt && (canEdit ? field.adminVisible : field.portalVisible)).sort((a, b) => a.sortOrder - b.sortOrder);
  const groups = groupedFields(relevant);
  const [showExport, setShowExport] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState("");
  const photoRequest = useRef<Promise<EmployeePhotoFile | undefined> | null>(null);
  const textSize = useSyncExternalStore(subscribeDetailTextSize, detailTextSizeSnapshot, () => "medium");
  function updateTextSize(next: DetailTextSize) {
    transientDetailTextSize = next;
    setStoredPreference(DETAIL_TEXT_SIZE_KEY, next);
    window.dispatchEvent(new Event(DETAIL_TEXT_SIZE_EVENT));
  }
  const name = employeeName(employee);
  const categoryCode = category?.code === "NON_PNS" ? "Non-ASN" : category?.code ?? "Pegawai";
  async function exportEmployee(format: ExportFormat) {
    const photo = format === "excel" ? undefined : await photoRequest.current ?? undefined;
    await downloadEmployee({ employee, category, fields: relevant, photo }, format);
    setDownloadNotice(`${format === "both" ? "File Excel dan PDF" : format === "excel" ? "File Excel" : "File PDF"} pegawai berhasil diunduh.${format !== "excel" && employee.photoFileId && !photo ? " Foto belum tersedia; seluruh data teks tetap disertakan." : ""}`);
  }
  return <Modal wide title="Detail pegawai" eyebrow="Data kepegawaian" onClose={onClose}>
    <div className="employee-detail" data-text-size={textSize}>
      <div className="employee-detail__hero">
        <RemotePhoto key={employee.photoFileId} fileId={employee.photoFileId} employeeName={name} requestRef={photoRequest}/>
        <div className="employee-detail__identity">
          <div className="employee-detail__badges"><span className="employee-category-badge"><strong>{categoryCode}</strong><small>{category?.name ?? "Data pegawai"}</small></span><span className={`status-pill ${employee.active && !employee.deletedAt ? "status-pill--active" : "status-pill--inactive"}`}>{employee.deletedAt ? "Diarsipkan" : employee.active ? "Aktif" : "Tidak aktif"}</span></div>
          <h3>{name}</h3><p>{String(employee.data.nip ?? employee.data.position ?? "Informasi pegawai")}</p>
        </div>
        <div className="detail-text-control" role="group" aria-label="Ukuran teks detail">
          <button type="button" aria-label="Perkecil teks detail" aria-pressed={textSize === "small"} onClick={() => updateTextSize("small")}>A−</button>
          <button type="button" aria-label="Ukuran teks detail normal" aria-pressed={textSize === "medium"} onClick={() => updateTextSize("medium")}>A</button>
          <button type="button" aria-label="Perbesar teks detail" aria-pressed={textSize === "large"} onClick={() => updateTextSize("large")}>A+</button>
        </div>
      </div>
      {canEdit && <div className="employee-detail__download"><div><strong>Simpan data pegawai ini</strong><p>Profil PDF yang mudah dibaca atau tabel Excel lengkap.</p></div><button type="button" className="button button--primary" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setDownloadNotice(""); setShowExport(true); }}><Icon name="download" size={18}/> Unduh data pegawai</button></div>}
      {downloadNotice && <p className="employee-detail__download-notice" role="status"><Icon name="check" size={17}/>{downloadNotice}</p>}
      <div className="employee-detail__groups">{groups.map((group) => <section key={group.id}><h4>{group.label}</h4><div>{group.fields.filter((field) => field.type !== "photo").map((field) => <dl key={field.id}><dt>{field.label}</dt><dd>{formatValue(employee.data[field.key])}</dd></dl>)}</div></section>)}</div>
      <footer className="modal__actions"><button className="button button--secondary" onClick={onClose}>Tutup</button>{canEdit && <button className="button button--primary" onClick={onEdit}><Icon name="edit" size={17}/> Edit data</button>}</footer>
    </div>
    {canEdit && showExport && <EmployeeExportDialog name={name} onClose={() => setShowExport(false)} onDownload={exportEmployee}/>}
  </Modal>;
}

interface EmployeePhotoFile { mimeType: string; base64: string }

function RemotePhoto({ fileId, employeeName: name, requestRef }: { fileId?: string; employeeName: string; requestRef: RefObject<Promise<EmployeePhotoFile | undefined> | null> }) {
  const [src, setSrc] = useState("");
  const [expanded, setExpanded] = useState(false);
  const lightbox = useRef<HTMLButtonElement>(null);
  useDialogLayer(lightbox, expanded, () => setExpanded(false));
  useEffect(() => { if (!fileId) { requestRef.current = null; return; } let live = true; const request = backend<EmployeePhotoFile>("files.get", { id: fileId }).catch(() => undefined); requestRef.current = request; request.then((file) => { if (live && file) setSrc(`data:${file.mimeType};base64,${file.base64}`); }); return () => { live = false; }; }, [fileId, requestRef]);
  return <>{src ? <button type="button" className="employee-photo" aria-label={`Perbesar foto ${name}`} onClick={() => setExpanded(true)}><Image src={src} width={132} height={156} unoptimized alt={`Foto ${name}`}/></button> : <div className="employee-photo employee-photo--empty"><Icon name="user" size={42}/></div>}
    {expanded && createPortal(<button ref={lightbox} type="button" className="photo-lightbox" role="dialog" aria-modal="true" aria-label={`Foto ${name}`} onClick={() => setExpanded(false)}><Image src={src} width={1200} height={1500} unoptimized alt={`Foto ${name} ukuran penuh`}/></button>, document.body)}
  </>;
}

export function AccountForm({ kind, onClose, onSave }: { kind: "admin" | "portal"; onClose: () => void; onSave: (value: { username: string; displayName: string; password: string; active: boolean }) => Promise<void> }) {
  const [values, setValues] = useState({ username: "", displayName: "", password: "", active: true });
  const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [confirming, setConfirming] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); setConfirming(true); }
  async function save() { setPending(true); setError(""); try { await onSave(values); onClose(); } catch (cause) { setError(errorMessage(cause)); setPending(false); setConfirming(false); } }
  return <Modal title={kind === "admin" ? "Tambah Admin Kominfo" : "Tambah akun Portal"} eyebrow="Akun baru" onClose={onClose}><form onSubmit={submit} className="simple-form">
    {error && <div className="form-alert"><Icon name="alert" size={18}/>{error}</div>}
    <div className="field"><label htmlFor="account-name">Nama lengkap</label><input id="account-name" className="input" value={values.displayName} onChange={(event) => setValues({ ...values, displayName: event.target.value })} minLength={2} required/></div>
    <div className="field"><label htmlFor="account-user">ID pengguna</label><input id="account-user" className="input" value={values.username} onChange={(event) => setValues({ ...values, username: event.target.value })} minLength={3} required/><small>Gunakan ID singkat tanpa spasi agar mudah diingat.</small></div>
    <div className="field"><label htmlFor="account-password">Password awal</label><input id="account-password" className="input" type="password" value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} minLength={10} required/><small>Minimal 10 karakter. Pengguna dapat menggantinya setelah masuk.</small></div>
    <label className="toggle-row"><span><strong>Aktifkan akun</strong><small>Akun dapat langsung digunakan untuk masuk.</small></span><input type="checkbox" checked={values.active} onChange={(event) => setValues({ ...values, active: event.target.checked })}/><i/></label>
    <footer className="modal__actions"><button type="button" className="button button--secondary" onClick={onClose}>Batal</button><button className="button button--primary" disabled={pending}>{pending ? "Membuat akun…" : "Buat akun"}</button></footer>
  </form>{confirming && <ConfirmDialog title="Buat akun baru?" description={`Akun @${values.username} akan dibuat sebagai ${kind === "admin" ? "Admin Kominfo" : "pengguna Portal"}.`} confirmLabel="Ya, buat akun" onCancel={() => setConfirming(false)} onConfirm={save} pending={pending}/>}</Modal>;
}

export function AccountEditForm({ account, onClose, onSave }: { account: UiAccount; onClose: () => void; onSave: (displayName: string) => Promise<void> }) {
  const [displayName, setDisplayName] = useState(account.displayName);
  const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [confirming, setConfirming] = useState(false);
  async function save() { setPending(true); try { await onSave(displayName); onClose(); } catch (cause) { setError(errorMessage(cause)); setPending(false); setConfirming(false); } }
  return <Modal title="Edit akun" eyebrow={`@${account.username}`} onClose={onClose}><form className="simple-form" onSubmit={(event) => { event.preventDefault(); setConfirming(true); }}>
    {error && <div className="form-alert"><Icon name="alert" size={18}/>{error}</div>}
    <div className="field"><label htmlFor="edit-account-name">Nama lengkap</label><input id="edit-account-name" className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} required/></div>
    <footer className="modal__actions"><button type="button" className="button button--secondary" onClick={onClose}>Batal</button><button className="button button--primary">Simpan perubahan</button></footer>
  </form>{confirming && <ConfirmDialog title="Simpan perubahan akun?" description={`Nama tampilan @${account.username} akan diperbarui.`} confirmLabel="Ya, simpan" onCancel={() => setConfirming(false)} onConfirm={save} pending={pending}/>}</Modal>;
}

export function ResetPasswordForm({ account, onClose, onSave }: { account: UiAccount; onClose: () => void; onSave: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [confirming, setConfirming] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); if (password !== confirmation) { setError("Konfirmasi password baru tidak sama."); return; } setError(""); setConfirming(true); }
  async function save() { setPending(true); try { await onSave(password); onClose(); } catch (cause) { setError(errorMessage(cause)); setPending(false); setConfirming(false); } }
  return <Modal title="Reset password" eyebrow={`@${account.username}`} onClose={onClose}><form className="simple-form" onSubmit={submit}>
    {error && <div className="form-alert"><Icon name="alert" size={18}/>{error}</div>}
    <div className="field"><label htmlFor="reset-password">Password baru</label><input id="reset-password" className="input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} required/></div>
    <div className="field"><label htmlFor="reset-password-confirmation">Konfirmasi password</label><input id="reset-password-confirmation" className="input" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={10} required/></div>
    <div className="security-note"><Icon name="lock" size={18}/><span>Reset akan mengakhiri seluruh sesi akun ini. Password lama tidak pernah ditampilkan.</span></div>
    <footer className="modal__actions"><button type="button" className="button button--secondary" onClick={onClose}>Batal</button><button className="button button--primary">Lanjutkan reset</button></footer>
  </form>{confirming && <ConfirmDialog danger title="Reset password akun?" description={`Password @${account.username} akan diganti dan semua sesinya dicabut.`} confirmLabel="Ya, reset" onCancel={() => setConfirming(false)} onConfirm={save} pending={pending}/>}</Modal>;
}

function ExportFormatOptions({ format, onChange, profile = false }: { format: ExportFormat; onChange: (format: ExportFormat) => void; profile?: boolean }) {
  const name = useId();
  const options = [
    ["excel", "Excel", profile ? "Tabel lengkap dengan satu baris data pegawai." : "Spreadsheet .xls yang dapat dibuka di Microsoft Excel."],
    ["pdf", "PDF", profile ? "Profil per bagian, tanpa tabel, dengan foto jika tersedia." : "Dokumen ringkas siap dibaca dan dibagikan."],
    ["both", "Excel + PDF", "Unduh kedua format sekaligus."],
  ] as const;
  return <div className="export-options">{options.map(([value, label, description]) => <label key={value} className={format === value ? "is-active" : ""}><input type="radio" name={name} value={value} checked={format === value} onChange={() => onChange(value)}/><span><strong>{label}</strong><small>{description}</small></span></label>)}</div>;
}

function EmployeeExportDialog({ name, onClose, onDownload }: { name: string; onClose: () => void; onDownload: (format: ExportFormat) => Promise<void> }) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (pending) return;
    setPending(true); setError("");
    try { await onDownload(format); onClose(); }
    catch (cause) { setError(errorMessage(cause)); setPending(false); }
  }
  return <Modal title="Unduh data pegawai ini" eyebrow="Dokumen individual" onClose={onClose} dismissible={!pending}><div className="export-dialog">
    <div className="employee-export-identity"><span><Icon name="user" size={23}/></span><div><small>Data lengkap satu pegawai</small><strong>{name}</strong></div></div>
    {error && <div className="form-alert employee-export-error" role="alert"><Icon name="alert" size={18}/>{error}</div>}
    <fieldset className="export-dialog__group" disabled={pending}><legend>Format file</legend><ExportFormatOptions format={format} onChange={setFormat} profile/></fieldset>
    <div className="modal__actions"><button type="button" className="button button--secondary" onClick={onClose} disabled={pending}>Batal</button><button type="button" className="button button--primary" onClick={download} disabled={pending}><Icon name="download" size={17}/>{pending ? "Menyiapkan…" : "Unduh"}</button></div>
  </div></Modal>;
}

export function ExportDialog({ categories, onClose, onDownload, pending }: { categories: UiCategory[]; onClose: () => void; onDownload: (format: ExportFormat, categoryIds?: string[]) => void; pending: boolean }) {
  const [format, setFormat] = useState<ExportFormat>("excel");
  const [selection, setSelection] = useState<string[] | null>(null);
  const available = categories.filter((category) => !category.deletedAt);
  const selected = available.filter((category) => selection === null || selection.includes(category.id));
  const allSelected = available.length > 0 && selected.length === available.length;
  const allCheckbox = useRef<HTMLInputElement>(null);
  const helpId = useId();
  useEffect(() => {
    if (allCheckbox.current) allCheckbox.current.indeterminate = selected.length > 0 && !allSelected;
  }, [allSelected, selected.length]);
  function toggleCategory(id: string, checked: boolean) {
    const ids = selected.map((category) => category.id);
    setSelection(checked ? [...ids, id] : ids.filter((value) => value !== id));
  }
  return <Modal title="Unduh data pegawai" eyebrow="Ekspor data" onClose={onClose} dismissible={!pending}><div className="export-dialog"><p>Pilih kategori dan format file sesuai kebutuhan Anda.</p>
    <fieldset className="export-dialog__group" disabled={pending} aria-describedby={helpId}>
      <legend>Kategori data</legend>
      <p id={helpId} className="export-dialog__hint">Pilih satu kategori, gabungkan dua, atau unduh semuanya.</p>
      <label className={`export-category export-category--all ${allSelected ? "is-active" : ""}`}><input ref={allCheckbox} type="checkbox" aria-label="Semua kategori" checked={allSelected} disabled={!available.length} onChange={(event) => setSelection(event.target.checked ? null : [])}/><span>Semua kategori</span><Icon name="database" size={17}/></label>
      <div className="export-category-grid">{available.map((category) => {
        const label = category.code === "NON_PNS" ? "Non-ASN" : category.code;
        const checked = selected.some((item) => item.id === category.id);
        return <label key={category.id} className={`export-category ${checked ? "is-active" : ""}`}><input type="checkbox" aria-label={label} checked={checked} onChange={(event) => toggleCategory(category.id, event.target.checked)}/><span>{label}</span></label>;
      })}</div>
      <p className={`export-selection-summary ${!selected.length ? "is-empty" : ""}`} role="status">{!available.length ? "Belum ada kategori yang dapat diunduh." : !selected.length ? "Pilih minimal satu kategori untuk diunduh." : allSelected ? "Semua kategori akan dimasukkan ke dalam file." : `Pilihan: ${selected.map((category) => category.code === "NON_PNS" ? "Non-ASN" : category.code).join(" + ")}.`}</p>
    </fieldset>
    <fieldset className="export-dialog__group" disabled={pending}><legend>Format file</legend><ExportFormatOptions format={format} onChange={setFormat}/></fieldset><div className="modal__actions"><button type="button" className="button button--secondary" onClick={onClose} disabled={pending}>Batal</button><button type="button" className="button button--primary" onClick={() => onDownload(format, allSelected ? undefined : selected.map((category) => category.id))} disabled={pending || !selected.length}><Icon name="download" size={17}/>{pending ? "Menyiapkan…" : "Unduh"}</button></div></div></Modal>;
}

export function PasswordForm({ onClose, onSave }: { onClose: () => void; onSave: (value: { currentPassword: string; password: string }) => Promise<void> }) {
  const [values, setValues] = useState({ currentPassword: "", password: "", confirmation: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (values.password !== values.confirmation) { setError("Konfirmasi password baru tidak sama."); return; }
    if (values.password === values.currentPassword) { setError("Password baru harus berbeda dari password saat ini."); return; }
    setError(""); setConfirming(true);
  }

  async function save() {
    setPending(true);
    try { await onSave({ currentPassword: values.currentPassword, password: values.password }); onClose(); }
    catch (cause) { setError(errorMessage(cause)); setPending(false); setConfirming(false); }
  }

  return <Modal title="Ganti password" eyebrow="Keamanan akun" onClose={onClose}><form onSubmit={submit} className="simple-form">
    {error && <div className="form-alert"><Icon name="alert" size={18}/>{error}</div>}
    <div className="field"><label htmlFor="current-password">Password saat ini</label><input id="current-password" className="input" type="password" autoComplete="current-password" value={values.currentPassword} onChange={(event) => setValues({ ...values, currentPassword: event.target.value })} required/></div>
    <div className="field"><label htmlFor="new-password">Password baru</label><input id="new-password" className="input" type="password" autoComplete="new-password" value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} minLength={10} required/><small>Minimal 10 karakter dan gunakan kombinasi yang tidak mudah ditebak.</small></div>
    <div className="field"><label htmlFor="confirm-password">Konfirmasi password baru</label><input id="confirm-password" className="input" type="password" autoComplete="new-password" value={values.confirmation} onChange={(event) => setValues({ ...values, confirmation: event.target.value })} minLength={10} required/></div>
    <div className="security-note"><Icon name="lock" size={18}/><span>Setelah password diganti, semua sesi akun ini akan berakhir dan Anda perlu masuk kembali.</span></div>
    <footer className="modal__actions"><button type="button" className="button button--secondary" onClick={onClose} disabled={pending}>Batal</button><button className="button button--primary" disabled={pending}>{pending ? "Mengganti password…" : "Ganti password"}</button></footer>
  </form>{confirming && <ConfirmDialog danger title="Ganti password sekarang?" description="Semua sesi aktif akun ini akan diakhiri dan Anda harus masuk kembali dengan password baru." confirmLabel="Ya, ganti password" onCancel={() => setConfirming(false)} onConfirm={save} pending={pending}/>}</Modal>;
}

export function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(`${value.slice(0, 10)}T00:00:00`); if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date);
  }
  return String(value);
}
