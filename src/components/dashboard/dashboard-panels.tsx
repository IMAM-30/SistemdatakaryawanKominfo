"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionActor } from "@/lib/domain/types";
import { backend, errorMessage } from "@/lib/client-api";
import { deriveDashboardStats, employeeName, filterEmployees, type UiAccount, type UiEmployee, type UiField } from "@/lib/ui-model";
import type { DashboardData } from "@/components/dashboard/dashboard-app";
import { roleLabel } from "@/components/dashboard/dashboard-app";
import { Icon } from "@/components/icons";
import { downloadSnapshot, type ExportFormat, type ExportSnapshot } from "@/lib/export-data";
import { AccountEditForm, AccountForm, ConfirmDialog, EmployeeDetail, EmployeeForm, ExportDialog, Modal, PasswordForm, ResetPasswordForm, formatValue } from "@/components/dashboard/dashboard-dialogs";

interface PanelProps {
  actor: SessionActor;
  data: DashboardData;
  refresh: () => void;
  refreshing: boolean;
  notify: (message: string, tone?: "success" | "danger") => void;
}

export function OverviewPanel({ actor, data, onNavigate }: PanelProps & { onNavigate: (view: "employees" | "accounts" | "audit") => void }) {
  const stats = deriveDashboardStats(data.categories, data.employees);
  const colors = ["#0b425a", "#2b7d91", "#82aeba", "#d2e2e7"];
  const activeCategories = data.categories.filter((item) => item.active && !item.deletedAt);
  const total = Math.max(stats.total, 1);
  const gradient = activeCategories.map((category, index) => {
    const start = activeCategories.slice(0, index).reduce((sum, item) => sum + ((stats.byCategory[item.code] ?? 0) / total) * 100, 0);
    const end = start + ((stats.byCategory[category.code] ?? 0) / total) * 100;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  }).join(", ");
  const recent = data.audit.slice(0, 5);
  return <>
    <section className="welcome-strip"><div><span>Selamat datang,</span><h2>{actor.displayName}</h2><p>{actor.role === "PORTAL" ? "Gunakan pencarian untuk menemukan informasi pegawai yang Anda perlukan." : "Data terbaru sudah disinkronkan dari Google Sheets."}</p></div><span className="welcome-strip__mark"><Icon name="database" size={34}/></span></section>
    <section className="stat-grid">
      <article className="stat-card stat-card--primary"><span className="stat-card__icon"><Icon name="people"/></span><div><small>Total Pegawai</small><strong>{stats.total}</strong><p>Data aktif seluruh kategori</p></div><i>100%</i></article>
      {activeCategories.slice(0, 3).map((category, index) => <article className="stat-card" key={category.id}><span className="stat-card__icon" style={{ color: colors[index] }}><Icon name="user"/></span><div><small>{category.code === "NON_PNS" ? "Non-ASN" : category.code}</small><strong>{stats.byCategory[category.code] ?? 0}</strong><p>{category.name}</p></div><i>{Math.round(((stats.byCategory[category.code] ?? 0) / total) * 100)}%</i></article>)}
    </section>
    <section className="overview-grid">
      <article className="panel composition-panel"><div className="panel__header"><div><h3>Komposisi Pegawai</h3><p>Distribusi berdasarkan status kepegawaian</p></div><button onClick={() => onNavigate("employees")}>Lihat data <Icon name="chevron" size={15}/></button></div>
        <div className="composition"><div className="donut" style={{ background: gradient ? `conic-gradient(${gradient})` : "var(--surface-muted)" }}><span><strong>{stats.total}</strong><small>Pegawai aktif</small></span></div><div className="composition__legend">{activeCategories.map((category, index) => <div key={category.id}><i style={{ background: colors[index % colors.length] }}/><span><strong>{category.code === "NON_PNS" ? "Non-ASN" : category.code}</strong><small>{stats.byCategory[category.code] ?? 0} pegawai</small></span><b>{Math.round(((stats.byCategory[category.code] ?? 0) / total) * 100)}%</b></div>)}</div></div>
      </article>
      <article className="panel attention-panel"><div className="panel__header"><div><h3>Perlu diperhatikan</h3><p>Status data dan akses sistem</p></div></div>
        <div className="attention-list"><div><span className="attention-icon is-blue"><Icon name="database"/></span><div><strong>{stats.inactive} data tidak aktif</strong><small>Periksa data arsip atau status pegawai.</small></div><button onClick={() => onNavigate("employees")}><Icon name="chevron"/></button></div>{actor.role !== "PORTAL" && <><div><span className="attention-icon is-green"><Icon name="accounts"/></span><div><strong>{data.admins.length + data.portals.length} akun terkelola</strong><small>Admin Kominfo dan pengguna Portal.</small></div><button onClick={() => onNavigate("accounts")}><Icon name="chevron"/></button></div><div><span className="attention-icon is-amber"><Icon name="audit"/></span><div><strong>{data.audit.length} aktivitas terbaru</strong><small>Jejak perubahan terakhir sistem.</small></div><button onClick={() => onNavigate("audit")}><Icon name="chevron"/></button></div></>}</div>
      </article>
    </section>
    <section className="panel recent-panel"><div className="panel__header"><div><h3>Aktivitas terbaru</h3><p>Perubahan terakhir yang tercatat oleh sistem</p></div>{actor.role !== "PORTAL" && <button onClick={() => onNavigate("audit")}>Semua aktivitas <Icon name="chevron" size={15}/></button>}</div>{recent.length ? <div className="activity-list">{recent.map((item) => <div key={item.id}><span><Icon name="activity" size={17}/></span><div><strong>{actionLabel(item.action)}</strong><small>{item.entityType} · {item.actorRole}</small></div><time>{formatDateTime(item.createdAt)}</time></div>)}</div> : <EmptyState icon="activity" title="Belum ada aktivitas" description="Aktivitas perubahan data akan tampil di bagian ini."/>}</section>
  </>;
}

