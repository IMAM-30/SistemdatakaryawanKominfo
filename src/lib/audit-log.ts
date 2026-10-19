import { dateForDisplay } from "@/lib/date-format";
import type { UiAudit } from "@/lib/ui-model";

export interface AuditChangeRow {
  label: string;
  before: string;
  after: string;
}

export function auditActorLabel(item: UiAudit): string {
  if (item.actorUsername) return item.actorDisplayName ? `${item.actorDisplayName} (@${item.actorUsername})` : `@${item.actorUsername}`;
  const role = item.actorRole === "MASTER_ADMIN" ? "Admin Master" : item.actorRole === "KOMINFO_ADMIN" ? "Admin Kominfo" : item.actorRole;
  return `${role} · ID ${item.actorId.slice(0, 8)}`;
}

export function auditEntityLabel(item: UiAudit): string {
  const name = item.summary?.entityName;
  return typeof name === "string" && name.trim() ? name : `${item.entityType} · ${item.entityId.slice(0, 8)}`;
}

export function auditChangeRows(item: UiAudit): AuditChangeRow[] {
  const changes = item.summary?.changes;
  if (!Array.isArray(changes)) return [];
  return changes.flatMap((change) => {
    if (!change || typeof change !== "object") return [];
    const record = change as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label : typeof record.field === "string" ? record.field : "Data";
    return [{ label, before: auditValue(record.before, label), after: auditValue(record.after, label) }];
  });
}

export function legacyAuditSummary(item: UiAudit): string {
  if (!item.summary) return "Tindakan berhasil diproses oleh sistem.";
  const entries = Object.entries(item.summary).filter(([key]) => key !== "entityName" && key !== "changes");
  return entries.length ? entries.map(([key, value]) => `${key}: ${auditValue(value, key)}`).join(" · ") : "Tidak ada rincian nilai tambahan.";
}

function auditValue(value: unknown, label: string): string {
  if (value === undefined || value === null || value === "") return "Kosong";
  if (typeof value === "boolean") return /status|aktif/i.test(label) ? value ? "Aktif" : "Tidak aktif" : value ? "Ya" : "Tidak";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return dateForDisplay(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
