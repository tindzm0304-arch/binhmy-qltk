// ==========================================
// XUẤT FILE EXCEL / WORD (định dạng HTML mà Office mở được)
// ==========================================
import { esc, downloadBlob, todayStamp } from './utils.js';

export function exportTable({ title, columns, rows, format, fileBase }) {
  const cell = 'border:1px solid #000;padding:6px;';
  const head = `<tr><th style="${cell}background:#dbeafe;font-weight:bold;">STT</th>${columns.map(c => `<th style="${cell}background:#dbeafe;font-weight:bold;">${esc(c.h)}</th>`).join('')}</tr>`;
  const body = rows.map((r, i) => `<tr><td style="${cell}text-align:center;">${i + 1}</td>${columns.map(c => {
    const val = c.v(r);
    const mark = val === 'X';
    return `<td style="${cell}text-align:${c.align || 'left'};${mark ? 'font-weight:bold;color:#1d4ed8;' : ''}">${esc(val ?? '')}</td>`;
  }).join('')}</tr>`).join('');

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8" />
<style>table{border-collapse:collapse;width:100%;font-family:'Times New Roman',serif;font-size:11pt;}td{mso-number-format:"\\@";}h2{text-align:center;font-family:'Times New Roman',serif;font-size:16pt;font-weight:bold;margin-bottom:20px;text-transform:uppercase;}</style>
</head><body><h2>${esc(title)}</h2><table><thead>${head}</thead><tbody>${body}</tbody></table></body></html>`;

  const isExcel = format === 'excel';
  const blob = new Blob(['﻿' + html], { type: isExcel ? 'application/vnd.ms-excel' : 'application/msword' });
  downloadBlob(blob, `${fileBase}_${todayStamp()}.${isExcel ? 'xls' : 'doc'}`);
}
