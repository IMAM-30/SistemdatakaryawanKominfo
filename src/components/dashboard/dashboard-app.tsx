"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionActor } from "@/lib/domain/types";
import { backend, ClientApiError, errorMessage, getSession, logout } from "@/lib/client-api";
import { loginPathForRole } from "@/lib/login-access";
import { getStoredPreference } from "@/lib/browser-storage";
import { navigationForRole, type NavigationItem, type UiAccount, type UiAudit, type UiCategory, type UiEmployee, type UiField } from "@/lib/ui-model";
import { AppBrand } from "@/components/app-brand";
import { Icon, type IconName } from "@/components/icons";
import { LiveClock } from "@/components/live-clock";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountAvatar } from "@/components/employee-avatar";
import { AccountsPanel, AuditPanel, EmployeePanel, FieldsPanel, OverviewPanel, SettingsPanel } from "@/components/dashboard/dashboard-panels";

export interface DashboardData {
  categories: UiCategory[];
  fields: UiField[];
  employees: UiEmployee[];
  admins: UiAccount[];
  portals: UiAccount[];
  audit: UiAudit[];
  settings: Record<string, string>;
}

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
  const [data, setData] = useState<DashboardData | null>(null);
  const [view, setView] = useState<NavigationItem["id"]>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState({ query: "", version: 0 });
  const [fatalError, setFatalError] = useState("");
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [toast, setToast] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const loadSequence = useRef(0);

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
    const sequence = ++loadSequence.current;
    if (background) setRefreshing(true);
    else setLoading(true);
    setFatalError("");
    try {
      const snapshot = await backend<DashboardData>("dashboard.snapshot");
      if (sequence === loadSequence.current) setData(snapshot);
    } catch (cause) {
      if (sequence !== loadSequence.current) return;
      if (cause instanceof ClientApiError && cause.status === 401) { router.replace(loginPathForRole(currentActor.role)); return; }
      setFatalError(errorMessage(cause));
    } finally { if (sequence === loadSequence.current) { setLoading(false); setRefreshing(false); } }
  }, [router]);

  useEffect(() => {
    let active = true;
    getSession().then((current) => { if (!active) return; setActor(current); return loadData(current); }).catch((cause) => {
      if (!active) return;
      if (cause instanceof ClientApiError && (cause.status === 401 || cause.status === 403)) {
        router.replace(getStoredPreference("kominfo-login-area") === "admin" ? "/admin" : "/login");
        return;
      }
      setFatalError(errorMessage(cause));
      setLoading(false);
    });
    return () => { active = false; loadSequence.current += 1; };
  }, [loadData, router, sessionAttempt]);

  const navigation = useMemo(() => actor ? navigationForRole(actor.role) : [], [actor]);
  const goTo = (next: NavigationItem["id"]) => { setView(next); setSidebarOpen(false); setAccountMenu(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const refresh = () => actor && loadData(actor, true);
  const refreshActor = useCallback(async () => { const current = await getSession(); setActor(current); }, []);
  const retry = () => {
    if (actor) void loadData(actor);
    else { setFatalError(""); setLoading(true); setSessionAttempt((attempt) => attempt + 1); }
  };

  async function signOut() {
    try { await logout(); } catch { /* Clear navigation even if the remote session has expired. */ }
    router.replace(actor ? loginPathForRole(actor.role) : "/login");
  }

  function runGlobalSearch(event: React.FormEvent) {
    event.preventDefault();
    setEmployeeSearch((current) => ({ query: globalSearch.trim(), version: current.version + 1 }));
    goTo("employees");
  }

  if (!actor || !data) return <DashboardLoading error={fatalError} loading={loading} hasSession={Boolean(actor)} onRetry={retry}/>;

  const panelProps = { actor, data, refresh, refreshActor, refreshing, notify };
  return <div className="dashboard-shell">
    <button className={`dashboard-backdrop ${sidebarOpen ? "is-open" : ""}`} type="button" tabIndex={-1} aria-label="Tutup navigasi" onClick={() => setSidebarOpen(false)}/>
    <aside ref={sidebar} id="dashboard-navigation" className={`dashboard-sidebar ${sidebarOpen ? "is-open" : ""}`} role={sidebarOpen ? "dialog" : undefined} aria-modal={sidebarOpen ? true : undefined} aria-label="Navigasi ruang kerja">
      <div className="dashboard-sidebar__brand"><AppBrand inverse compact/><button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Tutup menu"><Icon name="close"/></button></div>
      <nav className="dashboard-nav" aria-label="Navigasi dashboard">
        <span className="dashboard-nav__label">Ruang kerja</span>
        {navigation.map((item) => <button key={item.id} type="button" aria-current={view === item.id ? "page" : undefined} className={view === item.id ? "is-active" : ""} onClick={() => goTo(item.id)}><Icon name={NAV_ICONS[item.id]}/><span>{item.label}</span>{view === item.id && <i/>}</button>)}
      </nav>
      <div className="dashboard-sidebar__support"><Icon name="database"/><div><strong>Data kepegawaian</strong><small>Terpusat, tertata, dan terkelola</small></div></div>
      <div className="sidebar-user"><AccountAvatar fileId={actor.profilePhotoFileId} name={actor.displayName}/><div><strong>{actor.displayName}</strong><small>{roleLabel(actor.role)}</small></div><button type="button" onClick={signOut} title="Keluar" aria-label="Keluar"><Icon name="logout" size={18}/></button></div>
    </aside>
    <div className="dashboard-main" inert={sidebarOpen}>
      <header className="dashboard-topbar">
        <button ref={menuButton} className="mobile-menu" type="button" onClick={() => setSidebarOpen(true)} aria-label="Buka navigasi" aria-controls="dashboard-navigation" aria-expanded={sidebarOpen}><Icon name="menu"/></button>
        <form className="global-search" onSubmit={runGlobalSearch}><Icon name="search" size={18}/><input ref={searchInput} aria-label="Cari pegawai" placeholder="Cari nama atau NIP pegawai" value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)}/><kbd>⌘ K</kbd></form>
        <div className="dashboard-topbar__actions"><LiveClock compact/><ThemeToggle/><div className="account-popover-wrap"><button className="topbar-account" type="button" onClick={() => setAccountMenu((value) => !value)} aria-expanded={accountMenu}><AccountAvatar fileId={actor.profilePhotoFileId} name={actor.displayName}/><span><strong>{actor.displayName}</strong><small>{roleLabel(actor.role)}</small></span><Icon name="chevron" size={15}/></button>{accountMenu && <div className="account-popover"><button onClick={() => goTo("settings")}><Icon name="settings" size={17}/> Pengaturan akun</button><button onClick={signOut}><Icon name="logout" size={17}/> Keluar dari sistem</button></div>}</div></div>
      </header>
      <main className="dashboard-content">
        <div className="dashboard-titlebar"><div><span className="eyebrow">Data Kepegawaian</span><h1>{VIEW_COPY[view].title}</h1><p>{VIEW_COPY[view].description}</p></div><button type="button" className="refresh-button" onClick={refresh} disabled={refreshing}><Icon name="restore" size={17}/><span>{refreshing ? "Menyinkronkan…" : "Sinkronkan data"}</span></button></div>
        {fatalError && <div className="page-error" role="alert"><Icon name="alert"/><div><strong>Sinkronisasi belum berhasil</strong><p>{fatalError}</p><p>Menampilkan data dari sinkronisasi terakhir yang berhasil.</p></div><button className="button button--secondary button--small" onClick={refresh} disabled={refreshing}>Coba lagi</button></div>}
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

function DashboardLoading({ error, loading, hasSession, onRetry }: { error?: string; loading: boolean; hasSession: boolean; onRetry: () => void }) {
  return <main className="dashboard-loading" aria-busy={loading}><AppBrand/>{loading && <span className="loading-mark" aria-hidden="true"><i/><i/><i/></span>}<h1>{error ? hasSession ? "Data belum dapat dimuat" : "Koneksi belum tersedia" : "Menyiapkan ruang kerja"}</h1><p role={error ? "alert" : "status"}>{error || "Memuat sesi dan data terbaru dari Google Sheets…"}</p>{error && <button className="button button--primary" type="button" onClick={onRetry} disabled={loading}>Coba lagi</button>}</main>;
}

export function roleLabel(role: SessionActor["role"]) { return role === "MASTER_ADMIN" ? "Admin Master" : role === "KOMINFO_ADMIN" ? "Admin Kominfo" : "Akun Portal"; }
