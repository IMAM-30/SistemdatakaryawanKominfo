import Image from "next/image";
import logoKominfo from "../../image/logoKominfo.png";

export function AppBrand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return <div className={`app-brand ${compact ? "app-brand--compact" : ""} ${inverse ? "app-brand--inverse" : ""}`}>
    <span className="app-brand__logo"><Image src={logoKominfo} alt="Logo Dinas Kominfo Parepare" priority sizes="64px"/></span>
    <span className="app-brand__copy">
      <strong>Data Kepegawaian</strong>
      <small>Dinas Komunikasi dan Informatika</small>
      {!compact && <em>Kota Parepare</em>}
    </span>
  </div>;
}
