import { describe, expect, it } from "vitest";
import { auditActorLabel, auditChangeRows, auditEntityLabel } from "@/lib/audit-log";
import type { UiAudit } from "@/lib/ui-model";

const item: UiAudit = {
  id: "audit-1",
  actorId: "account-1",
  actorRole: "KOMINFO_ADMIN",
  actorUsername: "imam.admin",
  actorDisplayName: "Imam Hudzaifah",
  action: "employees.update",
  entityType: "EMPLOYEE",
  entityId: "employee-1",
  summary: {
    entityName: "Aisyah Rahma",
    changes: [
      { field: "name", label: "Nama", before: "Aisyah", after: "Aisyah Rahma" },
      { field: "active", label: "Status", before: true, after: false },
    ],
  },
  createdAt: "2026-10-19T10:00:00+08:00",
};

describe("audit log presentation", () => {
  it("identifies the exact admin username and affected record", () => {
    expect(auditActorLabel(item)).toBe("Imam Hudzaifah (@imam.admin)");
    expect(auditEntityLabel(item)).toBe("Aisyah Rahma");
  });

  it("presents every before and after value in readable Indonesian", () => {
    expect(auditChangeRows(item)).toEqual([
      { label: "Nama", before: "Aisyah", after: "Aisyah Rahma" },
      { label: "Status", before: "Aktif", after: "Tidak aktif" },
    ]);
  });

  it("keeps legacy audit rows readable", () => {
    const legacy = { ...item, actorUsername: undefined, actorDisplayName: undefined, summary: { categoryId: "PNS" } };
    expect(auditActorLabel(legacy)).toBe("Admin Kominfo · ID account-");
    expect(auditEntityLabel(legacy)).toBe("EMPLOYEE · employee");
    expect(auditChangeRows(legacy)).toEqual([]);
  });
});
