import * as XLSX from 'xlsx';

// Reads the first column of the first sheet of a .csv/.xlsx/.xls file and
// returns its non-empty values as trimmed strings, deduped. A header row
// (e.g. "Plot Number") just won't match any real plot label later, so it
// doesn't need special detection here.
export async function parsePlotNumbersFromFile(file) {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

  const seen = new Set();
  const numbers = [];
  for (const row of rows) {
    const value = String(row[0] ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    numbers.push(value);
  }
  return numbers;
}
