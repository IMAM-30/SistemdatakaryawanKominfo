"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AppBrand } from "@/components/app-brand";
import { Icon } from "@/components/icons";
import { LiveClock } from "@/components/live-clock";
import { ThemeToggle } from "@/components/theme-toggle";
import { errorMessage, login } from "@/lib/client-api";
import { setStoredPreference } from "@/lib/browser-storage";
import type { LoginArea } from "@/lib/login-access";
import kegiatan from "../../image/kegiatan1.jpg";
import "./login-screen.css";

const LOGIN_CONTENT: Record<LoginArea, { eyebrow: string; title: string; description: string; accessTitle: string; accessDescription: string; help: string }> = {
  portal: {
    eyebrow: "Portal Pegawai",
    title: "Masuk ke Portal",
    description: "Gunakan akun Portal yang telah diberikan oleh administrator.",
    accessTitle: "Akses informasi pegawai",
    accessDescription: "Ruang baca internal untuk pencarian dan detail data sesuai kewenangan Portal.",
    help: "Mengalami kendala akses? Hubungi Admin Kominfo.",
  },
  admin: {
    eyebrow: "Administrasi Internal",
    title: "Masuk ke Ruang Admin",
    description: "Akses khusus Admin Kominfo dan Admin Master.",
    accessTitle: "Pengelolaan sistem",
    accessDescription: "Hak kelola akan disesuaikan otomatis dengan peran akun setelah login.",
    help: "Gunakan akun Admin Kominfo atau Admin Master yang aktif.",
  },
};

export function LoginScreen({ area }: { area: LoginArea }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const content = LOGIN_CONTENT[area];

  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try { await login({ username, password, area }); setStoredPreference("kominfo-login-area", area); router.replace("/dashboard"); }
    catch (cause) { setError(errorMessage(cause)); setPending(false); }
  }

  const authentication = <section className="login-auth" aria-labelledby="login-title">
    {area === "admin" && <div className="login-auth__console-label"><Icon name="lock" size={15}/><span>Autentikasi administrator</span></div>}
    <div className="login-auth__body">
      <div className="login-auth__heading">
        <span className="login-auth__symbol"><Icon name={area === "admin" ? "settings" : "user"} size={24}/></span>
        <span className="login-auth__eyebrow">{content.eyebrow}</span>
        <h1 id="login-title">{content.title}</h1>
        <p>{content.description}</p>
      </div>
      <form className="login-form" onSubmit={submit} aria-busy={pending}>
        {error && <div className="form-alert" role="alert"><Icon name="alert" size={18}/><span>{error}</span></div>}
        <div className="field"><label htmlFor="username">ID pengguna</label><div className="input-shell"><Icon name="user" size={19}/><input className="input" id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Masukkan ID pengguna" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} required autoFocus/></div></div>
        <div className="field"><label htmlFor="password">Password</label><div className="input-shell"><Icon name="lock" size={19}/><input className="input" id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Masukkan password" value={password} onChange={(event) => setPassword(event.target.value)} required/><button className="input-shell__action" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={showPassword}><Icon name="eye" size={18}/></button></div></div>
        <button className="button button--primary login-submit" disabled={pending} type="submit">{pending ? <><span className="spinner"/> Memverifikasi…</> : <>Masuk ke sistem <Icon name="chevron" size={18}/></>}</button>
      </form>
      <p className="login-help">{content.help}</p>
    </div>
    <div className="login-auth__scope"><Icon name={area === "admin" ? "lock" : "database"} size={17}/><span>{content.accessDescription}</span></div>
  </section>;

  if (area === "admin") {
    return <main className="login-page login-page--admin" data-login-area="admin">
      <header className="admin-access-header">
        <AppBrand inverse compact/>
        <nav className="login-access-nav" aria-label="Navigasi halaman masuk"><Link href="/" className="back-link"><Icon name="home" size={17}/><span>Beranda</span></Link><ThemeToggle/></nav>
      </header>
      <div className="admin-access-shell login-shell--admin" data-login-layout="console">
        <section className="admin-workspace" aria-labelledby="admin-workspace-title">
          <span className="admin-workspace__eyebrow"><span/> Ruang kendali internal</span>
          <h2 id="admin-workspace-title">Data terkelola.<br/><span>Layanan terarah.</span></h2>
          <p>Ruang kerja administrasi kepegawaian Dinas Kominfo Kota Parepare. Kelola informasi dengan kewenangan yang tepat.</p>
          <div className="admin-workspace__capabilities">
            <div><span><Icon name="people" size={21}/></span><div><strong>Data kepegawaian</strong><p>Kelola dan perbarui informasi pegawai.</p></div></div>
            <div><span><Icon name="accounts" size={21}/></span><div><strong>Akun & kewenangan</strong><p>Akses fitur sesuai peran administrator.</p></div></div>
            <div><span><Icon name="audit" size={21}/></span><div><strong>Jejak aktivitas</strong><p>Tinjau riwayat pengelolaan sistem.</p></div></div>
          </div>
          <div className="admin-workspace__roles"><span>Akses untuk</span><strong>Admin Kominfo</strong><strong>Admin Master</strong></div>
        </section>
        <div className="admin-access-form">{authentication}<p className="admin-access-form__note"><Icon name="lock" size={15}/><span>Gunakan akun pribadi dan perangkat yang tepercaya.</span></p></div>
      </div>
      <footer className="admin-access-footer"><span>Administrasi · Data Kepegawaian Kominfo</span><LiveClock/></footer>
    </main>;
  }

  return <main className="login-page login-page--portal" data-login-area="portal">
    <header className="portal-access-header">
      <AppBrand compact/>
      <nav className="login-access-nav" aria-label="Navigasi halaman masuk"><Link href="/" className="back-link"><Icon name="home" size={17}/><span>Beranda</span></Link><ThemeToggle/></nav>
    </header>
    <div className="portal-access-shell login-shell--portal" data-login-layout="welcome">
      <section className="portal-welcome" aria-labelledby="portal-welcome-title">
        <div className="portal-welcome__copy"><span className="portal-welcome__eyebrow"><Icon name="people" size={16}/> Terhubung dalam satu portal</span><h2 id="portal-welcome-title">Kenali tim.<br/><span>Temukan informasi.</span></h2><p>Informasi pegawai lebih dekat, pencarian lebih mudah. Akses data kepegawaian sesuai kewenangan Anda.</p></div>
        <div className="portal-scene login-photo"><Image src={kegiatan} alt="Kegiatan Dinas Kominfo Kota Parepare" fill priority sizes="(max-width: 600px) 100vw, (max-width: 900px) 45vw, 560px"/><div className="portal-scene__caption"><span><Icon name="people" size={19}/></span><div><strong>Di balik setiap layanan, ada tim yang bergerak.</strong><small>Dinas Kominfo Kota Parepare</small></div></div></div>
        <div className="portal-welcome__features"><span><Icon name="search" size={17}/> Pencarian pegawai</span><span><Icon name="fields" size={17}/> Informasi terpusat</span></div>
      </section>
      <div className="portal-access-form">{authentication}<div className="portal-access-form__note"><Icon name="lock" size={15}/><span>Portal informasi internal kepegawaian.</span></div></div>
    </div>
    <footer className="portal-access-footer"><span>Sistem Data Kepegawaian · Kota Parepare</span><LiveClock/></footer>
  </main>;
}