export function EmployeePanel({ actor, data, refresh, notify, initialSearch = "" }: PanelProps & { initialSearch?: string }) {
  const [query, setQuery] = useState(initialSearch);
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState("active");
  const [detail, setDetail] = useState<UiEmployee | null>(null);
  const [editing, setEditing] = useState<UiEmployee | "new" | null>(null);
  const [deleting, setDeleting] = useState<UiEmployee | null>(null);
  const [restoring, setRestoring] = useState<UiEmployee | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pending, setPending] = useState(false);
  const canEdit = actor.role !== "PORTAL";
  const filtered = filterEmployees(data.employees, query, categoryId).filter((item) => status === "all" || (status === "active" ? item.active && !item.deletedAt : !item.active || Boolean(item.deletedAt)));
  const tableFields = data.fields.filter((field) => field.active && !field.deletedAt && field.tableVisible && (categoryId === "all" || field.categoryId === categoryId));
  const columns = uniqueFields(tableFields).slice(0, 4);

  async function saveEmployee(input: { categoryId: string; data: Record<string, unknown>; active: boolean; photo?: File; removePhoto: boolean }) {
    let saved: UiEmployee;
    if (editing && editing !== "new") saved = await backend<UiEmployee>("employees.update", { id: editing.id, expectedVersion: editing.version, categoryId: input.categoryId, data: input.data, active: input.active }, true);
    else saved = await backend<UiEmployee>("employees.create", { categoryId: input.categoryId, data: input.data, active: input.active }, true);
    if (input.photo) {
      const base64 = await fileToBase64(input.photo);
      const uploaded = await backend<{ id: string }>("files.upload", { employeeId: saved.id, name: input.photo.name, mimeType: input.photo.type, base64 }, true);
      saved = await backend<UiEmployee>("employees.update", { id: saved.id, expectedVersion: saved.version, photoFileId: uploaded.id }, true);
      if (editing && editing !== "new" && editing.photoFileId) await backend("files.delete", { id: editing.photoFileId }, true);
    } else if (input.removePhoto && editing && editing !== "new" && editing.photoFileId) {
      saved = await backend<UiEmployee>("employees.update", { id: saved.id, expectedVersion: saved.version, photoFileId: "" }, true);
      await backend("files.delete", { id: editing.photoFileId }, true);
    }
    notify(editing === "new" ? "Data pegawai berhasil ditambahkan." : "Perubahan data pegawai berhasil disimpan."); refresh();
  }

  async function deleteEmployee() {
    if (!deleting) return; setPending(true);
    try { await backend("employees.delete", { id: deleting.id, expectedVersion: deleting.version }, true); notify("Data pegawai dipindahkan ke arsip."); setDeleting(null); refresh(); }
    catch (cause) { notify(errorMessage(cause), "danger"); } finally { setPending(false); }
  }

  async function restoreEmployee() {
    if (!restoring) return; setPending(true);
    try { await backend("employees.restore", { id: restoring.id, expectedVersion: restoring.version }, true); notify("Data pegawai berhasil dipulihkan."); setRestoring(null); refresh(); }
    catch (cause) { notify(errorMessage(cause), "danger"); } finally { setPending(false); }
  }

  async function exportData(format: ExportFormat) {
    setExporting(true);
    try {
      const snapshot = await backend<ExportSnapshot>("export.snapshot");
      await downloadSnapshot(snapshot, format);
      notify(format === "both" ? "File Excel dan PDF berhasil diunduh." : `File ${format === "excel" ? "Excel" : "PDF"} berhasil diunduh.`);
      setShowExport(false);
    } catch (cause) { notify(errorMessage(cause), "danger"); } finally { setExporting(false); }
  }

  return <section className="panel data-panel">
    <div className="data-toolbar"><div className="data-toolbar__search input-shell"><Icon name="search" size={18}/><input className="input" placeholder="Cari nama, NIP, atau jabatan" value={query} onChange={(event) => setQuery(event.target.value)}/></div><select className="select" aria-label="Filter kategori" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">Semua kategori</option>{data.categories.filter((item) => item.active && !item.deletedAt).map((category) => <option value={category.id} key={category.id}>{category.code === "NON_PNS" ? "Non-ASN" : category.code}</option>)}</select><select className="select" aria-label="Filter status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Status aktif</option><option value="inactive">Tidak aktif / arsip</option><option value="all">Semua status</option></select>{canEdit && <button className="button button--primary" onClick={() => setEditing("new")}><Icon name="plus" size={17}/> Tambah pegawai</button>}</div>
    <div className="data-panel__summary"><span>Menampilkan <strong>{filtered.length}</strong> dari {data.employees.length} data</span>{actor.role !== "PORTAL" && <button type="button" onClick={() => setShowExport(true)}><Icon name="download" size={16}/> Unduh data</button>}</div>
    {filtered.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Pegawai</th>{columns.map((field) => <th key={field.key}>{field.label}</th>)}<th>Status</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>{filtered.map((employee) => { const category = data.categories.find((item) => item.id === employee.categoryId); return <tr key={employee.id}><td data-label="Pegawai"><div className="employee-cell"><span className="avatar avatar--initial">{employeeName(employee).slice(0, 1)}</span><div><strong>{employeeName(employee)}</strong><small>{category?.code === "NON_PNS" ? "Non-ASN" : category?.code ?? "Tanpa kategori"}</small></div></div></td>{columns.map((field) => <td key={field.key} data-label={field.label}>{formatValue(employee.data[field.key])}</td>)}<td data-label="Status"><span className={`status-pill ${employee.active && !employee.deletedAt ? "status-pill--active" : "status-pill--inactive"}`}>{employee.deletedAt ? "Diarsipkan" : employee.active ? "Aktif" : "Tidak aktif"}</span></td><td className="table-actions"><button onClick={() => setDetail(employee)} title="Lihat detail"><Icon name="eye" size={18}/></button>{canEdit && (employee.deletedAt ? <button onClick={() => setRestoring(employee)} title="Pulihkan"><Icon name="restore" size={18}/></button> : <><button onClick={() => setEditing(employee)} title="Edit"><Icon name="edit" size={18}/></button><button className="is-danger" onClick={() => setDeleting(employee)} title="Arsipkan"><Icon name="trash" size={18}/></button></>)}</td></tr>; })}</tbody></table></div> : <EmptyState icon="search" title="Data tidak ditemukan" description="Ubah kata pencarian atau filter untuk melihat hasil lainnya." action={canEdit ? <button className="button button--primary" onClick={() => setEditing("new")}><Icon name="plus" size={17}/> Tambah pegawai</button> : undefined}/>} 
    {detail && <EmployeeDetail employee={detail} category={data.categories.find((item) => item.id === detail.categoryId)} fields={data.fields} canEdit={canEdit} onClose={() => setDetail(null)} onEdit={() => { setEditing(detail); setDetail(null); }}/>} 
    {editing && <EmployeeForm employee={editing === "new" ? undefined : editing} categories={data.categories} fields={data.fields} onClose={() => setEditing(null)} onSave={saveEmployee}/>} 
    {deleting && <ConfirmDialog danger title="Arsipkan data pegawai?" description={`Data ${employeeName(deleting)} tidak akan muncul pada daftar aktif, tetapi tetap tersimpan dan dapat dipulihkan.`} confirmLabel="Ya, arsipkan" onCancel={() => setDeleting(null)} onConfirm={deleteEmployee} pending={pending}/>} 
    {restoring && <ConfirmDialog title="Pulihkan data pegawai?" description={`Data ${employeeName(restoring)} akan dikembalikan ke daftar pegawai.`} confirmLabel="Ya, pulihkan" onCancel={() => setRestoring(null)} onConfirm={restoreEmployee} pending={pending}/>} 
    {showExport && <ExportDialog onClose={() => setShowExport(false)} onDownload={exportData} pending={exporting}/>} 
  </section>;
}

