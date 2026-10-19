import type { EmployeeExportInput } from "@/lib/export-data";
import { employeeName, type UiField } from "@/lib/ui-model";
import { dateForDisplay } from "@/lib/date-format";

const GROUPS = [
  { label: "Data Pribadi", keys: ["photo", "nip", "name", "nama", "fullName", "birthPlace", "birthDate", "gender", "religion", "addressCity"] },
  { label: "Kepangkatan", keys: ["cpnsRank", "cpnsRankTmt", "latestRank", "latestRankTmt", "serviceYears", "serviceMonths"] },
  { label: "Jabatan", keys: ["position", "echelon", "echelonTmt"] },
  { label: "KGB & Pendidikan", keys: ["kgb", "nextKgb", "lastEducation", "educationMajor"] },
];

function displayValue(value: unknown, field: UiField): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (field.type === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return dateForDisplay(value);
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** A portrait reading layout, kept separate from the multi-employee table PDF. */
export async function buildEmployeeProfilePdf({ employee, category, fields, photo }: EmployeeExportInput) {
  const { jsPDF } = await import("jspdf");
  const document = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const left = 16;
  const right = 194;
  const width = right - left;
  const bottom = 273;
  const gap = 12;
  const columnWidth = (width - gap) / 2;
  const name = employeeName(employee);
  const categoryLabel = category?.code === "NON_PNS" ? "Non-ASN" : category?.code || "Pegawai";
  const status = employee.deletedAt ? "Diarsipkan" : employee.active ? "Aktif" : "Tidak aktif";
  const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  let y = 14;
  document.setProperties({ title: `Profil pegawai - ${name}`, subject: "Data lengkap pegawai", author: "Kominfo Parepare" });

  function font(size: number, bold = false, color: [number, number, number] = [28, 45, 56], lineHeight = 4.8) {
    document.setFont("helvetica", bold ? "bold" : "normal");
    document.setFontSize(size);
    document.setTextColor(...color);
    document.setLineHeightFactor(lineHeight * document.internal.scaleFactor / size);
  }

  function wrap(value: string, availableWidth: number, size: number, bold = false, lineHeight = 4.8): string[] {
    font(size, bold, undefined, lineHeight);
    return document.splitTextToSize(value.replace(/\r\n?/g, "\n"), availableWidth) as string[];
  }

  function nextPage() {
    document.addPage();
    font(9, true, [26, 91, 106]);
    document.text("PROFIL PEGAWAI / LANJUTAN", left, 14, { baseline: "top" });
    document.setDrawColor(209, 222, 226);
    document.setLineWidth(0.25);
    document.line(left, 23, right, 23);
    y = 31;
  }

  function reserve(height: number) {
    if (y + height > bottom) nextPage();
  }

  function flow(lines: string[], size: number, lineHeight: number, bold = false, color: [number, number, number] = [28, 45, 56], x = left) {
    for (const line of lines) {
      reserve(lineHeight);
      font(size, bold, color, lineHeight);
      if (line) document.text(line, x, y, { baseline: "top" });
      y += lineHeight;
    }
  }

  font(8, true, [26, 91, 106]);
  document.text("KOMINFO PAREPARE / DATA KEPEGAWAIAN", left, y, { baseline: "top" });
  y = 24;
  font(23, true);
  document.text("Profil pegawai", left, y, { baseline: "top" });
  y = 39;
  let hasPhoto = false;
  if (photo && /^image\/(?:png|jpeg|webp)$/.test(photo.mimeType)) {
    // Photos are optional: an unavailable or damaged image must never prevent a
    // user from obtaining the employee's text data.
    try {
      const source = `data:${photo.mimeType};base64,${photo.base64}`;
      const image = document.getImageProperties(source);
      const scale = Math.min(27 / image.width, 34 / image.height);
      document.addImage(source, image.fileType, right - 27 + (27 - image.width * scale) / 2, 24, image.width * scale, image.height * scale);
      hasPhoto = true;
    } catch { /* Continue with the full text profile. */ }
  }
  flow(wrap(name, hasPhoto ? width - 39 : width, 15, true, 6.5), 15, 6.5, true);
  y += 2;
  flow(wrap(`${categoryLabel}${category?.name && category.name !== categoryLabel ? ` · ${category.name}` : ""}`, hasPhoto ? width - 39 : width, 9.5), 9.5, 4.8, false, [75, 94, 103]);
  y += 2;
  flow(wrap(`Status: ${status}`, width, 9.5, true), 9.5, 4.8, true, [26, 91, 106]);
  if (hasPhoto && document.getNumberOfPages() === 1) y = Math.max(y, 60);
  y += 4;
  reserve(14);
  document.setDrawColor(125, 170, 180);
  document.setLineWidth(0.45);
  document.line(left, y, right, y);
  y += 9;

  const available = fields.filter((field) => field.categoryId === employee.categoryId && field.active && !field.deletedAt && field.type !== "photo").sort((a, b) => a.sortOrder - b.sortOrder);
  const assigned = new Set(GROUPS.flatMap((group) => group.keys));
  const groups = GROUPS.map((group) => ({ label: group.label, fields: available.filter((field) => group.keys.includes(field.key)) })).filter((group) => group.fields.length);
  const extra = available.filter((field) => !assigned.has(field.key));
  if (extra.length) groups.push({ label: "Data Tambahan", fields: extra });

  function sectionHeading(label: string, continued = false) {
    reserve(22);
    font(10.5, true, [26, 91, 106]);
    document.text(`${label}${continued ? " (lanjutan)" : ""}`, left, y, { baseline: "top" });
    y += 9;
  }

  function measure(field: UiField, availableWidth: number) {
    const labels = wrap(field.label, availableWidth, 8.5, false, 3.8);
    const values = wrap(displayValue(employee.data[field.key], field), availableWidth, 10.5);
    return { labels, values, height: labels.length * 3.8 + 2 + values.length * 4.8 + 7 };
  }

  for (const group of groups) {
    const first = group.fields[0];
    const firstHalf = measure(first, columnWidth);
    const firstFull = first.type === "textarea" || firstHalf.labels.length > 3 || firstHalf.values.length > 4;
    const second = group.fields[1];
    const secondHalf = second ? measure(second, columnWidth) : undefined;
    const secondFits = second && second.type !== "textarea" && secondHalf!.labels.length <= 3 && secondHalf!.values.length <= 4;
    const firstHeight = firstFull ? measure(first, width).height : Math.max(firstHalf.height, secondFits ? secondHalf!.height : 0);
    // Keep a section heading with its first complete row/paragraph whenever it
    // fits on a fresh page, so headings never become stranded at the bottom.
    reserve(9 + (firstHeight <= bottom - 40 ? firstHeight : 20));
    sectionHeading(group.label);
    let index = 0;
    while (index < group.fields.length) {
      const field = group.fields[index];
      const measured = measure(field, columnWidth);
      const fullWidth = field.type === "textarea" || measured.labels.length > 3 || measured.values.length > 4;
      if (fullWidth) {
        const { labels, values, height } = measure(field, width);
        if (height <= bottom - 40 && y + height > bottom) {
          nextPage();
          sectionHeading(group.label, true);
        }
        // Long labels and values flow as paragraphs, retaining every line. The
        // continuation heading supplies context without duplicating field data.
        const render = (lines: string[], size: number, lineHeight: number, color: [number, number, number]) => {
          for (const line of lines) {
            if (y + lineHeight > bottom) { nextPage(); sectionHeading(group.label, true); }
            font(size, false, color, lineHeight);
            if (line) document.text(line, left, y, { baseline: "top" });
            y += lineHeight;
          }
        };
        render(labels, 8.5, 3.8, [82, 100, 108]);
        y += 2;
        render(values, 10.5, 4.8, [28, 45, 56]);
        y += 7;
        index += 1;
      } else {
        const next = group.fields[index + 1];
        const nextMeasured = next ? measure(next, columnWidth) : undefined;
        const paired = next && next.type !== "textarea" && nextMeasured!.labels.length <= 3 && nextMeasured!.values.length <= 4;
        const row = paired ? [measured, nextMeasured!] : [measured];
        const height = Math.max(...row.map((item) => item.height));
        if (y + height > bottom) { nextPage(); sectionHeading(group.label, true); }
        row.forEach((item, column) => {
          const x = left + column * (columnWidth + gap);
          font(8.5, false, [82, 100, 108], 3.8);
          document.text(item.labels, x, y, { baseline: "top" });
          font(10.5, false);
          document.text(item.values, x, y + item.labels.length * 3.8 + 2, { baseline: "top" });
        });
        y += height;
        index += paired ? 2 : 1;
      }
    }
    y += 4;
  }
  if (!groups.length) flow(["Belum ada rincian tambahan yang tersedia."], 10.5, 4.8);

  const pages = document.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    document.setPage(page);
    document.setDrawColor(220, 229, 232);
    document.setLineWidth(0.2);
    document.line(left, 280, right, 280);
    font(8, false, [88, 104, 112], 3.8);
    document.text(`Diekspor ${date}`, left, 284, { baseline: "top" });
    document.text(`${page} / ${pages}`, right - 25, 284, { baseline: "top" });
  }
  return document;
}
