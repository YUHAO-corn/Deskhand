/**
 * Excel 预览组件
 *
 * 用 SheetJS 解析 .xlsx/.xls 文件，渲染为表格 + 多 sheet tab 切换。
 * MVP：纯数据表格 + 行号列号，不做样式还原。
 */

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';

interface ExcelPreviewProps {
  base64: string;
}

/** Convert 0-based column index to Excel column letter (0→A, 25→Z, 26→AA) */
function colLetter(index: number): string {
  let s = '';
  let n = index;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export function ExcelPreview({ base64 }: ExcelPreviewProps) {
  const [activeSheet, setActiveSheet] = useState(0);

  const workbook = useMemo(() => {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return XLSX.read(bytes, { type: 'array' });
    } catch {
      return null;
    }
  }, [base64]);

  const sheetData = useMemo(() => {
    if (!workbook) return [];
    const name = workbook.SheetNames[activeSheet];
    if (!name) return [];
    const sheet = workbook.Sheets[name];
    return XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      defval: '',
    });
  }, [workbook, activeSheet]);

  // Find max column count across all rows
  const maxCols = useMemo(() => {
    let max = 0;
    for (const row of sheetData) {
      if (Array.isArray(row) && row.length > max) max = row.length;
    }
    return max;
  }, [sheetData]);

  if (!workbook) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-[var(--font-size-sm)]">
        Failed to parse Excel file
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Table area */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse text-[var(--font-size-xs)] w-max min-w-full">
          {/* Column header row: A, B, C... */}
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 bg-[var(--color-surface-panel)] border border-[var(--color-line-soft)] px-2 py-1 text-[var(--color-text-muted)] font-normal w-10 min-w-[40px]" />
              {Array.from({ length: maxCols }, (_, i) => (
                <th
                  key={i}
                  className="bg-[var(--color-surface-panel)] border border-[var(--color-line-soft)] px-2 py-1 text-[var(--color-text-muted)] font-normal min-w-[80px] text-center"
                >
                  {colLetter(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheetData.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {/* Row number */}
                <td className="sticky left-0 z-10 bg-[var(--color-surface-panel)] border border-[var(--color-line-soft)] px-2 py-1 text-[var(--color-text-muted)] text-center font-normal">
                  {rowIdx + 1}
                </td>
                {Array.from({ length: maxCols }, (_, colIdx) => {
                  const cell = Array.isArray(row) ? row[colIdx] : '';
                  return (
                    <td
                      key={colIdx}
                      className="border border-[var(--color-line-soft)] px-2 py-1 text-[var(--color-text-primary)] whitespace-nowrap"
                    >
                      {cell != null ? String(cell) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet tabs */}
      {workbook.SheetNames.length > 1 && (
        <div className="flex items-center gap-0 border-t border-[var(--color-line-soft)] bg-[var(--color-surface-panel)] overflow-x-auto flex-shrink-0">
          {workbook.SheetNames.map((name, idx) => (
            <button
              key={name}
              onClick={() => setActiveSheet(idx)}
              className={`
                px-3 py-1.5 border-none cursor-pointer
                text-[var(--font-size-xs)] whitespace-nowrap
                transition-colors duration-150
                ${idx === activeSheet
                  ? 'bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] font-medium'
                  : 'bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--hover-bg)]'
                }
              `}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
