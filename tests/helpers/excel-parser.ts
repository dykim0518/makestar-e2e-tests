/**
 * Excel 파일 파싱 유틸 (xlsx/SheetJS + adm-zip)
 *
 * - 단일 .xlsx 파싱
 * - .zip 안에 여러 xlsx가 있는 경우 자동 해제 후 모두 파싱
 */

import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import AdmZip from "adm-zip";

export type ParsedSheet = {
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
};

export type ParsedFile = {
  filePath: string;
  fileName: string;
  sheets: ParsedSheet[];
};

export type ParsedResult = {
  /** ZIP이면 여러 개, xlsx이면 1개 */
  files: ParsedFile[];
  isZip: boolean;
};

export function parseExcelOrZip(filePath: string): ParsedResult {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".zip") {
    return { files: parseZip(filePath), isZip: true };
  }
  return { files: [parseXlsx(filePath)], isZip: false };
}

function parseXlsx(filePath: string, fileName?: string): ParsedFile {
  const wb = XLSX.readFile(filePath);
  return {
    filePath,
    fileName: fileName ?? path.basename(filePath),
    sheets: wb.SheetNames.map((name) => sheetFromWb(wb, name)),
  };
}

function sheetFromWb(wb: XLSX.WorkBook, name: string): ParsedSheet {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: false,
  });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return {
    sheetName: name,
    headers,
    rowCount: rows.length,
    rows: rows.map((r) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) out[k] = String(v ?? "");
      return out;
    }),
  };
}

function parseZip(zipPath: string): ParsedFile[] {
  const extractDir = path.join(
    path.dirname(zipPath),
    `__extracted_${path.basename(zipPath, ".zip")}`,
  );
  fs.mkdirSync(extractDir, { recursive: true });

  const zip = new AdmZip(zipPath);
  const entries = zip
    .getEntries()
    .filter((e) => !e.isDirectory && /\.xlsx$/i.test(e.entryName));
  const out: ParsedFile[] = [];
  for (const e of entries) {
    // ZIP 내부의 한글 파일명이 CP949일 수 있음 → 그대로 추출하되 파일명은 고유화
    const safe = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.xlsx`;
    const destPath = path.join(extractDir, safe);
    fs.writeFileSync(destPath, e.getData());
    out.push(parseXlsx(destPath, e.entryName));
  }
  return out;
}
