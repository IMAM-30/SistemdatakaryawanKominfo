"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

const PAGE_SIZE = 10;

export function useProgressiveList<T>(records: T[], resetKey = "") {
  const [window, setWindow] = useState({ key: resetKey, count: PAGE_SIZE });
  const count = window.key === resetKey ? window.count : PAGE_SIZE;
  if (window.key !== resetKey) setWindow({ key: resetKey, count: PAGE_SIZE });
  const shown = Math.min(count, records.length);
  return {
    items: records.slice(0, shown),
    shown,
    total: records.length,
    hasMore: shown < records.length,
    showMore: () => setWindow((current) => ({ key: resetKey, count: (current.key === resetKey ? current.count : PAGE_SIZE) + PAGE_SIZE })),
  };
}

export function ListMoreControl({ list, label = "data", controls }: {
  list: { shown: number; total: number; hasMore: boolean; showMore: () => void };
  label?: string;
  controls: string;
}) {
  if (!list.total) return null;
  return <div className="list-more">
    <p role="status" aria-live="polite" aria-atomic="true">Menampilkan <strong>{list.shown}</strong> dari <strong>{list.total}</strong> {label}</p>
    {list.hasMore && <button type="button" className="button button--secondary button--small" aria-controls={controls} onClick={list.showMore}>Tampilkan 10 lagi <Icon name="chevron" size={16}/></button>}
  </div>;
}
