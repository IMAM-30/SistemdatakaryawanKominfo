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
import kegiatan from "../../image/kegiatan1.jpg";

type Area = "master" | "admin" | "portal";
const AREAS: Array<{ id: Area; label: string; helper: string }> = [
  { id: "master", label: "Master", helper: "Pengelola sistem" },
  { id: "admin", label: "Admin", helper: "Pengelola data" },
  { id: "portal", label: "Portal", helper: "Akses informasi" },
];

export function LoginScreen() {
  const router = useRouter();
  const [area, setArea] = useState<Area>("master");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try { await login({ username, password, area }); router.replace("/dashboard"); }
    catch (cause) { setError(errorMessage(cause)); setPending(false); }
  }

  return <main className="login-page">
    <section className="login-visual">
      <Image src={kegiatan} alt="Kegiatan Dinas Kominfo Kota Parepare" fill priority sizes="(max-width: 800px) 100vw, 48vw"/>
      <div className="login-visual__overlay"/>
      <div className="login-visual__brand"><AppBrand inverse/></div>
      <div className="login-visual__caption"><span className="eyebrow"><i/> Sistem internal</span><h2>Mengelola data pegawai dengan lebih terarah.</h2><p>Satu ruang kerja untuk data yang akurat, akses yang terkontrol, dan pelayanan yang dapat dipertanggungjawabkan.</p></div>
      <div className="login-visual__meta"><LiveClock/></div>
    </section>
    <section className="login-panel">
      <div className="login-panel__top"><Link href="/" className="back-link"><span>←</span> Kembali ke beranda</Link><ThemeToggle/></div>
      <div className="login-form-wrap">
        <div className="login-mobile-brand"><AppBrand compact/></div>
        <div className="login-heading"><span className="login-lock"><Icon name="lock"/></span><div><span className="eyebrow">Internal access</span><h1>Selamat datang kembali</h1><p>Masuk menggunakan akun yang telah terdaftar.</p></div></div>
        <div className="role-switch" role="tablist" aria-label="Jenis akses">
          {AREAS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={area === item.id} className={area === item.id ? "is-active" : ""} onClick={() => { setArea(item.id); setError(""); }}><strong>{item.label}</strong><small>{item.helper}</small></button>)}
        </div>
        <form className="login-form" onSubmit={submit}>
          {error && <div className="form-alert" role="alert"><Icon name="alert" size={18}/><span>{error}</span></div>}
          <div className="field"><label htmlFor="username">ID pengguna</label><div className="input-shell"><Icon name="user" size={19}/><input className="input" id="username" name="username" autoComplete="username" placeholder="Masukkan ID pengguna" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} required autoFocus/></div></div>
          <div className="field"><label htmlFor="password">Password</label><div className="input-shell"><Icon name="lock" size={19}/><input className="input" id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Masukkan password" value={password} onChange={(event) => setPassword(event.target.value)} required/><button className="input-shell__action" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}><Icon name="eye" size={18}/></button></div></div>
          <button className="button button--primary login-submit" disabled={pending} type="submit">{pending ? <><span className="spinner"/> Memverifikasi…</> : <>Masuk ke sistem <Icon name="chevron" size={18}/></>}</button>
        </form>
        <p className="login-help">Mengalami kendala akses? Hubungi Admin Kominfo atau Admin Master.</p>
      </div>
      <p className="login-panel__footer">Sistem Data Kepegawaian · Diskominfo Kota Parepare</p>
    </section>
  </main>;
}
