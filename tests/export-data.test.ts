import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { jsPDF as PdfDocument } from "jspdf";
import { downloadSnapshot, type ExportSnapshot } from "../src/lib/export-data";
import type { UiEmployee, UiField } from "../src/lib/ui-model";

interface PdfRectangle { page: number; x: number; y: number; width: number; height: number }
interface PdfText { page: number; lines: string[]; x: number; y: number; width: number; lineHeight: number }
interface CapturedPdf { document: PdfDocument; rectangles: PdfRectangle[]; texts: PdfText[]; filename?: string; output?: string }

const captures = vi.hoisted(() => ({ pdfs: [] as CapturedPdf[] }));

vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  return {
    ...actual,
    jsPDF: vi.fn(function (...args: ConstructorParameters<typeof actual.jsPDF>) {
      const document = new actual.jsPDF(...args);
      const capture: CapturedPdf = { document, rectangles: [], texts: [] };
      captures.pdfs.push(capture);
      const rect = document.rect.bind(document);
      const text = document.text.bind(document);
      vi.spyOn(document, "rect").mockImplementation((...rectArgs) => {
        const [x, y, width, height] = rectArgs;
        capture.rectangles.push({ page: document.getCurrentPageInfo().pageNumber, x, y, width, height });
        return rect(...rectArgs);
      });
      vi.spyOn(document, "text").mockImplementation((...textArgs) => {
        const [value, x, y] = textArgs;
        const lines = typeof value === "string" ? [value] : [...value];
        capture.texts.push({ page: document.getCurrentPageInfo().pageNumber, lines, x, y, width: Math.max(0, ...lines.map((line) => document.getTextWidth(line))), lineHeight: document.getLineHeight() / document.internal.scaleFactor });
        return text(...textArgs);
      });
      vi.spyOn(document, "save").mockImplementation((filename?: string) => {
        capture.filename = filename;
        capture.output = document.output();
        return document;
      });
      return document;
    }),
  };
});

function field(key: string, label: string, sortOrder: number, categoryId = "pns"): UiField {
  return { id: `${categoryId}-${key}`, categoryId, key, label, type: "text", required: false, tableVisible: true, publicVisible: false, portalVisible: true, adminVisible: true, sortOrder, active: true, system: false, version: 1 };
}

function employee(id: string, data: Record<string, unknown>, categoryId = "pns"): UiEmployee {
  return { id, categoryId, data, active: true, version: 1 };
}

function snapshot(employees: UiEmployee[] = []): ExportSnapshot {
  return {
    categories: [{ id: "pns", code: "PNS", name: "Pegawai Negeri Sipil", active: true }],
    fields: [field("name", "Nama", 1), field("notes", "Keterangan", 2)],
    employees,
  };
}

function pdf(): CapturedPdf {
  expect(captures.pdfs).toHaveLength(1);
  const capture = captures.pdfs[0];
  expect(capture.filename).toMatch(/^data-kepegawaian-\d{4}-\d{2}-\d{2}\.pdf$/);
  expect(capture.output).toMatch(/^%PDF-/);
  return capture;
}