export function AccountsPanel({ actor, data, refresh, notify }: PanelProps) {
  const [tab, setTab] = useState<"admin" | "portal">(actor.role === "MASTER_ADMIN" ? "admin" : "portal");
  const [form, setForm] = useState<"admin" | "portal" | null>(null);
  const [target, setTarget] = useState<UiAccount | null>(null);
  const [editing, setEditing] = useState<UiAccount | null>(null);
  const [resetting, setResetting] = useState<UiAccount | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ account: UiAccount; action: "toggle" | "delete" | "restore" } | null>(null);
  const [pending, setPending] = useState(false);
  const accounts = tab === "admin" ? data.admins : data.portals;
  async function createAccount(value: { username: string; displayName: string; password: string; active: boolean }) { await backend(tab === "admin" ? "accounts.createAdmin" : "accounts.createPortal", value, true); notify("Akun baru berhasil dibuat."); refresh(); }
  const actionName = (account: UiAccount, action: string) => `accounts.${action}${account.role === "KOMINFO_ADMIN" ? "Admin" : "Portal"}`;
  async function updateAccountName(account: UiAccount, displayName: string) { await backend(actionName(account, "update"), { id: account.id, expectedVersion: account.version, displayName }, true); notify("Nama akun berhasil diperbarui."); setTarget(null); refresh(); }
  async function resetPassword(account: UiAccount, password: string) { await backend(actionName(account, "reset") + "Password", { id: account.id, password }, true); notify("Password akun berhasil direset dan seluruh sesi dicabut."); setTarget(null); refresh(); }
  async function runAccountAction() {
    if (!confirmAction) return; const { account, action } = confirmAction; setPending(true);
    try {
      const apiAction = action === "toggle" ? actionName(account, "update") : actionName(account, action);
      const payload = action === "toggle" ? { id: account.id, expectedVersion: account.version, active: !account.active } : { id: account.id, expectedVersion: account.version };
      await backend(apiAction, payload, true);
      notify(action === "delete" ? "Akun berhasil diarsipkan." : action === "restore" ? "Akun berhasil dipulihkan." : account.active ? "Akun berhasil dinonaktifkan." : "Akun berhasil diaktifkan.");
      setConfirmAction(null); setTarget(null); refresh();
    } catch (cause) { notify(errorMessage(cause), "danger"); } finally { setPending(false); }
  }
  return <section className="panel accounts-panel"><div className="panel-tabs"><div>{actor.role === "MASTER_ADMIN" && <button className={tab === "admin" ? "is-active" : ""} onClick={() => setTab("admin")}>Admin Kominfo <span>{data.admins.length}</span></button>}<button className={tab === "portal" ? "is-active" : ""} onClick={() => setTab("portal")}>Akun Portal <span>{data.portals.length}</span></button></div><button className="button button--primary" onClick={() => setForm(tab)}><Icon name="plus" size={17}/> Tambah akun</button></div>
    <div className="account-list">{accounts.map((account) => <article key={account.id}><span className="avatar avatar--initial">{account.displayName.slice(0, 1)}</span><div className="account-list__identity"><strong>{account.displayName}</strong><small>@{account.username}</small></div><div className="account-list__role"><small>Jenis akses</small><strong>{roleLabel(account.role)}</strong></div><div className="account-list__last"><small>Login terakhir</small><strong>{account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "Belum pernah masuk"}</strong></div><span className={`status-pill ${account.active && !account.deletedAt ? "status-pill--active" : "status-pill--inactive"}`}>{account.deletedAt ? "Diarsipkan" : account.active ? "Aktif" : "Nonaktif"}</span><button className="icon-button" onClick={() => setTarget(account)} aria-label={`Opsi akun ${account.username}`}><Icon name="more"/></button></article>)}</div>
    {!accounts.length && <EmptyState icon="accounts" title={`Belum ada ${tab === "admin" ? "Admin Kominfo" : "akun Portal"}`} description="Tambahkan akun pertama untuk memberikan akses ke sistem." action={<button className="button button--primary" onClick={() => setForm(tab)}><Icon name="plus" size={17}/> Tambah akun</button>}/>} 
    {form && <AccountForm kind={form} onClose={() => setForm(null)} onSave={createAccount}/>} 
    {target && <Modal title="Pengaturan akun" eyebrow={`@${target.username}`} onClose={() => setTarget(null)}><div className="account-options"><div><span className="avatar avatar--initial">{target.displayName.slice(0, 1)}</span><div><strong>{target.displayName}</strong><small>{roleLabel(target.role)}</small></div></div>{target.deletedAt ? <button className="button button--primary" onClick={() => setConfirmAction({ account: target, action: "restore" })}><Icon name="restore" size={17}/> Pulihkan akun</button> : <><button className="button button--secondary" onClick={() => setEditing(target)}><Icon name="edit" size={17}/> Edit nama akun</button><button className="button button--secondary" onClick={() => setResetting(target)}><Icon name="lock" size={17}/> Reset password</button><button className="button button--secondary" onClick={() => setConfirmAction({ account: target, action: "toggle" })}><Icon name={target.active ? "lock" : "restore"} size={17}/>{target.active ? "Nonaktifkan akun" : "Aktifkan akun"}</button><button className="button button--danger" onClick={() => setConfirmAction({ account: target, action: "delete" })}><Icon name="trash" size={17}/> Arsipkan akun</button></>}<p>Password tersimpan tetap tersembunyi. Reset password akan mencabut seluruh sesi akun.</p></div></Modal>} 
    {editing && <AccountEditForm account={editing} onClose={() => setEditing(null)} onSave={(displayName) => updateAccountName(editing, displayName)}/>} 
    {resetting && <ResetPasswordForm account={resetting} onClose={() => setResetting(null)} onSave={(password) => resetPassword(resetting, password)}/>} 
    {confirmAction && <ConfirmDialog danger={confirmAction.action === "delete"} title={confirmAction.action === "delete" ? "Arsipkan akun?" : confirmAction.action === "restore" ? "Pulihkan akun?" : confirmAction.account.active ? "Nonaktifkan akun?" : "Aktifkan akun?"} description={`Tindakan ini akan diterapkan pada @${confirmAction.account.username}${confirmAction.action !== "restore" ? " dan sesi aktifnya akan dicabut" : ""}.`} confirmLabel="Ya, lanjutkan" onCancel={() => setConfirmAction(null)} onConfirm={runAccountAction} pending={pending}/>} 
  </section>;
}

