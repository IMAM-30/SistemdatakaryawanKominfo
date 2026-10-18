"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { SessionActor } from "@/lib/domain/types";
import { backend, ClientApiError, errorMessage, getSession, logout } from "@/lib/client-api";
import { loginPathForRole } from "@/lib/login-access";
import { getStoredPreference } from "@/lib/browser-storage";
import { navigationForRole, type NavigationItem, type UiAccount, type UiAudit, type UiCategory, type UiEmployee, type UiField } from "@/lib/ui-model";
import { AppBrand } from "@/components/app-brand";
import { Icon, type IconName } from "@/components/icons";
import { LiveClock } from "@/components/live-clock";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountsPanel, AuditPanel, EmployeePanel, FieldsPanel, OverviewPanel, SettingsPanel } from "@/components/dashboard/dashboard-panels";
import adminImage from "../../../image/admin.png";

export interface DashboardData {
  categories: UiCategory[];
  fields: UiField[];
  employees: UiEmployee[];
  admins: UiAccount[];
  portals: UiAccount[];
  audit: UiAudit[];
  settings: Record<string, string>;
}

const EMPTY_DATA: DashboardData = { categories: [], fields: [], employees: [], admins: [], portals: [], audit: [], settings: {} };
const NAV_ICONS: Record<NavigationItem["id"], IconName> = { overview: "home", employees: "people", accounts: "accounts", fields: "fields", audit: "audit", settings: "settings" };
const VIEW_COPY: Record<NavigationItem["id"], { title: string; description: string }> = {
  overview: { title: "Ringkasan", description: "Gambaran terkini data kepegawaian dan aktivitas sistem." },
  employees: { title: "Data Pegawai", description: "Kelola data PNS, PPPK, dan pegawai Non-ASN." },
  accounts: { title: "Kelola Akun", description: "Atur akses Admin Kominfo dan pengguna Portal." },
  fields: { title: "Kategori & Kolom", description: "Atur kategori dan informasi pegawai sesuai kebutuhan dinas." },
  audit: { title: "Aktivitas Sistem", description: "Pantau jejak perubahan dan tindakan penting." },
  settings: { title: "Pengaturan", description: "Atur akses portal dan preferensi akun." },
};