function expectCompleteGrid(capture: CapturedPdf, columns: number) {
  expect(capture.rectangles.length).toBeGreaterThan(0);
  const rows = new Map<string, PdfRectangle[]>();
  for (const rectangle of capture.rectangles) {
    expect(rectangle.x).toBeGreaterThanOrEqual(14 - 0.001);
    expect(rectangle.y).toBeGreaterThanOrEqual(16 - 0.001);
    expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(282.001);
    expect(rectangle.y + rectangle.height).toBeLessThanOrEqual(195.001);
    expect(rectangle.height).toBeGreaterThan(0);
    const key = `${rectangle.page}:${rectangle.y.toFixed(4)}`;
    rows.set(key, [...(rows.get(key) ?? []), rectangle]);
  }
  for (const row of rows.values()) {
    row.sort((left, right) => left.x - right.x);
    expect(row).toHaveLength(columns);
    expect(row[0].x).toBeCloseTo(14, 4);
    expect(row.at(-1)!.x + row.at(-1)!.width).toBeCloseTo(282, 4);
    row.forEach((cell, index) => {
      expect(cell.height).toBeCloseTo(row[0].height, 4);
      if (index > 0) expect(cell.x).toBeCloseTo(row[index - 1].x + row[index - 1].width, 4);
    });
  }
  const operators = capture.output!.match(/[-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ re\s+(?:S|B\*?)(?:\s|$)/g) ?? [];
  expect(operators.length).toBeGreaterThanOrEqual(capture.rectangles.length);
}

function expectTextInsidePage(capture: CapturedPdf) {
  for (const text of capture.texts) {
    expect(text.y).toBeGreaterThan(0);
    expect(text.x + text.width).toBeLessThanOrEqual(282.1);
    expect(text.y + Math.max(0, text.lines.length - 1) * text.lineHeight).toBeLessThanOrEqual(195.1);
  }
}

describe("downloaded PDF tables", () => {
  beforeEach(() => { captures.pdfs.length = 0; });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it.each(["pdf", "excel", "both"] as const)("rejects a %s download with no categories before creating an empty file", async (format) => {
    const createElement = vi.fn();
    vi.stubGlobal("document", { createElement });
    for (const categories of [[], [{ ...snapshot().categories[0], deletedAt: "2026-10-18T00:00:00.000Z" }]]) {
      await expect(downloadSnapshot({ ...snapshot(), categories }, format)).rejects.toThrow("Belum ada kategori yang dapat diekspor.");
    }
    expect(createElement).not.toHaveBeenCalled();
    expect(captures.pdfs).toHaveLength(0);
  });

  it("draws a closed cell grid for headers, data, and empty values without changing their content", async () => {
    await downloadSnapshot(snapshot([employee("1", { name: "Imam", notes: "Analis Data" }), employee("2", { name: "Sitti" })]), "pdf");
    const capture = pdf();
    expectCompleteGrid(capture, 4);
    expect(capture.rectangles).toHaveLength(12);
    const content = capture.texts.flatMap((entry) => entry.lines).join(" ");
    for (const value of ["No.", "Nama", "Keterangan", "Status", "Imam", "Analis Data", "Sitti", "Aktif"]) expect(content).toContain(value);
    expectTextInsidePage(capture);
  });

  it("keeps a bordered header for an empty category and starts the next category on its own page", async () => {
    const input = snapshot([employee("1", { name: "Imam" })]);
    input.categories.push({ id: "pppk", code: "PPPK", name: "PPPK", active: true });
    input.fields.push(field("name", "Nama", 1, "pppk"), field("notes", "Keterangan", 2, "pppk"));
    await downloadSnapshot(input, "pdf");
    const capture = pdf();
    expect(capture.document.getNumberOfPages()).toBe(2);
    expectCompleteGrid(capture, 4);
    expect(capture.rectangles.filter((rectangle) => rectangle.page === 1)).toHaveLength(8);
    expect(capture.rectangles.filter((rectangle) => rectangle.page === 2)).toHaveLength(4);
    expect(capture.texts.filter((entry) => entry.page === 2).flatMap((entry) => entry.lines)).toContain("Nama");
  });

  it("repeats all header cells and borders on every continuation page without losing rows", async () => {
    const employees = Array.from({ length: 90 }, (_, index) => employee(String(index), { name: `Pegawai${String(index).padStart(3, "0")}`, notes: "Kantor" }));
    await downloadSnapshot(snapshot(employees), "pdf");
    const capture = pdf();
    expect(capture.document.getNumberOfPages()).toBeGreaterThan(1);
    expectCompleteGrid(capture, 4);
    for (let page = 1; page <= capture.document.getNumberOfPages(); page += 1) {
      const lines = capture.texts.filter((entry) => entry.page === page).flatMap((entry) => entry.lines);
      for (const header of ["No.", "Nama", "Keterangan", "Status"]) expect(lines).toContain(header);
    }
    const content = capture.texts.flatMap((entry) => entry.lines).join(" ");
    employees.forEach((item) => expect(content.match(new RegExp(String(item.data.name), "g"))).toHaveLength(1));
    expectTextInsidePage(capture);
  });

  it("wraps and continues a single oversized row with complete borders and no dropped text", async () => {
    const words = Array.from({ length: 450 }, (_, index) => `Baris${String(index).padStart(4, "0")}`);
    await downloadSnapshot(snapshot([employee("long", { name: "Imam", notes: words.join(" ") })]), "pdf");
    const capture = pdf();
    expect(capture.document.getNumberOfPages()).toBeGreaterThan(1);
    expectCompleteGrid(capture, 4);
    expectTextInsidePage(capture);
    const content = capture.texts.flatMap((entry) => entry.lines).join(" ");
    words.forEach((word) => expect(content.match(new RegExp(word, "g"))).toHaveLength(1));
    for (let page = 1; page <= capture.document.getNumberOfPages(); page += 1) {
      const lines = capture.texts.filter((entry) => entry.page === page).flatMap((entry) => entry.lines);
      for (const header of ["No.", "Nama", "Keterangan", "Status"]) expect(lines).toContain(header);
    }
  });

  it("fits every cell of a wide 22-column export within A4 landscape", async () => {
    const input = snapshot([employee("wide", Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`field${index}`, `Data ${index}`])))]);
    input.fields = Array.from({ length: 20 }, (_, index) => field(`field${index}`, `Kolom ${index + 1}`, index));
    await downloadSnapshot(input, "pdf");
    const capture = pdf();
    expectCompleteGrid(capture, 22);
    expect(capture.rectangles).toHaveLength(44);
    expect(capture.document.internal.pageSize.getWidth()).toBeCloseTo(297, 0);
    expect(capture.document.internal.pageSize.getHeight()).toBeCloseTo(210, 0);
    expectTextInsidePage(capture);
  });

  it("keeps long custom headers inside the page when additional columns are exported", async () => {
    const input = snapshot();
    const label = "W".repeat(120);
    input.fields = Array.from({ length: 28 }, (_, index) => field(`field${index}`, index === 0 ? label : `Kolom ${index + 1}`, index));
    await downloadSnapshot(input, "pdf");
    const capture = pdf();
    expectCompleteGrid(capture, 30);
    expectTextInsidePage(capture);
    expect(capture.texts.map((entry) => entry.lines.join("")).join(" ")).toContain(label);
  });

  it("retains direct Excel downloads and exports the same bordered PDF when both formats are selected", async () => {
    const anchors: Array<{ href: string; download: string; click: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal("document", { createElement: vi.fn(() => { const anchor = { href: "", download: "", click: vi.fn() }; anchors.push(anchor); return anchor; }) });
    vi.stubGlobal("window", { setTimeout: vi.fn((callback: () => void) => { callback(); return 0; }) });
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export-test");
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const input = snapshot([employee("1", { name: "Imam" })]);
    await downloadSnapshot(input, "excel");
    expect(captures.pdfs).toHaveLength(0);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].download).toMatch(/\.xls$/);
    expect(anchors[0].click).toHaveBeenCalledOnce();
    const workbook = await (createUrl.mock.calls[0][0] as Blob).text();
    expect(workbook).toContain('<Worksheet ss:Name="PNS">');
    expect(workbook).toContain(">Imam</Data>");
    await downloadSnapshot(input, "both");
    expect(anchors).toHaveLength(2);
    expect(anchors[1].click).toHaveBeenCalledOnce();
    expect(revokeUrl).toHaveBeenCalledTimes(2);
    expectCompleteGrid(pdf(), 4);
  });
});

