"use client";

import { FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Icon } from "@/components/icons";
import { backend, errorMessage } from "@/lib/client-api";
import type { ExportFormat } from "@/lib/export-data";
import { employeeName, type UiAccount, type UiCategory, type UiEmployee, type UiField } from "@/lib/ui-model";

export function Modal({ title, eyebrow, children, onClose, wide = false }: { title: string; eyebrow?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  useEffect(() => { const original = document.body.style.overflow; document.body.style.overflow = "hidden"; const escape = (event: KeyboardEvent) => event.key === "Escape" && onClose(); window.addEventListener("keydown", escape); return () => { document.body.style.overflow = original; window.removeEventListener("keydown", escape); }; }, [onClose]);
  if (!mounted) return null;
  return createPortal(<div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`modal ${wide ? "modal--wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header className="modal__header"><div>{eyebrow && <span>{eyebrow}</span>}<h2 id="modal-title">{title}</h2></div><button type="button" onClick={onClose} aria-label="Tutup"><Icon name="close"/></button></header>
      {children}
    </section>
  </div>, document.body);
}

export function ConfirmDialog({ title, description, confirmLabel = "Lanjutkan", danger = false, pending = false, onCancel, onConfirm }: { title: string; description: string; confirmLabel?: string; danger?: boolean; pending?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <Modal title={title} eyebrow="Konfirmasi tindakan" onClose={onCancel}><div className="confirm-dialog"><span className={danger ? "confirm-dialog__icon is-danger" : "confirm-dialog__icon"}><Icon name={danger ? "alert" : "check"}/></span><p>{description}</p><div className="modal__actions"><button className="button button--secondary" onClick={onCancel} disabled={pending}>Batal</button><button className={`button ${danger ? "button--danger" : "button--primary"}`} onClick={onConfirm} disabled={pending}>{pending ? "Memproses…" : confirmLabel}</button></div></div></Modal>;
}

const FIELD_GROUPS = [
  { id: "personal", label: "Data Pribadi", keys: ["photo", "nip", "name", "birthPlace", "birthDate", "gender", "religion", "addressCity"] },
  { id: "rank", label: "Kepangkatan", keys: ["cpnsRank", "cpnsRankTmt", "latestRank", "latestRankTmt", "serviceYears", "serviceMonths"] },
  { id: "position", label: "Jabatan", keys: ["position", "echelon", "echelonTmt"] },
  { id: "education", label: "KGB & Pendidikan", keys: ["kgb", "nextKgb", "lastEducation", "educationMajor"] },
];

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
  const relevant = fields.filter((field) => field.categoryId === employee.categoryId && field.active);
  const groups = groupedFields(relevant);
  return <Modal wide title="Detail pegawai" eyebrow={category?.name ?? "Data kepegawaian"} onClose={onClose}>
    <div className="employee-detail__hero"><RemotePhoto fileId={employee.photoFileId}/><div><span className={`status-pill ${employee.active ? "status-pill--active" : "status-pill--inactive"}`}>{employee.active ? "Aktif" : "Tidak aktif"}</span><h3>{employeeName(employee)}</h3><p>{String(employee.data.nip ?? employee.data.position ?? "Informasi pegawai")}</p></div></div>
    <div className="employee-detail__groups">{groups.map((group) => <section key={group.id}><h4>{group.label}</h4><div>{group.fields.filter((field) => field.type !== "photo").map((field) => <dl key={field.id}><dt>{field.label}</dt><dd>{formatValue(employee.data[field.key])}</dd></dl>)}</div></section>)}</div>
    <footer className="modal__actions"><button className="button button--secondary" onClick={onClose}>Tutup</button>{canEdit && <button className="button button--primary" onClick={onEdit}><Icon name="edit" size={17}/> Edit data</button>}</footer>
  </Modal>;
}

function RemotePhoto({ fileId }: { fileId?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { if (!fileId) return; let live = true; backend<{ mimeType: string; base64: string }>("files.get", { id: fileId }).then((file) => live && setSrc(`data:${file.mimeType};base64,${file.base64}`)).catch(() => undefined); return () => { live = false; }; }, [fileId]);
  return <div className="employee-photo">{src ? <Image src={src} width={90} height={106} unoptimized alt="Foto pegawai"/> : <Icon name="user" size={36}/>}</div>;
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

export function ExportDialog({ onClose, onDownload, pending }: { onClose: () => void; onDownload: (format: ExportFormat) => void; pending: boolean }) {
  const [format, setFormat] = useState<ExportFormat>("excel");
  return <Modal title="Unduh data pegawai" eyebrow="Ekspor data" onClose={onClose}><div className="export-dialog"><p>Pilih format file. Data akan disimpan langsung ke perangkat Anda.</p><div className="export-options">
    {([['excel', 'Excel', 'Spreadsheet .xls yang dapat dibuka di Microsoft Excel.'], ['pdf', 'PDF', 'Dokumen ringkas siap dibaca dan dibagikan.'], ['both', 'Excel + PDF', 'Unduh kedua format sekaligus.']] as const).map(([value, label, description]) => <label key={value} className={format === value ? "is-active" : ""}><input type="radio" name="export-format" value={value} checked={format === value} onChange={() => setFormat(value)}/><span><strong>{label}</strong><small>{description}</small></span></label>)}
  </div><div className="modal__actions"><button className="button button--secondary" onClick={onClose} disabled={pending}>Batal</button><button className="button button--primary" onClick={() => onDownload(format)} disabled={pending}><Icon name="download" size={17}/>{pending ? "Menyiapkan…" : "Unduh"}</button></div></div></Modal>;
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
