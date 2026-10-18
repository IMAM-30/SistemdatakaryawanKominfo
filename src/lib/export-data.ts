import { buildExportSheets, employeeName, type UiCategory, type UiEmployee, type UiField } from "@/lib/ui-model";

export type ExportFormat = "excel" | "pdf" | "both";

export interface ExportSnapshot {
  generatedAt?: string;
  categories: UiCategory[];
  fields: UiField[];
  employees: UiEmployee[];
}

export interface EmployeeExportInput {
  employee: UiEmployee;
  category?: UiCategory;
  /** Already scoped to the current viewer's permissions by the detail view. */
  fields: UiField[];
  photo?: { mimeType: string; base64: string };
}

export async function downloadEmployee(input: EmployeeExportInput, format: ExportFormat): Promise<void> {
  const { employee } = input;
  const fields = input.fields.filter((field) => field.categoryId === employee.categoryId && field.active && !field.deletedAt && field.type !== "photo");
  const category = input.category?.id === employee.categoryId ? input.category : { id: employee.categoryId, code: "Pegawai", name: "Data pegawai", active: true };
  const name = employeeName(employee).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "") || "tanpa-nama";
  const filename = `data-pegawai-${name}-${new Date().toISOString().slice(0, 10)}`;
  if (format === "excel" || format === "both") {
    // A detail export may include an archived person. Only copies are cleared for
    // the shared table builder; the actual archive status is written below.
    const sheets = buildExportSheets([{ ...category, deletedAt: undefined }], fields, [{ ...employee, deletedAt: undefined }]);
    if (employee.deletedAt) sheets[0].rows[0][sheets[0].headers.length - 1] = "Diarsipkan";
    downloadExcelXml(sheets, `${filename}.xls`);
  }
  if (format === "pdf" || format === "both") {
    const { buildEmployeeProfilePdf } = await import("@/lib/employee-profile-pdf");
    const document = await buildEmployeeProfilePdf({ ...input, category, fields });
    document.save(`${filename}.pdf`);
  }
}

export async function downloadSnapshot(snapshot: ExportSnapshot, format: ExportFormat, categoryIds?: string[]): Promise<void> {
  const available = snapshot.categories.filter((category) => !category.deletedAt);
  const selectedIds = categoryIds === undefined ? new Set(available.map((category) => category.id)) : new Set(categoryIds);
  if (categoryIds !== undefined) {
    if (!selectedIds.size) throw new Error("Pilih minimal satu jenis data untuk diunduh.");
    const availableIds = new Set(available.map((category) => category.id));
    if ([...selectedIds].some((id) => !availableIds.has(id))) {
      throw new Error("Jenis data yang dipilih sudah tidak tersedia. Muat ulang data lalu pilih kembali.");
    }
  }
  const categories = available.filter((category) => selectedIds.has(category.id));
  const sheets = buildExportSheets(
    categories,
    snapshot.fields.filter((field) => selectedIds.has(field.categoryId)),
    snapshot.employees.filter((employee) => selectedIds.has(employee.categoryId)),
  );
  if (!sheets.length) throw new Error("Belum ada kategori yang dapat diekspor.");
  const stamp = new Date().toISOString().slice(0, 10);
  const scope = categories.length === available.length ? "" : `-${categories.map(categoryFilenameLabel).join("-").slice(0, 80).replace(/-+$/, "")}`;
  const filename = `data-kepegawaian${scope}-${stamp}`;
  if (format === "excel" || format === "both") downloadExcelXml(sheets, `${filename}.xls`);
  if (format === "pdf" || format === "both") await downloadPdf(sheets, `${filename}.pdf`);
}

function categoryFilenameLabel(category: UiCategory): string {
  const label = category.code === "NON_PNS" ? "Non-ASN" : category.code || category.name;
  return label.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32).replace(/-+$/, "") || "kategori";
}

function downloadExcelXml(sheets: ReturnType<typeof buildExportSheets>, filename: string) {
  const worksheets = sheets.map((sheet) => `<Worksheet ss:Name="${xml(sheetName(sheet.name))}"><Table>${[
    sheet.headers,
    ...sheet.rows,
  ].map((row, rowIndex) => `<Row>${row.map((value) => {
    const type = typeof value === "number" ? "Number" : typeof value === "boolean" ? "Boolean" : "String";
    return `<Cell${rowIndex === 0 ? ' ss:StyleID="Header"' : ""}><Data ss:Type="${type}">${xml(String(value))}</Data></Cell>`;
  }).join("")}</Row>`).join("")}</Table></Worksheet>`).join("");
  const content = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#DCEEF2" ss:Pattern="Solid"/></Style></Styles>${worksheets}</Workbook>`;
  downloadBlob(new Blob([content], { type: "application/vnd.ms-excel;charset=utf-8" }), filename);
}