function multiCategorySnapshot(): ExportSnapshot {
  const categories = [
    { id: "pns", code: "PNS", name: "Pegawai Negeri Sipil", active: true },
    { id: "pppk", code: "PPPK", name: "Pegawai Pemerintah dengan Perjanjian Kerja", active: true },
    { id: "non-asn", code: "NON_PNS", name: "Non ASN", active: false },
  ];
  return {
    categories,
    fields: categories.map((category) => field("name", `Nama ${category.code}`, 1, category.id)),
    employees: categories.flatMap((category) => Array.from({ length: 12 }, (_, index) => ({
      ...employee(`${category.id}-${index}`, { name: `Pegawai${category.code}${String(index + 1).padStart(2, "0")}` }, category.id),
      active: index !== 11,
    }))),
  };
}

function captureExcelDownloads() {
  const anchors: Array<{ href: string; download: string; click: ReturnType<typeof vi.fn> }> = [];
  vi.stubGlobal("document", { createElement: vi.fn(() => {
    const anchor = { href: "", download: "", click: vi.fn() };
    anchors.push(anchor);
    return anchor;
  }) });
  vi.stubGlobal("window", { setTimeout: vi.fn((callback: () => void) => { callback(); return 0; }) });
  const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:category-export-test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  return { anchors, createUrl };
}

