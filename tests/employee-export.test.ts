import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { jsPDF as PdfDocument } from "jspdf";
import { downloadEmployee, type EmployeeExportInput } from "../src/lib/export-data";
import type { UiField } from "../src/lib/ui-model";

interface PdfText { page: number; text: string; x: number; y: number; width: number; height: number }
interface CapturedPdf { document: PdfDocument; texts: PdfText[]; rectangles: number; filename?: string; output?: string }
const captures = vi.hoisted(() => ({ pdfs: [] as CapturedPdf[] }));

vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  return { ...actual, jsPDF: vi.fn(function (...args: ConstructorParameters<typeof actual.jsPDF>) {
    const document = new actual.jsPDF(...args);
    const capture: CapturedPdf = { document, texts: [], rectangles: 0 };
    captures.pdfs.push(capture);
    const text = document.text.bind(document);
    const rect = document.rect.bind(document);
    vi.spyOn(document, "text").mockImplementation((...args) => {
      const [value, x, y] = args;
      const lines = typeof value === "string" ? [value] : [...value];
      capture.texts.push({ page: document.getCurrentPageInfo().pageNumber, text: lines.join(" "), x, y, width: Math.max(0, ...lines.map((line) => document.getTextWidth(line))), height: lines.length * document.getLineHeight() / document.internal.scaleFactor });
      return text(...args);
    });
    vi.spyOn(document, "rect").mockImplementation((...args) => { capture.rectangles += 1; return rect(...args); });
    vi.spyOn(document, "save").mockImplementation((filename?: string) => { capture.filename = filename; capture.output = document.output(); return document; });
    return document;
  }) };
});

function field(key: string, label = key, sortOrder = 0): UiField {
  return { id: `pns-${key}`, categoryId: "pns", key, label, type: "text", required: false, tableVisible: false, publicVisible: false, portalVisible: true, adminVisible: true, sortOrder, active: true, system: false, version: 1 };
}

function input(): EmployeeExportInput {
  return {
    employee: { id: "employee-one", categoryId: "pns", active: true, version: 1, data: { name: "Imam Hudzaifah", nip: "00199205182016041003", serviceYears: 0, certified: false, notes: "Baris pertama\nBaris kedua" } },
    category: { id: "pns", code: "PNS", name: "Pegawai Negeri Sipil", active: true },
    fields: [field("name", "Nama lengkap", 1), field("nip", "NIP", 2), { ...field("serviceYears", "Masa kerja tahun", 3), type: "number" }, { ...field("certified", "Tersertifikasi", 4), type: "boolean" }, { ...field("notes", "Catatan", 5), type: "textarea" }],
  };
}

function captureExcel() {
  const anchors: Array<{ href: string; download: string; click: ReturnType<typeof vi.fn> }> = [];
  vi.stubGlobal("document", { createElement: vi.fn(() => { const anchor = { href: "", download: "", click: vi.fn() }; anchors.push(anchor); return anchor; }) });
  vi.stubGlobal("window", { setTimeout: vi.fn((callback: () => void) => { callback(); return 0; }) });
  const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:employee-export-test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  return { anchors, createUrl, workbook: async () => (createUrl.mock.calls[0][0] as Blob).text() };
}

function pdf() {
  expect(captures.pdfs).toHaveLength(1);
  const capture = captures.pdfs[0];
  expect(capture.output).toMatch(/^%PDF-/);
  return capture;
}

function assertReadableBounds(capture: CapturedPdf) {
  expect(capture.document.internal.pageSize.getWidth()).toBeCloseTo(210, 0);
  expect(capture.document.internal.pageSize.getHeight()).toBeCloseTo(297, 0);
  expect(capture.rectangles).toBe(0);
  for (const text of capture.texts) {
    expect(text.x, text.text).toBeGreaterThanOrEqual(15);
    expect(text.x + text.width, text.text).toBeLessThanOrEqual(194.1);
    expect(text.y, text.text).toBeGreaterThanOrEqual(10);
    expect(text.y + text.height, text.text).toBeLessThanOrEqual(290.1);
  }
  for (let index = 0; index < capture.texts.length; index += 1) {
    const a = capture.texts[index];
    for (const b of capture.texts.slice(index + 1)) {
      if (a.page !== b.page) continue;
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      expect(overlapX > 0.1 && overlapY > 0.1, `${a.text} overlaps ${b.text}`).toBe(false);
    }
  }
}

