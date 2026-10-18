import { buildExportSheets, type UiCategory, type UiEmployee, type UiField } from "@/lib/ui-model";

export type ExportFormat = "excel" | "pdf" | "both";

export interface ExportSnapshot {
  generatedAt?: string;
  categories: UiCategory[];
  fields: UiField[];
  employees: UiEmployee[];
}

export async function downloadSnapshot(snapshot: ExportSnapshot, format: ExportFormat): Promise<void> {
  const sheets = buildExportSheets(snapshot.categories, snapshot.fields, snapshot.employees);
  if (!sheets.length) throw new Error("Belum ada kategori yang dapat diekspor.");
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "excel" || format === "both") downloadExcelXml(sheets, `data-kepegawaian-${stamp}.xls`);
  if (format === "pdf" || format === "both") await downloadPdf(sheets, `data-kepegawaian-${stamp}.pdf`);
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