describe("category-scoped downloads", () => {
  beforeEach(() => { captures.pdfs.length = 0; });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  const selections = Array.from({ length: 7 }, (_, index) => ["pns", "pppk", "non-asn"].filter((_, category) => (index + 1) & (1 << category)));
  for (const format of ["pdf", "excel"] as const) {
    it.each(selections.map((ids) => ({ ids, label: ids.join(" + ") })))(`exports only $label to ${format}, including every row beyond the visible first ten`, async ({ ids }) => {
      const input = multiCategorySnapshot();
      const original = structuredClone(input);
      const { anchors, createUrl } = captureExcelDownloads();
      await downloadSnapshot(input, format, ids);
      const content = format === "pdf"
        ? captures.pdfs[0].texts.flatMap((text) => text.lines).join(" ")
        : await (createUrl.mock.calls[0][0] as Blob).text();
      const filename = format === "pdf" ? captures.pdfs[0].filename : anchors[0].download;
      const suffix = ids.length === 3 ? "" : `-${ids.join("-")}`;
      expect(filename).toMatch(new RegExp(`^data-kepegawaian${suffix}-\\d{4}-\\d{2}-\\d{2}\\.${format === "pdf" ? "pdf" : "xls"}$`));
      input.categories.forEach((category) => {
        const title = category.code === "NON_PNS" ? "Non-ASN" : category.code;
        const marker = format === "pdf" ? `Data Kepegawaian - ${title}` : `<Worksheet ss:Name="${title}">`;
        if (ids.includes(category.id)) {
          expect(content).toContain(marker);
          expect(content).toContain(`Nama ${category.code}`);
          for (const item of input.employees.filter((item) => item.categoryId === category.id)) {
            expect(content.split(String(item.data.name))).toHaveLength(2);
          }
        } else {
          expect(content).not.toContain(marker);
          expect(content).not.toContain(`Nama ${category.code}`);
          for (const item of input.employees.filter((item) => item.categoryId === category.id)) expect(content).not.toContain(String(item.data.name));
        }
      });
      expect(content).toContain("Tidak aktif");
      expect(input).toEqual(original);
      if (format === "pdf") expectCompleteGrid(captures.pdfs[0], 3);
      else expect(anchors[0].click).toHaveBeenCalledOnce();
    });
  }

  it("uses snapshot order, deduplicates selections, and exports the same categories in both formats", async () => {
    const { anchors, createUrl } = captureExcelDownloads();
    await downloadSnapshot(multiCategorySnapshot(), "both", ["non-asn", "pns", "pns"]);
    const pdfContent = captures.pdfs[0].texts.flatMap((text) => text.lines).join(" ");
    const workbook = await (createUrl.mock.calls[0][0] as Blob).text();
    expect(pdfContent.indexOf("Data Kepegawaian - PNS")).toBeLessThan(pdfContent.indexOf("Data Kepegawaian - Non-ASN"));
    expect(workbook.indexOf('<Worksheet ss:Name="PNS">')).toBeLessThan(workbook.indexOf('<Worksheet ss:Name="Non-ASN">'));
    expect(workbook.match(/<Worksheet /g)).toHaveLength(2);
    expect(captures.pdfs[0].document.getNumberOfPages()).toBe(2);
    for (const content of [pdfContent, workbook]) {
      expect(content).not.toContain("PegawaiPPPK");
      expect(content).toContain("PegawaiPNS12");
      expect(content).toContain("PegawaiNON_PNS12");
    }
    expect(anchors[0].download).toMatch(/^data-kepegawaian-pns-non-asn-\d{4}-\d{2}-\d{2}\.xls$/);
    expect(captures.pdfs[0].filename).toBe(anchors[0].download.replace(/\.xls$/, ".pdf"));
  });

  it.each(["pdf", "excel", "both"] as const)("rejects empty, unknown, and deleted category selections before creating any %s files", async (format) => {
    const { anchors, createUrl } = captureExcelDownloads();
    const input = multiCategorySnapshot();
    input.categories.push({ id: "deleted", code: "OLD", name: "Dihapus", active: false, deletedAt: "2026-10-18T00:00:00.000Z" });
    await expect(downloadSnapshot(input, format, [])).rejects.toThrow("Pilih minimal satu jenis data untuk diunduh.");
    for (const ids of [["unknown"], ["deleted"], ["pns", "unknown"], ["pppk", "deleted"]]) {
      await expect(downloadSnapshot(input, format, ids)).rejects.toThrow("Jenis data yang dipilih sudah tidak tersedia. Muat ulang data lalu pilih kembali.");
    }
    expect(anchors).toHaveLength(0);
    expect(createUrl).not.toHaveBeenCalled();
    expect(captures.pdfs).toHaveLength(0);
  });

  it("preserves the default all-category filename and excludes deleted rows and categories", async () => {
    const input = multiCategorySnapshot();
    input.categories.push({ id: "deleted", code: "OLD", name: "Dihapus", active: false, deletedAt: "2026-10-18T00:00:00.000Z" });
    input.employees.push({ ...employee("deleted-employee", { name: "PegawaiDihapus" }), deletedAt: "2026-10-18T00:00:00.000Z" });
    const { anchors, createUrl } = captureExcelDownloads();
    await downloadSnapshot(input, "both");
    expect(anchors[0].download).toMatch(/^data-kepegawaian-\d{4}-\d{2}-\d{2}\.xls$/);
    const capture = pdf();
    const workbook = await (createUrl.mock.calls[0][0] as Blob).text();
    expect(workbook.match(/<Worksheet /g)).toHaveLength(3);
    expect(capture.document.getNumberOfPages()).toBe(3);
    for (const content of [workbook, capture.texts.flatMap((text) => text.lines).join(" ")]) {
      expect(content).not.toContain("PegawaiDihapus");
      expect(content).not.toContain("OLD");
    }
  });

  it("keeps partial filenames bounded and safe for custom category codes", async () => {
    const input = multiCategorySnapshot();
    input.categories.push({ id: "custom", code: "../../évil/" + "LongCode".repeat(30), name: "Custom", active: true });
    const { anchors } = captureExcelDownloads();
    await downloadSnapshot(input, "excel", ["custom"]);
    expect(anchors[0].download).toMatch(/^data-kepegawaian-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.xls$/);
    expect(anchors[0].download.length).toBeLessThanOrEqual(120);
  });
});