export function FieldsPanel({ data, refresh, notify }: PanelProps) {
  const [categoryId, setCategoryId] = useState(data.categories.find((item) => !item.deletedAt)?.id ?? data.categories[0]?.id ?? "");
  const [showCategory, setShowCategory] = useState(false);
  const [showField, setShowField] = useState(false);
  const [editingCategory, setEditingCategory] = useState<(typeof data.categories)[number] | null>(null);
  const [editingField, setEditingField] = useState<UiField | null>(null);
  const [mutation, setMutation] = useState<{ kind: "category" | "field"; action: "delete" | "restore"; item: UiField | (typeof data.categories)[number] } | null>(null);
  const [pending, setPending] = useState(false);
  const fields = data.fields.filter((field) => field.categoryId === categoryId);
  async function toggleField(field: UiField) { try { await backend("fields.update", { id: field.id, expectedVersion: field.version, active: !field.active }, true); notify("Status kolom berhasil diperbarui."); refresh(); } catch (cause) { notify(errorMessage(cause), "danger"); } }
  async function runMutation() { if (!mutation) return; setPending(true); try { await backend(`${mutation.kind === "category" ? "categories" : "fields"}.${mutation.action}`, { id: mutation.item.id, expectedVersion: mutation.item.version }, true); notify(mutation.action === "delete" ? "Data berhasil diarsipkan." : "Data berhasil dipulihkan."); setMutation(null); refresh(); } catch (cause) { notify(errorMessage(cause), "danger"); } finally { setPending(false); } }
  const selectedCategory = data.categories.find((item) => item.id === categoryId);
  return <div className="configuration-grid"><section className="panel category-panel"><div className="panel__header"><div><h3>Kategori Pegawai</h3><p>{data.categories.length} kategori tersedia</p></div><button className="button button--secondary button--small" onClick={() => setShowCategory(true)}><Icon name="plus" size={16}/> Kategori</button></div><div className="category-list">{data.categories.map((category) => <article key={category.id} className={`${categoryId === category.id ? "is-active" : ""} ${category.deletedAt ? "is-archived" : ""}`}><button className="category-list__main" onClick={() => setCategoryId(category.id)}><span>{category.code === "NON_PNS" ? "NON" : category.code.slice(0, 4)}</span><div><strong>{category.name}</strong><small>{category.deletedAt ? "Diarsipkan" : `${data.fields.filter((field) => field.categoryId === category.id).length} kolom data`}</small></div><Icon name="chevron" size={17}/></button><div className="configuration-actions">{category.deletedAt ? <button title="Pulihkan kategori" onClick={() => setMutation({ kind: "category", action: "restore", item: category })}><Icon name="restore" size={16}/></button> : <><button title="Edit kategori" onClick={() => setEditingCategory(category)}><Icon name="edit" size={16}/></button><button className="is-danger" title="Arsipkan kategori" onClick={() => setMutation({ kind: "category", action: "delete", item: category })}><Icon name="trash" size={16}/></button></>}</div></article>)}</div></section>
    <section className="panel fields-panel"><div className="panel__header"><div><h3>Struktur Kolom</h3><p>Atur informasi yang disimpan dan ditampilkan</p></div><button className="button button--primary button--small" onClick={() => setShowField(true)} disabled={!categoryId || Boolean(selectedCategory?.deletedAt)}><Icon name="plus" size={16}/> Tambah kolom</button></div><div className="field-list">{fields.map((field) => <article key={field.id} className={field.deletedAt ? "is-archived" : ""}><span className="field-type">{field.type.slice(0, 3).toUpperCase()}</span><div><strong>{field.label}</strong><small><code>{field.key}</code> · {field.deletedAt ? "Diarsipkan" : field.type}{field.required ? " · Wajib" : ""}</small></div>{field.system && <span className="system-badge">Sistem</span>}<div className="configuration-actions">{field.deletedAt ? <button title="Pulihkan kolom" onClick={() => setMutation({ kind: "field", action: "restore", item: field })}><Icon name="restore" size={16}/></button> : <><button title="Edit kolom" onClick={() => setEditingField(field)}><Icon name="edit" size={16}/></button>{!field.system && <button className="is-danger" title="Arsipkan kolom" onClick={() => setMutation({ kind: "field", action: "delete", item: field })}><Icon name="trash" size={16}/></button>}<label className="mini-toggle" title={field.active ? "Nonaktifkan" : "Aktifkan"}><input type="checkbox" checked={field.active} onChange={() => toggleField(field)}/><i/></label></>}</div></article>)}</div>{!fields.length && <EmptyState icon="fields" title="Belum ada kolom" description="Tambahkan struktur kolom untuk kategori ini."/>}</section>
    {showCategory && <CategoryForm onClose={() => setShowCategory(false)} onSaved={() => { notify("Kategori berhasil ditambahkan."); refresh(); }}/>} 
    {editingCategory && <CategoryForm category={editingCategory} onClose={() => setEditingCategory(null)} onSaved={() => { notify("Kategori berhasil diperbarui."); refresh(); }}/>} 
    {showField && <FieldForm categoryId={categoryId} onClose={() => setShowField(false)} onSaved={() => { notify("Kolom baru berhasil ditambahkan."); refresh(); }}/>} 
    {editingField && <FieldForm categoryId={categoryId} field={editingField} onClose={() => setEditingField(null)} onSaved={() => { notify("Kolom berhasil diperbarui."); refresh(); }}/>} 
    {mutation && <ConfirmDialog danger={mutation.action === "delete"} title={mutation.action === "delete" ? `Arsipkan ${mutation.kind === "category" ? "kategori" : "kolom"}?` : `Pulihkan ${mutation.kind === "category" ? "kategori" : "kolom"}?`} description={mutation.action === "delete" ? "Data tidak akan dipakai pada input aktif, tetapi tetap dapat dipulihkan." : "Data akan kembali tersedia pada konfigurasi sistem."} confirmLabel="Ya, lanjutkan" onCancel={() => setMutation(null)} onConfirm={runMutation} pending={pending}/>} 
  </div>;
}

