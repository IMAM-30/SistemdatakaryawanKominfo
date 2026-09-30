"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Makassar" });
const timeFormatter = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Makassar" });

export function LiveClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const initial = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);
  return <div className={`live-clock ${compact ? "live-clock--compact" : ""}`} aria-label="Waktu Indonesia Tengah">
    <Icon name="clock" size={17}/>
    <span className="live-clock__time">{now ? timeFormatter.format(now).replaceAll(".", ":") : "--:--:--"}</span>
    {!compact && <span className="live-clock__date">{now ? dateFormatter.format(now) : "Waktu Indonesia Tengah"}</span>}
    <span className="live-clock__zone">WITA</span>
  </div>;
}