export function DashboardApp() {
  const router = useRouter();
  const [actor, setActor] = useState<SessionActor | null>(null);
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [view, setView] = useState<NavigationItem["id"]>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState({ query: "", version: 0 });
  const [fatalError, setFatalError] = useState("");
  const [toast, setToast] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !document.querySelector('[aria-modal="true"]')) {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.key === "Escape") setAccountMenu(false);
    };
    const desktop = window.matchMedia("(min-width: 901px)");
    const closeOnDesktop = () => { if (desktop.matches) setSidebarOpen(false); };
    window.addEventListener("keydown", shortcut);
    desktop.addEventListener("change", closeOnDesktop);
    return () => { window.removeEventListener("keydown", shortcut); desktop.removeEventListener("change", closeOnDesktop); };
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const original = document.body.style.overflow;
    const opener = menuButton.current;
    document.body.style.overflow = "hidden";
    const controls = () => [...(sidebar.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]') ?? [])].filter((element) => element.getClientRects().length);
    (sidebar.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? controls()[0])?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setSidebarOpen(false); }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = original; window.removeEventListener("keydown", handleKey); opener?.focus({ preventScroll: true }); };
  }, [sidebarOpen]);

  const notify = useCallback((message: string, tone: "success" | "danger" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3800);
  }, []);

  const loadData = useCallback(async (currentActor: SessionActor, background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setFatalError("");
    try {
      const [categories, fields, employees] = await Promise.all([
        backend<{ items: UiCategory[] }>("categories.list", currentActor.role === "PORTAL" ? {} : { includeDeleted: true }),
        backend<{ items: UiField[] }>("fields.list", currentActor.role === "PORTAL" ? {} : { includeDeleted: true }),
        backend<{ items: UiEmployee[] }>("employees.list", currentActor.role === "PORTAL" ? {} : { includeDeleted: true }),
      ]);
      let admins: UiAccount[] = [], portals: UiAccount[] = [], audit: UiAudit[] = [], settings: Record<string, string> = {};
      if (currentActor.role !== "PORTAL") {
        const optional = await Promise.all([
          backend<{ items: UiAccount[] }>("accounts.listPortal", currentActor.role === "MASTER_ADMIN" ? { includeDeleted: true } : {}).catch(() => ({ items: [] })),
          backend<{ items: UiAudit[] }>("audit.list", { limit: 100 }).catch(() => ({ items: [] })),
          backend<Record<string, string>>("settings.get").catch(() => ({})),
          currentActor.role === "MASTER_ADMIN" ? backend<{ items: UiAccount[] }>("accounts.listAdmins", { includeDeleted: true }).catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
        ]);
        portals = optional[0].items; audit = optional[1].items; settings = optional[2]; admins = optional[3].items;
      }
      setData({ categories: categories.items, fields: fields.items, employees: employees.items, admins, portals, audit, settings });
    } catch (cause) {
      if (cause instanceof ClientApiError && cause.status === 401) { router.replace(loginPathForRole(currentActor.role)); return; }
      setFatalError(errorMessage(cause));
    } finally { setLoading(false); setRefreshing(false); }
  }, [router]);

  useEffect(() => {
    let active = true;
    getSession().then((current) => { if (!active) return; setActor(current); return loadData(current); }).catch(() => { if (active) router.replace(getStoredPreference("kominfo-login-area") === "admin" ? "/admin" : "/login"); });
    return () => { active = false; };
  }, [loadData, router]);

  const navigation = useMemo(() => actor ? navigationForRole(actor.role) : [], [actor]);
  const goTo = (next: NavigationItem["id"]) => { setView(next); setSidebarOpen(false); setAccountMenu(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const refresh = () => actor && loadData(actor, true);

  async function signOut() {
    try { await logout(); } catch { /* Clear navigation even if the remote session has expired. */ }
    router.replace(actor ? loginPathForRole(actor.role) : "/login");
  }

  function runGlobalSearch(event: React.FormEvent) {
    event.preventDefault();
    setEmployeeSearch((current) => ({ query: globalSearch.trim(), version: current.version + 1 }));
    goTo("employees");
  }

  if (!actor || (loading && !data.categories.length)) return <DashboardLoading error={fatalError}/>;

  const panelProps = { actor, data, refresh, refreshing, notify };
  return <div className="dashboard-shell">
    <button className={`dashboard-backdrop ${sidebarOpen ? "is-open" : ""}`} type="button" tabIndex={-1} aria-label="Tutup navigasi" onClick={() => setSidebarOpen(false)}/>
    <aside ref={sidebar} id="dashboard-navigation" className={`dashboard-sidebar ${sidebarOpen ? "is-open" : ""}`} role={sidebarOpen ? "dialog" : undefined} aria-modal={sidebarOpen ? true : undefined} aria-label="Navigasi ruang kerja">
      <div className="dashboard-sidebar__brand"><AppBrand inverse compact/><button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Tutup menu"><Icon name="close"/></button></div>
      <nav className="dashboard-nav" aria-label="Navigasi dashboard">
        <span className="dashboard-nav__label">Ruang kerja</span>
        {navigation.map((item) => <button key={item.id} type="button" aria-current={view === item.id ? "page" : undefined} className={view === item.id ? "is-active" : ""} onClick={() => goTo(item.id)}><Icon name={NAV_ICONS[item.id]}/><span>{item.label}</span>{view === item.id && <i/>}</button>)}
      </nav>
      <div className="dashboard-sidebar__support"><Icon name="database"/><div><strong>Data kepegawaian</strong><small>Terpusat, tertata, dan terkelola</small></div></div>
      <div className="sidebar-user"><span className="avatar avatar--initial">{actor.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{actor.displayName}</strong><small>{roleLabel(actor.role)}</small></div><button type="button" onClick={signOut} title="Keluar" aria-label="Keluar"><Icon name="logout" size={18}/></button></div>
    </aside>
    <div className="dashboard-main" inert={sidebarOpen}>
      <header className="dashboard-topbar">
        <button ref={menuButton} className="mobile-menu" type="button" onClick={() => setSidebarOpen(true)} aria-label="Buka navigasi" aria-controls="dashboard-navigation" aria-expanded={sidebarOpen}><Icon name="menu"/></button>
        <form className="global-search" onSubmit={runGlobalSearch}><Icon name="search" size={18}/><input ref={searchInput} aria-label="Cari pegawai" placeholder="Cari nama atau NIP pegawai" value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)}/><kbd>⌘ K</kbd></form>
        <div className="dashboard-topbar__actions"><LiveClock compact/><ThemeToggle/><div className="account-popover-wrap"><button className="topbar-account" type="button" onClick={() => setAccountMenu((value) => !value)} aria-expanded={accountMenu}><span className="avatar"><Image src={adminImage} alt="" sizes="38px"/></span><span><strong>{actor.displayName}</strong><small>{roleLabel(actor.role)}</small></span><Icon name="chevron" size={15}/></button>{accountMenu && <div className="account-popover"><button onClick={() => goTo("settings")}><Icon name="settings" size={17}/> Pengaturan akun</button><button onClick={signOut}><Icon name="logout" size={17}/> Keluar dari sistem</button></div>}</div></div>
      </header>
      <main className="dashboard-content">
        <div className="dashboard-titlebar"><div><span className="eyebrow">Data Kepegawaian</span><h1>{VIEW_COPY[view].title}</h1><p>{VIEW_COPY[view].description}</p></div><button type="button" className="refresh-button" onClick={refresh} disabled={refreshing}><Icon name="restore" size={17}/><span>{refreshing ? "Menyinkronkan…" : "Sinkronkan data"}</span></button></div>
        {fatalError && <div className="page-error"><Icon name="alert"/><div><strong>Data belum dapat dimuat</strong><p>{fatalError}</p></div><button className="button button--secondary button--small" onClick={refresh}>Coba lagi</button></div>}
        <div className="dashboard-view" key={view}>
          {view === "overview" && <OverviewPanel {...panelProps} onNavigate={goTo}/>} 
          {view === "employees" && <EmployeePanel {...panelProps} initialSearch={employeeSearch.query} searchVersion={employeeSearch.version}/>}
          {view === "accounts" && <AccountsPanel {...panelProps}/>} 
          {view === "fields" && <FieldsPanel {...panelProps}/>} 
          {view === "audit" && <AuditPanel {...panelProps}/>} 
          {view === "settings" && <SettingsPanel {...panelProps}/>} 
        </div>
      </main>
    </div>
    {toast && <div className={`toast toast--${toast.tone}`} role="status"><Icon name={toast.tone === "success" ? "check" : "alert"}/><span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Tutup notifikasi"><Icon name="close" size={16}/></button></div>}
  </div>;
}

function DashboardLoading({ error }: { error?: string }) {
  return <main className="dashboard-loading"><AppBrand/><span className="loading-mark"><i/><i/><i/></span><h1>{error ? "Koneksi belum tersedia" : "Menyiapkan ruang kerja"}</h1><p>{error || "Memuat sesi dan data terbaru dari Google Sheets…"}</p>{error && <a className="button button--primary" href="/login">Kembali ke halaman masuk</a>}</main>;
}

export function roleLabel(role: SessionActor["role"]) { return role === "MASTER_ADMIN" ? "Admin Master" : role === "KOMINFO_ADMIN" ? "Admin Kominfo" : "Akun Portal"; }