async function downloadPdf(sheets: ReturnType<typeof buildExportSheets>, filename: string) {
  const { jsPDF } = await import("jspdf");
  const document = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const tableX = 14;
  const tableWidth = 268;
  const bottom = 195;
  const lineHeight = 4;
  document.setDrawColor(70);
  document.setLineWidth(0.2);
  document.setLineHeightFactor(lineHeight * document.internal.scaleFactor / 8);
  let firstPage = true;
  sheets.forEach((sheet) => {
    if (!firstPage) document.addPage();
    firstPage = false;
    document.setFont("helvetica", "bold");
    document.setFontSize(15);
    document.text(`Data Kepegawaian - ${sheet.name}`, 14, 16);
    document.setFontSize(8);
    document.setFont("helvetica", "normal");
    document.text(`Diekspor ${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(new Date())}`, 14, 22);
    const padding = Math.min(1, tableWidth / sheet.headers.length / 4);
    const preferredWidths = sheet.headers.map((header, column) => {
      document.setFont("helvetica", "bold");
      let width = document.getTextWidth(header);
      document.setFont("helvetica", "normal");
      sheet.rows.forEach((row) => { width = Math.max(width, document.getTextWidth(String(row[column]))); });
      return Math.min(40, Math.max(10, width + padding * 2));
    });
    const totalWidth = preferredWidths.reduce((sum, width) => sum + width, 0);
    const minimumWidth = Math.min(10, tableWidth / sheet.headers.length);
    const remainingWidth = tableWidth - minimumWidth * sheet.headers.length;
    const widths = preferredWidths.map((width) => minimumWidth + width * remainingWidth / totalWidth);
    const wrapRow = (row: Array<string | number | boolean>, bold: boolean) => {
      document.setFont("helvetica", bold ? "bold" : "normal");
      return widths.map((width, column) => document.splitTextToSize(String(row[column] ?? ""), width - padding * 2) as string[]);
    };
    const rowLines = (cells: string[][]) => Math.max(1, ...cells.map((cell) => cell.length));
    const headers = wrapRow(sheet.headers, true);
    // Reserve room for data even when custom headers wrap across many lines.
    const cellLineHeight = Math.min(lineHeight, (bottom - 30 - padding * 4 - lineHeight) / rowLines(headers));
    document.setFontSize(8 * cellLineHeight / lineHeight);
    let y = 30;
    let hasRowsOnPage = false;
    const drawRow = (cells: string[][], bold: boolean, offset = 0, count = rowLines(cells)) => {
      const height = count * cellLineHeight + padding * 2;
      document.setFont("helvetica", bold ? "bold" : "normal");
      let x = tableX;
      cells.forEach((cell, column) => {
        document.rect(x, y, widths[column], height);
        const lines = cell.slice(offset, offset + count);
        if (lines.length) document.text(lines, x + padding, y + padding, { baseline: "top" });
        x += widths[column];
      });
      y += height;
    };
    const nextPage = () => {
      document.addPage();
      y = 16;
      drawRow(headers, true);
      hasRowsOnPage = false;
    };
    drawRow(headers, true);
    sheet.rows.forEach((row) => {
      const cells = wrapRow(row, false);
      const count = rowLines(cells);
      if (y + count * cellLineHeight + padding * 2 > bottom && hasRowsOnPage) nextPage();
      // Long cells continue inside a complete grid on each following page.
      let offset = 0;
      while (offset < count) {
        const available = Math.floor((bottom - y - padding * 2) / cellLineHeight);
        if (available < 1) { nextPage(); continue; }
        const length = Math.min(available, count - offset);
        drawRow(cells, false, offset, length);
        offset += length;
        hasRowsOnPage = true;
        if (offset < count) nextPage();
      }
    });
  });
  document.save(filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function sheetName(value: string) {
  return value.replace(/[\\/?*\[\]:]/g, "-").slice(0, 31) || "Data";
}
