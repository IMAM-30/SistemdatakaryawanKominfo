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
    let y = 30;
    const lines = [sheet.headers, ...sheet.rows];
    lines.forEach((row, index) => {
      const text = row.map((value) => String(value)).join("  |  ");
      const wrapped = document.splitTextToSize(text, 268) as string[];
      if (y + wrapped.length * 4 > 195) { document.addPage(); y = 16; }
      document.setFont("helvetica", index === 0 ? "bold" : "normal");
      document.text(wrapped, 14, y);
      y += wrapped.length * 4 + 2;
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
