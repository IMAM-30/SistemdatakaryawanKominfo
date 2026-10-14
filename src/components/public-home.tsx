"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AppBrand } from "@/components/app-brand";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { Icon } from "@/components/icons";
import { LiveClock } from "@/components/live-clock";
import { ThemeToggle } from "@/components/theme-toggle";
import { backend, errorMessage } from "@/lib/client-api";
import { employeeName, type UiCategory, type UiEmployee, type UiField } from "@/lib/ui-model";
import kegiatan from "../../image/kegiatan1.jpg";
import pemda from "../../image/Kota Parepare.png";

export function PublicHome() {
  const [portalMode, setPortalMode] = useState<"PUBLIC" | "LOGIN_REQUIRED" | "CLOSED" | "LOADING">("LOADING");
  const [categories, setCategories] = useState<UiCategory[]>([]);
  const [fields, setFields] = useState<UiField[]>([]);
  const [employees, setEmployees] = useState<UiEmployee[]>([]);
  const [categoryId, setCategoryId] = useState("all");
  const [query, setQuery] = useState("");
  const [portalError, setPortalError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadPortal() {
      try {
        const settings = await backend<{ portalMode: "PUBLIC" | "LOGIN_REQUIRED" | "CLOSED" }>("settings.public");
        if (!active) return;
        setPortalMode(settings.portalMode);
        if (settings.portalMode !== "PUBLIC") return;
        const [categoryResult, fieldResult, employeeResult] = await Promise.all([
          backend<{ items: UiCategory[] }>("categories.publicList"),
          backend<{ items: UiField[] }>("fields.publicList"),
          backend<{ items: UiEmployee[] }>("employees.publicList"),
        ]);
        if (!active) return;
        setCategories(categoryResult.items); setFields(fieldResult.items); setEmployees(employeeResult.items);
      } catch (cause) { if (active) { setPortalError(errorMessage(cause)); setPortalMode("CLOSED"); } }
    }
    loadPortal();
    return () => { active = false; };
  }, []);

  const visibleEmployees = useMemo(() => employees.filter((employee) => {
    if (categoryId !== "all" && employee.categoryId !== categoryId) return false;
    const needle = query.trim().toLocaleLowerCase("id-ID");
    return !needle || Object.values(employee.data).some((value) => String(value ?? "").toLocaleLowerCase("id-ID").includes(needle));
  }), [categoryId, employees, query]);

  return <main className="public-page">
    <header className="public-header">
      <Link href="/" aria-label="Beranda"><AppBrand compact/></Link>
      <div className="public-header__actions"><LiveClock compact/><ThemeToggle/><Link className="button button--primary button--small" href="/login"><Icon name="lock" size={16}/> Masuk</Link></div>
    </header>
    <section className="public-hero">
      <div className="public-hero__media"><Image src={kegiatan} alt="Kegiatan pegawai Dinas Kominfo Kota Parepare" fill priority sizes="(max-width: 850px) 100vw, 54vw"/></div>
      <div className="public-hero__shade"/>
      <div className="public-hero__copy">
        <span className="eyebrow"><i/> Satu data, pelayanan lebih baik</span>
        <h1>Data kepegawaian yang tertata, aman, dan mudah dikelola.</h1>
        <p>Portal terpadu Dinas Komunikasi dan Informatika Kota Parepare untuk mengelola informasi PNS, PPPK, dan tenaga Non-ASN.</p>
        <div className="public-hero__buttons"><Link className="button button--primary" href="/login">Masuk ke sistem <Icon name="chevron" size={18}/></Link><a className="button button--secondary" href="#layanan">Lihat layanan</a></div>
      </div>
      <div className="public-hero__seal"><Image src={pemda} alt="Lambang Kota Parepare" sizes="74px"/><span><small>Pemerintah</small><strong>Kota Parepare</strong></span></div>
    </section>
    <section className="public-services" id="layanan">
      <div className="section-heading"><div><span className="eyebrow">Portal Kepegawaian</span><h2>Informasi dalam satu ruang kerja</h2></div><p>Dirancang untuk mempercepat pencarian data sekaligus menjaga kendali akses setiap pengguna.</p></div>
      <div className="service-grid">
        <article><span className="service-icon"><Icon name="database"/></span><h3>Data terpusat</h3><p>Struktur data pegawai tersusun per kategori dengan kolom yang dapat disesuaikan kebutuhan dinas.</p></article>
        <article><span className="service-icon"><Icon name="accounts"/></span><h3>Akses berbasis peran</h3><p>Admin Master, Admin Kominfo, dan Portal mendapatkan ruang kerja sesuai kewenangannya.</p></article>
        <article><span className="service-icon"><Icon name="audit"/></span><h3>Aktivitas tercatat</h3><p>Perubahan penting direkam dalam audit log untuk mendukung akuntabilitas pengelolaan data.</p></article>
      </div>
    </section>
    <section className="public-directory" id="direktori">
      <div className="section-heading"><div><span className="eyebrow">Direktori Publik</span><h2>Informasi pegawai yang dapat diakses publik</h2></div><p>Hanya kolom yang disetujui admin untuk akses publik yang ditampilkan.</p></div>
      {portalMode === "LOADING" && <div className="portal-state"><span className="loading-mark"><i/><i/><i/></span><h3>Memeriksa akses portal</h3><p>Menyiapkan informasi terbaru…</p></div>}
      {portalMode === "LOGIN_REQUIRED" && <div className="portal-state"><Icon name="lock" size={28}/><h3>Portal memerlukan login</h3><p>Masuk menggunakan akun Portal untuk melihat informasi pegawai.</p><Link className="button button--primary" href="/login">Masuk ke Portal</Link></div>}
      {portalMode === "CLOSED" && <div className="portal-state"><Icon name="database" size={28}/><h3>Direktori publik sedang ditutup</h3><p>{portalError || "Akses publik sedang dinonaktifkan oleh administrator."}</p></div>}
      {portalMode === "PUBLIC" && <><div className="public-directory__toolbar"><div className="input-shell"><Icon name="search" size={18}/><input className="input" aria-label="Cari direktori publik" placeholder="Cari nama atau jabatan" value={query} onChange={(event) => setQuery(event.target.value)}/></div><select className="select" aria-label="Filter kategori publik" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">Semua kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
        {visibleEmployees.length ? <div className="public-employee-grid">{visibleEmployees.map((employee) => { const category = categories.find((item) => item.id === employee.categoryId); const employeeFields = fields.filter((field) => field.categoryId === employee.categoryId && field.type !== "photo").slice(0, 3); const name = employeeName(employee); return <article key={employee.id}><EmployeeAvatar fileId={employee.photoFileId} name={name} publicAccess/><div><small>{category?.name ?? "Pegawai"}</small><h3>{name}</h3>{employeeFields.filter((field) => field.key !== "name").map((field) => <p key={field.id}><span>{field.label}</span><strong>{String(employee.data[field.key] ?? "—")}</strong></p>)}</div></article>; })}</div> : <div className="portal-state portal-state--compact"><Icon name="search" size={25}/><h3>Data tidak ditemukan</h3><p>Ubah kata pencarian atau kategori untuk melihat data lainnya.</p></div>}
      </>}
    </section>
    <footer className="public-footer"><AppBrand compact/><p>© {new Date().getFullYear()} Dinas Komunikasi dan Informatika Kota Parepare</p></footer>
  </main>;
}