export function AuditPanel({ data }: PanelProps) {
  const [query, setQuery] = useState("");
  const rows = data.audit.filter((item) => `${item.action} ${item.entityType} ${item.actorRole}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="panel audit-panel"><div className="audit-toolbar"><div className="input-shell"><Icon name="search" size={18}/><input className="input" placeholder="Cari aktivitas" value={query} onChange={(event) => setQuery(event.target.value)}/></div><span><Icon name="audit" size={17}/> {rows.length} catatan terakhir</span></div>{rows.length ? <div className="audit-timeline">{rows.map((item) => <article key={item.id}><span className="audit-timeline__dot"><Icon name="activity" size={16}/></span><div><div><strong>{actionLabel(item.action)}</strong><span className="status-pill status-pill--inactive">{item.entityType}</span></div><p>{summaryLabel(item.summary)}</p><small>{item.actorRole} · ID {item.actorId.slice(0, 8)}</small></div><time>{formatDateTime(item.createdAt)}</time></article>)}</div> : <EmptyState icon="audit" title="Aktivitas tidak ditemukan" description="Catatan audit akan muncul setelah ada perubahan pada sistem."/>}</section>;
}

export function SettingsPanel({ actor, data, refresh, notify }: PanelProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingMode, setPendingMode] = useState<string | null>(null);
  const mode = data.settings.PORTAL_MODE ?? "LOGIN_REQUIRED";
  async function changeMode() { if (!pendingMode) return; setPending(true); try { await backend("settings.update", { key: "PORTAL_MODE", value: pendingMode }, true); notify("Mode akses portal berhasil diperbarui."); setPendingMode(null); refresh(); } catch (cause) { notify(errorMessage(cause), "danger"); } finally { setPending(false); } }
  async function changePassword(value: { currentPassword: string; password: string }) { await backend("accounts.changeOwnPassword", value, true); notify("Password berhasil diganti. Silakan masuk kembali."); window.setTimeout(() => router.replace("/login"), 900); }
  return <div className="settings-grid"><section className="panel settings-card"><div className="settings-card__heading"><span><Icon name="lock"/></span><div><h3>Akses portal data</h3><p>Tentukan siapa yang dapat melihat informasi kepegawaian.</p></div></div><div className="portal-modes">{[
    ["PUBLIC", "Publik", "Data yang ditandai publik dapat dilihat tanpa login."],
    ["LOGIN_REQUIRED", "Wajib login", "Hanya pengguna dengan akun Portal yang dapat mengakses."],
    ["CLOSED", "Ditutup", "Portal tidak dapat diakses sementara oleh pengguna Portal."],
  ].map(([value, label, description]) => <label key={value} className={mode === value ? "is-active" : ""}><input type="radio" name="portal-mode" checked={mode === value} disabled={pending} onChange={() => setPendingMode(value)}/><span><i>{mode === value && <Icon name="check" size={13}/>}</i><strong>{label}</strong><small>{description}</small></span></label>)}</div></section>
    <section className="panel profile-card"><div className="settings-card__heading"><span><Icon name="user"/></span><div><h3>Profil akun</h3><p>Identitas akun yang sedang digunakan.</p></div></div><dl><div><dt>Nama</dt><dd>{actor.displayName}</dd></div><div><dt>ID pengguna</dt><dd>@{actor.username}</dd></div><div><dt>Hak akses</dt><dd>{roleLabel(actor.role)}</dd></div><div><dt>Status sesi</dt><dd><span className="status-pill status-pill--active">Aktif</span></dd></div></dl><button className="button button--secondary" onClick={() => setShowPassword(true)}><Icon name="lock" size={17}/> Ganti password</button></section>
    <section className="panel settings-note"><span><Icon name="database"/></span><div><h3>Penyimpanan Google</h3><p>Data operasional tersimpan pada Google Sheets dan foto tersimpan privat di Google Drive. Semua perubahan penting dicatat dalam audit log.</p></div></section>
    {showPassword && <PasswordForm onClose={() => setShowPassword(false)} onSave={changePassword}/>} 
    {pendingMode && <ConfirmDialog danger={pendingMode === "PUBLIC" || pendingMode === "CLOSED"} title="Ubah akses portal?" description={pendingMode === "PUBLIC" ? "Data yang ditandai publik akan dapat dilihat tanpa login." : pendingMode === "CLOSED" ? "Seluruh pengguna Portal akan kehilangan akses sementara." : "Portal hanya dapat diakses oleh pengguna yang sudah login."} confirmLabel="Ya, ubah mode" onCancel={() => setPendingMode(null)} onConfirm={changeMode} pending={pending}/>} 
  </div>;
}

function CategoryForm({ category, onClose, onSaved }: { category?: DashboardData["categories"][number]; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState({ code: category?.code ?? "", name: category?.name ?? "", description: category?.description ?? "" }); const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [confirming, setConfirming] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); setConfirming(true); }
  async function save() { setPending(true); try { await backend(category ? "categories.update" : "categories.create", category ? { id: category.id, expectedVersion: category.version, name: value.name, description: value.description } : { ...value, active: true }, true); onSaved(); onClose(); } catch (cause) { setError(errorMessage(cause)); setPending(false); setConfirming(false); } }
  return <Modal title={category ? "Edit kategori" : "Tambah kategori"} eyebrow="Struktur data" onClose={onClose}><form className="simple-form" onSubmit={submit}>{error && <div className="form-alert"><Icon name="alert" size={18}/>{error}</div>}<div className="field"><label htmlFor="category-code">Kode kategori</label><input id="category-code" className="input" placeholder="Contoh: MAGANG" value={value.code} disabled={Boolean(category)} onChange={(event) => setValue({ ...value, code: event.target.value.toUpperCase() })} required/></div><div className="field"><label htmlFor="category-name">Nama kategori</label><input id="category-name" className="input" placeholder="Nama lengkap kategori" value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} required/></div><div className="field"><label htmlFor="category-description">Deskripsi</label><textarea id="category-description" className="textarea" value={value.description} onChange={(event) => setValue({ ...value, description: event.target.value })}/></div><footer className="modal__actions"><button type="button" className="button button--secondary" onClick={onClose}>Batal</button><button className="button button--primary" disabled={pending}>{category ? "Simpan perubahan" : "Tambah kategori"}</button></footer></form>{confirming && <ConfirmDialog title={category ? "Simpan perubahan kategori?" : "Tambahkan kategori?"} description="Struktur kategori akan diperbarui dan dicatat dalam aktivitas sistem." confirmLabel="Ya, simpan" onCancel={() => setConfirming(false)} onConfirm={save} pending={pending}/>}</Modal>;
}

function FieldForm({ categoryId, field, onClose, onSaved }: { categoryId: string; field?: UiField; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState({ key: field?.key ?? "", label: field?.label ?? "", type: field?.type ?? "text", required: field?.required ?? false, tableVisible: field?.tableVisible ?? false, publicVisible: field?.publicVisible ?? false, portalVisible: field?.portalVisible ?? true, active: field?.active ?? true, options: field?.options?.join(", ") ?? "" }); const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [confirming, setConfirming] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); setConfirming(true); }
  async function save() { setPending(true); try { const payload = { ...value, categoryId, options: value.options.split(",").map((item) => item.trim()).filter(Boolean) }; await backend(field ? "fields.update" : "fields.create", field ? { ...payload, id: field.id, expectedVersion: field.version } : payload, true); onSaved(); onClose(); } catch (cause) { setError(errorMessage(cause)); setPending(false); setConfirming(false); } }
  return <Modal title={field ? "Edit kolom data" : "Tambah kolom data"} eyebrow="Kolom dinamis" onClose={onClose}><form className="simple-form" onSubmit={submit}>{error && <div className="form-alert"><Icon name="alert" size={18}/>{error}</div>}<div className="form-grid"><div className="field"><label htmlFor="field-label">Label kolom</label><input id="field-label" className="input" value={value.label} onChange={(event) => setValue({ ...value, label: event.target.value })} required/></div><div className="field"><label htmlFor="field-key">Kunci data</label><input id="field-key" className="input" placeholder="contoh: nomorKontrak" value={value.key} disabled={Boolean(field)} onChange={(event) => setValue({ ...value, key: event.target.value.replace(/[^A-Za-z0-9_]/g, "") })} required/></div><div className="field"><label htmlFor="field-type">Tipe input</label><select id="field-type" className="select" value={value.type} onChange={(event) => setValue({ ...value, type: event.target.value as UiField["type"] })}><option value="text">Teks</option><option value="number">Angka</option><option value="date">Tanggal</option><option value="select">Pilihan</option><option value="boolean">Ya/Tidak</option><option value="textarea">Teks panjang</option><option value="photo">Foto</option></select></div>{value.type === "select" && <div className="field"><label htmlFor="field-options">Daftar pilihan</label><input id="field-options" className="input" placeholder="Pilihan 1, Pilihan 2" value={value.options} onChange={(event) => setValue({ ...value, options: event.target.value })}/></div>}</div><div className="check-grid"><label><input type="checkbox" checked={value.required} onChange={(event) => setValue({ ...value, required: event.target.checked })}/> Wajib diisi</label><label><input type="checkbox" checked={value.tableVisible} onChange={(event) => setValue({ ...value, tableVisible: event.target.checked })}/> Tampil di tabel</label><label><input type="checkbox" checked={value.portalVisible} onChange={(event) => setValue({ ...value, portalVisible: event.target.checked })}/> Tampil di Portal</label><label><input type="checkbox" checked={value.publicVisible} onChange={(event) => setValue({ ...value, publicVisible: event.target.checked })}/> Tampil publik</label></div><footer className="modal__actions"><button type="button" className="button button--secondary" onClick={onClose}>Batal</button><button className="button button--primary" disabled={pending}>{field ? "Simpan perubahan" : "Tambah kolom"}</button></footer></form>{confirming && <ConfirmDialog title={field ? "Simpan perubahan kolom?" : "Tambahkan kolom?"} description="Struktur kolom akan diterapkan pada formulir dan tampilan data sesuai pengaturan visibilitas." confirmLabel="Ya, simpan" onCancel={() => setConfirming(false)} onConfirm={save} pending={pending}/>}</Modal>;
}

function EmptyState({ icon, title, description, action }: { icon: "search" | "accounts" | "fields" | "audit" | "activity"; title: string; description: string; action?: React.ReactNode }) { return <div className="empty-state"><span><Icon name={icon} size={28}/></span><h3>{title}</h3><p>{description}</p>{action}</div>; }
function uniqueFields(fields: UiField[]) { const seen = new Set<string>(); return fields.filter((field) => { if (seen.has(field.key)) return false; seen.add(field.key); return true; }); }
function fileToBase64(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] ?? ""); reader.onerror = reject; reader.readAsDataURL(file); }); }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" }).format(date); }
function actionLabel(action: string) { const labels: Record<string, string> = { "accounts.bootstrapMaster": "Admin Master dibuat", "employees.create": "Data pegawai ditambahkan", "employees.update": "Data pegawai diperbarui", "employees.delete": "Data pegawai diarsipkan", "employees.restore": "Data pegawai dipulihkan", "accounts.createAdmin": "Admin Kominfo dibuat", "accounts.createPortal": "Akun Portal dibuat", "settings.update": "Pengaturan diperbarui", "fields.create": "Kolom data ditambahkan", "categories.create": "Kategori ditambahkan" }; return labels[action] ?? action.replaceAll(".", " · "); }
function summaryLabel(summary?: Record<string, unknown>) { if (!summary || !Object.keys(summary).length) return "Tindakan berhasil diproses oleh sistem."; return Object.entries(summary).map(([key, value]) => `${key}: ${String(value)}`).join(" · "); }
