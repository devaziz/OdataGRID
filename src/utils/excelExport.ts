import * as XLSX from 'xlsx';

// CSV/Excel formula injection: Excel evaluates a cell as a formula when the
// string starts with =, +, -, @, \t or \r. Prefix such values with a single
// quote so they render as literal text instead of executing.
const sanitizeCellValue = (v: any): any => {
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) {
    return "'" + v;
  }
  return v;
};

const sanitizeRow = (row: any): any => {
  if (row === null || typeof row !== 'object') return sanitizeCellValue(row);
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) {
    const val = row[k];
    out[k] = (val !== null && typeof val === 'object') ? val : sanitizeCellValue(val);
  }
  return out;
};

export const exportToExcel = (data: any[], fileName: string) => {
  const safeData = Array.isArray(data) ? data.map(sanitizeRow) : [];
  const worksheet = XLSX.utils.json_to_sheet(safeData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