describe("individual employee downloads", () => {
  beforeAll(async () => { await import("jspdf"); });
  beforeEach(() => { captures.pdfs.length = 0; });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("exports exactly one Excel data row with every allowed field and preserves numeric, boolean, and long NIP values", async () => {
    const excel = captureExcel();
    await downloadEmployee(input(), "excel");
    const content = await excel.workbook();
    expect(content.match(/<Worksheet /g)).toHaveLength(1);
    expect(content.match(/<Row>/g)).toHaveLength(2);
    expect(content).toContain('<Worksheet ss:Name="PNS">');
    expect(content).toContain('<Data ss:Type="String">00199205182016041003</Data>');
    expect(content).toContain('<Data ss:Type="Number">0</Data>');
    expect(content).toContain('<Data ss:Type="Boolean">false</Data>');
    expect(content).toContain("Baris pertama\nBaris kedua");
    expect(excel.anchors[0].click).toHaveBeenCalledOnce();
    expect(captures.pdfs).toHaveLength(0);
  });

  it.each(["excel", "pdf", "both"] as const)("filters unavailable, other-category, photo, and non-provided fields in %s without mutating input", async (format) => {
    const excel = captureExcel();
    const data = input();
    data.fields.push({ ...field("inactive", "Inactive secret"), active: false }, { ...field("deleted", "Deleted secret"), deletedAt: "2026-10-19" }, { ...field("other", "Other category secret"), categoryId: "pppk" }, { ...field("photo", "Photo secret"), type: "photo" });
    Object.assign(data.employee.data, { inactive: "INACTIVE_SECRET", deleted: "DELETED_SECRET", other: "OTHER_SECRET", photo: "PHOTO_SECRET", hidden: "NOT_ALLOWED_SECRET" });
    const before = structuredClone(data);
    await downloadEmployee(data, format);
    const content = [format === "pdf" ? "" : await excel.workbook(), ...captures.pdfs.flatMap((item) => item.texts.map((entry) => entry.text))].join(" ");
    for (const secret of ["INACTIVE_SECRET", "DELETED_SECRET", "OTHER_SECRET", "PHOTO_SECRET", "NOT_ALLOWED_SECRET"]) expect(content).not.toContain(secret);
    expect(content).toContain("Imam Hudzaifah");
    expect(data).toEqual(before);
  });

  it("generates a readable portrait profile with grouped labels and no table grid", async () => {
    const data = input();
    data.fields.push(field("latestRank", "Pangkat terakhir", 6), field("position", "Jabatan", 7), field("lastEducation", "Pendidikan terakhir", 8));
    Object.assign(data.employee.data, { latestRank: "Penata", position: "Analis Data", lastEducation: "Sarjana" });
    await downloadEmployee(data, "pdf");
    const capture = pdf();
    assertReadableBounds(capture);
    const content = capture.texts.map((entry) => entry.text).join(" ");
    for (const label of ["Data Pribadi", "Kepangkatan", "Jabatan", "KGB & Pendidikan", "Data Tambahan", "Imam Hudzaifah", "00199205182016041003", "Penata", "Analis Data", "Sarjana", "Tidak", "Aktif"]) expect(content).toContain(label);
    expect(capture.texts.some((entry) => entry.x > 100 && entry.y < 270)).toBe(true);
  });

  it("continues long labels and values across pages without losing text or crossing the printable area", async () => {
    const data = input();
    const labelWords = Array.from({ length: 180 }, (_, index) => `Label${String(index).padStart(4, "0")}`);
    const words = Array.from({ length: 1500 }, (_, index) => `Isi${String(index).padStart(4, "0")}`);
    data.fields.push({ ...field("long", labelWords.join(" "), 20), type: "textarea" });
    data.employee.data.long = words.join(" ");
    await downloadEmployee(data, "pdf");
    const capture = pdf();
    assertReadableBounds(capture);
    expect(capture.document.getNumberOfPages()).toBeGreaterThan(2);
    const content = capture.texts.map((entry) => entry.text).join(" ");
    for (const word of [...labelWords, ...words]) expect(content.match(new RegExp(word, "g")), word).toHaveLength(1);
    for (let page = 1; page <= capture.document.getNumberOfPages(); page += 1) {
      expect(capture.texts.some((entry) => entry.page === page && entry.text.includes(`${page} / ${capture.document.getNumberOfPages()}`))).toBe(true);
    }
  });

  it("keeps many short fields readable across page breaks", async () => {
    const data = input();
    for (let index = 0; index < 80; index += 1) {
      const key = `custom${index}`;
      data.fields.push(field(key, `Kolom ${index}`, index + 30));
      data.employee.data[key] = `Nilai${String(index).padStart(4, "0")}`;
    }
    await downloadEmployee(data, "pdf");
    const capture = pdf();
    assertReadableBounds(capture);
    expect(capture.document.getNumberOfPages()).toBeGreaterThan(2);
    const content = capture.texts.map((entry) => entry.text).join(" ");
    for (let index = 0; index < 80; index += 1) expect(content.match(new RegExp(`Nilai${String(index).padStart(4, "0")}`, "g"))).toHaveLength(1);
  });

  it("exports archived employees and archived categories with a truthful status", async () => {
    const excel = captureExcel();
    const data = input();
    data.employee.deletedAt = "2026-10-19";
    data.category!.deletedAt = "2026-10-19";
    await downloadEmployee(data, "both");
    const workbook = await excel.workbook();
    expect(workbook.match(/<Row>/g)).toHaveLength(2);
    expect(workbook).toContain("Imam Hudzaifah");
    expect(workbook).toContain("Diarsipkan");
    expect(pdf().texts.map((entry) => entry.text).join(" ")).toContain("Diarsipkan");
    expect(data.employee.deletedAt).toBe("2026-10-19");
  });

  it("handles a missing category, empty values, and inactive employee", async () => {
    const excel = captureExcel();
    const data = input();
    data.category = undefined;
    data.employee.active = false;
    data.employee.data.notes = null;
    await downloadEmployee(data, "both");
    expect(await excel.workbook()).toContain('<Worksheet ss:Name="Pegawai">');
    expect(pdf().texts.map((entry) => entry.text).join(" ")).toContain("Tidak aktif");
    assertReadableBounds(pdf());
  });

  it("uses the same safe descriptive filename for both formats", async () => {
    const excel = captureExcel();
    const data = input();
    data.employee.data.name = "Dr. Émilia / A: B <C> | D?";
    await downloadEmployee(data, "both");
    expect(excel.anchors[0].download).toMatch(/^data-pegawai-dr-emilia-a-b-c-d-\d{4}-\d{2}-\d{2}\.xls$/);
    expect(pdf().filename).toBe(excel.anchors[0].download.replace(/\.xls$/, ".pdf"));
  });

  it("omits a damaged optional photo while preserving the complete text export", async () => {
    await downloadEmployee({ ...input(), photo: { mimeType: "image/png", base64: "not-an-image" } }, "pdf");
    const capture = pdf();
    assertReadableBounds(capture);
    expect(capture.texts.map((entry) => entry.text).join(" ")).toContain("00199205182016041003");
  });

  it("embeds an available photo without crossing text columns", async () => {
    await downloadEmployee({ ...input(), photo: { mimeType: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" } }, "pdf");
    const capture = pdf();
    expect(capture.output).toContain("/Subtype /Image");
    assertReadableBounds(capture);
    for (const entry of capture.texts.filter((entry) => entry.y >= 24 && entry.y < 58)) expect(entry.x + entry.width).toBeLessThan(167);
  });

  it("does not fall back to undisclosed data when no fields are visible", async () => {
    const excel = captureExcel();
    const data = input();
    data.fields = [];
    data.employee.data.privateValue = "DO_NOT_EXPORT";
    await downloadEmployee(data, "both");
    expect(await excel.workbook()).not.toContain("DO_NOT_EXPORT");
    expect(pdf().texts.map((entry) => entry.text).join(" ")).not.toContain("DO_NOT_EXPORT");
    assertReadableBounds(pdf());
  });

  it("wraps long unbroken names and values without clipping or dropping characters", async () => {
    const data = input();
    data.employee.data.name = "W".repeat(180);
    data.employee.data.notes = "Z".repeat(1000);
    await downloadEmployee(data, "pdf");
    const capture = pdf();
    assertReadableBounds(capture);
    const content = capture.texts.map((entry) => entry.text).join("").replaceAll(" ", "");
    expect(content).toContain("Z".repeat(1000));
    expect(content).toContain("W".repeat(180));
  });
});
