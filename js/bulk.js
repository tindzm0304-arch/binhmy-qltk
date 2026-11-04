// ==========================================
// NHẬP / XUẤT HÀNG LOẠT QUA FILE EXCEL (.xlsx)
// - Thông tin chung: File mẫu có sẵn các hồ sơ hiện tại (kèm Mã hồ sơ). Dòng có Mã hồ sơ hoặc Số CCCD khớp thì cập nhật, còn lại thêm mới
// - Đơn vị tổ chức: File mẫu có sẵn các đơn vị hiện tại (kèm Mã đơn vị). Dòng có Mã đơn vị hoặc Tên đơn vị khớp thì cập nhật, còn lại thêm mới
// ==========================================
import { loadScript, removeAccents, normalizeStr, sortRecords, statusTypeOf } from './utils.js';
import { STATUS_OPTIONS } from './config.js';

const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DATA_SHEET = 'Danh sách';
const GUIDE_SHEET = 'Hướng dẫn';
const TEXT_ROWS = 500; // số dòng được định dạng sẵn là văn bản cho các cột số (CCCD, điện thoại)
export const MAX_IMPORT_ROWS = 2000;

// key: trường trong bản ghi | h: tiêu đề cột trong file | date / text: kiểu ô | w: độ rộng cột
export const PERSON_IMPORT_COLUMNS = [
  { key: 'id', h: 'Mã hồ sơ', text: true, w: 12, hint: 'Để trống nếu thêm mới. Giữ nguyên khi cập nhật.' },
  { key: 'name', h: 'Họ và tên *', req: true, w: 26, hint: 'Bắt buộc' },
  { key: 'gender', h: 'Giới tính', w: 10, hint: 'Nam hoặc Nữ' },
  { key: 'dob', h: 'Ngày sinh', date: true, w: 13, hint: 'dd/mm/yyyy, ví dụ 12/05/1985' },
  { key: 'cccd', h: 'Số CCCD', text: true, w: 16, hint: '12 chữ số (giữ số 0 ở đầu). Trùng số CCCD của hồ sơ đã có thì cập nhật hồ sơ đó.' },
  { key: 'cccdDate', h: 'Ngày cấp CCCD', date: true, w: 15, hint: 'dd/mm/yyyy' },
  { key: 'address', h: 'Địa chỉ', w: 40, hint: 'Địa chỉ thường trú / tạm trú' },
  { key: 'unit', h: 'Đơn vị *', reqNew: true, w: 30, hint: 'Bắt buộc khi thêm mới. Nên ghi đúng tên đơn vị ở sheet này (mục cuối).' },
  { key: 'role', h: 'Chức vụ *', reqNew: true, w: 20, hint: 'Bắt buộc khi thêm mới' },
  { key: 'phone', h: 'Số điện thoại', text: true, w: 15, hint: 'Số điện thoại, bắt đầu bằng 0' },
  { key: 'email', h: 'Email', w: 28, hint: 'Email cá nhân' },
  { key: 'notes', h: 'Ghi chú', w: 30, hint: 'Ghi chú thêm' }
];

export const UNIT_IMPORT_COLUMNS = [
  { key: 'id', h: 'Mã đơn vị', text: true, w: 14, hint: 'Để trống nếu thêm mới. Giữ nguyên khi cập nhật.' },
  { key: 'name', h: 'Tên đơn vị *', req: true, w: 34, hint: 'Bắt buộc khi thêm mới. Trùng tên đơn vị đã có thì cập nhật đơn vị đó.' },
  { key: 'col3', h: 'Người đứng đầu', w: 24, hint: 'Họ và tên trưởng đơn vị' },
  { key: 'phone', h: 'Số điện thoại', text: true, w: 15, hint: 'Số điện thoại cơ quan, bắt đầu bằng 0' },
  { key: 'email', h: 'Email', w: 28, hint: 'Email của đơn vị' },
  { key: 'address', h: 'Địa chỉ / Vị trí', w: 36, hint: 'Ví dụ: Tầng 2, UBND Xã' },
  { key: 'status', h: 'Trạng thái', w: 26, hint: 'Đang hoạt động hoặc Ngừng hoạt động / Giải thể. Thêm mới mà để trống thì là Đang hoạt động' },
  { key: 'notes', h: 'Ghi chú', w: 36, hint: 'Chức năng, nhiệm vụ...' }
];

const cellText = (v) => (v === null || v === undefined ? '' : String(v));
const pad = (n) => String(n).padStart(2, '0');

// Tiêu đề không phân biệt dấu, hoa thường, dấu * và khoảng trắng thừa
function headerKey(s) {
  return removeAccents(cellText(s)).replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

// Tên đơn vị / hồ sơ để so khớp: không phân biệt hoa thường và khoảng trắng thừa
const nameKey = (s) => normalizeStr(cellText(s)).replace(/\s+/g, ' ');

const columnsByHeader = (columns) => new Map(columns.map(c => [headerKey(c.h), c]));

export const loadXlsx = () => loadScript(XLSX_URL).then(() => window.XLSX);

// ---------- File mẫu ----------
// ISO (yyyy-mm-dd) -> dd/mm/yyyy để người dùng nhập theo cách quen thuộc
const toDmy = (v) => {
  const s = cellText(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

// Trạng thái lưu theo giá trị (Bình thường) nhưng file hiển thị theo nhãn (Đang hoạt động)
const statusLabel = (v) => STATUS_OPTIONS.unit.find(([value]) => value === v)?.[1] || cellText(v);

// Phần đầu sheet Hướng dẫn: các bước và bảng mô tả từng cột
const guideRows = (title, steps, columns) => [
  [title],
  [],
  ...steps.map(s => [s]),
  [],
  ['Cột', 'Bắt buộc', 'Ghi chú'],
  ...columns.map(c => [c.h.replace(/\s*\*$/, ''), c.req ? 'Có' : c.reqNew ? 'Khi thêm mới' : 'Không', c.hint])
];

// Ghi các dòng dữ liệu và sheet hướng dẫn thành file .xlsx
function writeTemplate(XLSX, { columns, body, guide }) {
  const head = columns.map(c => c.h);
  const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
  const lastRow = Math.max(body.length, TEXT_ROWS);
  // Cột số CCCD, điện thoại, mã: định dạng văn bản để Excel không bỏ mất số 0 ở đầu
  columns.forEach((c, ci) => {
    if (!c.text) return;
    for (let r = 1; r <= lastRow; r++) {
      const addr = XLSX.utils.encode_cell({ c: ci, r });
      ws[addr] = ws[addr] || { t: 's', v: '' };
      ws[addr].z = '@';
    }
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: head.length - 1, r: lastRow } });
  ws['!cols'] = columns.map(c => ({ wch: c.w }));

  const gs = XLSX.utils.aoa_to_sheet(guide);
  gs['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 90 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, DATA_SHEET);
  XLSX.utils.book_append_sheet(wb, gs, GUIDE_SHEET);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: XLSX_MIME });
}

export async function buildPersonTemplate(people, units) {
  const XLSX = await loadXlsx();
  const body = sortRecords(people, 'person').map(p => PERSON_IMPORT_COLUMNS.map(c => (c.date ? toDmy(p[c.key]) : cellText(p[c.key]))));
  const guide = [
    ...guideRows('HƯỚNG DẪN NHẬP HÀNG LOẠT - THÔNG TIN CHUNG', [
      `1. Sheet "${DATA_SHEET}": mỗi dòng là một người. Giữ nguyên dòng tiêu đề, không xóa hoặc đổi tên cột.`,
      '2. Thêm người mới: để trống cột "Mã hồ sơ", điền các cột còn lại (bắt buộc: Họ và tên, Đơn vị, Chức vụ).',
      '3. Cập nhật người đã có: giữ nguyên "Mã hồ sơ" và sửa các ô cần đổi. Ô để trống sẽ giữ nguyên giá trị cũ.',
      '4. Dòng không có mã hồ sơ nhưng Số CCCD trùng hồ sơ đã có sẽ được hiểu là cập nhật hồ sơ đó.',
      '5. Ngày viết theo dạng dd/mm/yyyy (ví dụ 12/05/1985). Giới tính: Nam hoặc Nữ.',
      '6. Lưu file rồi bấm "Nhập Excel" trên hệ thống. Hệ thống sẽ hiện bản xem trước; dòng lỗi được bỏ qua, các dòng đúng vẫn được nhập.'
    ], PERSON_IMPORT_COLUMNS),
    [],
    ['Đơn vị đang có trong hệ thống:'],
    ...units.map(u => [u])
  ];
  return writeTemplate(XLSX, { columns: PERSON_IMPORT_COLUMNS, body, guide });
}

export async function buildUnitTemplate(units) {
  const XLSX = await loadXlsx();
  const body = sortRecords(units, 'unit').map(u => UNIT_IMPORT_COLUMNS.map(c => (c.key === 'status' ? statusLabel(u.status) : cellText(u[c.key]))));
  const guide = guideRows('HƯỚNG DẪN NHẬP HÀNG LOẠT - ĐƠN VỊ TỔ CHỨC', [
    `1. Sheet "${DATA_SHEET}": mỗi dòng là một đơn vị. Giữ nguyên dòng tiêu đề, không xóa hoặc đổi tên cột.`,
    '2. Thêm đơn vị mới: để trống cột "Mã đơn vị", điền tên đơn vị (bắt buộc).',
    '3. Cập nhật đơn vị đã có: giữ nguyên "Mã đơn vị" và sửa các ô cần đổi. Ô để trống sẽ giữ nguyên giá trị cũ.',
    '4. Dòng không có mã đơn vị nhưng Tên đơn vị trùng đơn vị đã có sẽ được hiểu là cập nhật đơn vị đó.',
    '5. Trạng thái: Đang hoạt động hoặc Ngừng hoạt động / Giải thể. Thêm mới mà để trống thì là Đang hoạt động.',
    '6. Lưu file rồi bấm "Nhập Excel" trên hệ thống. Hệ thống sẽ hiện bản xem trước; dòng lỗi được bỏ qua, các dòng đúng vẫn được nhập.'
  ], UNIT_IMPORT_COLUMNS);
  return writeTemplate(XLSX, { columns: UNIT_IMPORT_COLUMNS, body, guide });
}

// ---------- Đọc và kiểm tra file nhập ----------
const ymd = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
};

// Trả về { value } hoặc { error }. Excel có thể đưa ngày dưới dạng số serial hoặc chuỗi dd/mm/yyyy
function parseDate(v) {
  if (v === '' || v === null || v === undefined) return { value: '' };
  if (typeof v === 'number') {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
    return { value: ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()) || '' };
  }
  const s = String(v).trim();
  if (!s) return { value: '' };
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) {
    const iso = ymd(+m[3], +m[2], +m[1]);
    return iso ? { value: iso } : { error: `Ngày "${s}" không tồn tại` };
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    const iso = ymd(+m[1], +m[2], +m[3]);
    return iso ? { value: iso } : { error: `Ngày "${s}" không tồn tại` };
  }
  return { error: `Ngày "${s}" phải có dạng dd/mm/yyyy` };
}

function parseCccd(v) {
  const s = cellText(v).replace(/[\s.-]/g, '');
  if (!s) return { value: '' };
  if (!/^\d+$/.test(s)) return { error: 'Số CCCD chỉ gồm chữ số' };
  // Excel có thể làm mất số 0 ở đầu khi lưu thành số: bù lại cho đủ 12 chữ số
  const full = s.length === 11 ? s.padStart(12, '0') : s;
  return /^(\d{9}|\d{12})$/.test(full) ? { value: full } : { error: 'Số CCCD phải có 12 chữ số' };
}

function parseGender(v) {
  const s = removeAccents(cellText(v)).trim();
  if (!s) return { value: '' };
  if (s === 'nam') return { value: 'Nam' };
  if (s === 'nu') return { value: 'Nữ' };
  return { error: 'Giới tính phải là Nam hoặc Nữ' };
}

// Nhận cả nhãn (Đang hoạt động) lẫn giá trị lưu trong hệ thống (Bình thường)
function parseUnitStatus(v) {
  const s = removeAccents(cellText(v)).replace(/\s+/g, ' ').trim();
  if (!s) return { value: '' };
  const hit = STATUS_OPTIONS.unit.find(([value, label]) => [value, label].some(x => removeAccents(x) === s));
  return hit ? { value: hit[0] } : { error: 'Trạng thái phải là Đang hoạt động hoặc Ngừng hoạt động / Giải thể' };
}

// Số điện thoại bị Excel đổi thành số thì thiếu số 0 đầu
const parsePhone = (v) => {
  const s = cellText(v).replace(/[\s.-]/g, '');
  return /^\d{9}$/.test(s) ? '0' + s : s;
};

// Dòng tiêu đề của file -> cột tương ứng (null nếu không nhận ra)
const mapHeaders = (headerRow, columns) => {
  const byHeader = columnsByHeader(columns);
  return headerRow.map(h => byHeader.get(headerKey(h)) || null);
};

// Kiểm tra từng dòng và phân loại: thêm mới / cập nhật / lỗi
export function planPersonImport(rows, headerAt, data, units) {
  const map = mapHeaders(rows[headerAt], PERSON_IMPORT_COLUMNS);
  const people = data.tonghopchung || [];
  const byId = new Map(people.map(p => [String(p.id), p]));
  const byCccd = new Map();
  people.forEach(p => {
    const d = cellText(p.cccd).replace(/\D/g, '');
    if (d) byCccd.set(d, p);
  });
  const seenTarget = new Map(); // hồ sơ đã có -> dòng đầu tiên cập nhật nó
  const seenCccd = new Map(); // số CCCD -> dòng đầu tiên khai báo
  const plan = { rows: [], errors: [] };
  const canonUnit = (u) => units.find(x => normalizeStr(x) === normalizeStr(u)) || u;

  rows.forEach((cells, k) => {
    if (k <= headerAt) return;
    if (cells.every(c => cellText(c).trim() === '')) return;
    const line = k + 1; // số dòng trong Excel
    const raw = {};
    map.forEach((col, ci) => { if (col) raw[col.key] = cells[ci]; });

    const errors = [];
    const str = (key) => cellText(raw[key]).replace(/\s+/g, ' ').trim();
    const take = (result) => {
      if (result.error) { errors.push(result.error); return ''; }
      return result.value;
    };

    const name = str('name');
    if (!name) errors.push('Thiếu họ và tên');
    const fields = {
      name,
      gender: take(parseGender(raw.gender)),
      dob: take(parseDate(raw.dob)),
      cccd: take(parseCccd(raw.cccd)),
      cccdDate: take(parseDate(raw.cccdDate)),
      address: str('address'),
      unit: str('unit') ? canonUnit(str('unit')) : '',
      role: str('role'),
      phone: parsePhone(raw.phone),
      email: str('email'),
      notes: str('notes')
    };

    // Ưu tiên khớp theo Mã hồ sơ, không có thì khớp theo Số CCCD
    const idKey = str('id');
    let target = idKey ? byId.get(idKey) : undefined;
    const note = idKey && !target ? 'Mã hồ sơ không có trong hệ thống, sẽ thêm mới' : '';
    const byNumber = fields.cccd ? byCccd.get(fields.cccd) : undefined;
    if (target && byNumber && byNumber !== target) errors.push(`Số CCCD đang thuộc hồ sơ khác (${byNumber.name})`);
    target = target || byNumber;

    if (!target) {
      if (!fields.unit) errors.push('Thiếu đơn vị (bắt buộc khi thêm mới)');
      if (!fields.role) errors.push('Thiếu chức vụ (bắt buộc khi thêm mới)');
    }
    if (fields.cccd) {
      if (seenCccd.has(fields.cccd)) errors.push(`Số CCCD trùng với dòng ${seenCccd.get(fields.cccd)}`);
      else seenCccd.set(fields.cccd, line);
    }
    if (target) {
      const key = String(target.id);
      if (seenTarget.has(key)) errors.push(`Cùng một hồ sơ với dòng ${seenTarget.get(key)}`);
      else seenTarget.set(key, line);
    }

    if (errors.length) {
      plan.errors.push({ line, name: name || '(không có tên)', message: errors.join('; ') });
      return;
    }
    if (target) {
      // Ô để trống giữ nguyên giá trị cũ, nên chỉ lấy các ô có dữ liệu
      const changes = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== ''));
      plan.rows.push({ line, action: 'update', targetId: target.id, name: target.name, record: changes, note });
    } else {
      plan.rows.push({ line, action: 'add', name, record: fields, note });
    }
  });
  return plan;
}

// Kiểm tra từng dòng đơn vị: thêm mới / cập nhật / lỗi
export function planUnitImport(rows, headerAt, data) {
  const map = mapHeaders(rows[headerAt], UNIT_IMPORT_COLUMNS);
  const units = data.donvitochuc || [];
  const byId = new Map(units.map(u => [String(u.id), u]));
  const byName = new Map(units.map(u => [nameKey(u.name), u]));
  const claimed = new Map(); // đơn vị đã có / tên đơn vị mới -> dòng đầu tiên khai báo
  const plan = { rows: [], errors: [] };

  rows.forEach((cells, k) => {
    if (k <= headerAt) return;
    if (cells.every(c => cellText(c).trim() === '')) return;
    const line = k + 1; // số dòng trong Excel
    const raw = {};
    map.forEach((col, ci) => { if (col) raw[col.key] = cells[ci]; });

    const errors = [];
    const str = (key) => cellText(raw[key]).replace(/\s+/g, ' ').trim();
    const take = (result) => {
      if (result.error) { errors.push(result.error); return ''; }
      return result.value;
    };

    const name = str('name');
    const fields = {
      name,
      col3: str('col3'),
      phone: parsePhone(raw.phone),
      email: str('email'),
      address: str('address'),
      status: take(parseUnitStatus(raw.status)),
      notes: str('notes')
    };

    // Ưu tiên khớp theo Mã đơn vị, không có thì khớp theo Tên đơn vị
    const idKey = str('id');
    let target = idKey ? byId.get(idKey) : undefined;
    const note = idKey && !target ? 'Mã đơn vị không có trong hệ thống, sẽ thêm mới' : '';
    const byNameMatch = name ? byName.get(nameKey(name)) : undefined;
    if (target && byNameMatch && byNameMatch !== target) errors.push(`Tên đã thuộc đơn vị khác (${byNameMatch.name})`);
    target = target || byNameMatch;
    // Trùng tên (không phân biệt hoa thường) thì giữ nguyên cách viết của đơn vị đã có
    if (target && fields.name && nameKey(fields.name) === nameKey(target.name)) fields.name = target.name;

    if (!target) {
      if (!name) errors.push('Thiếu tên đơn vị (bắt buộc khi thêm mới)');
      fields.status = fields.status || 'Bình thường';
    }
    fields.statusType = fields.status ? statusTypeOf(fields.status) : '';

    if (target || name) {
      const claimKey = target ? `id:${target.id}` : `name:${nameKey(name)}`;
      if (claimed.has(claimKey)) errors.push(`Cùng một đơn vị với dòng ${claimed.get(claimKey)}`);
      else claimed.set(claimKey, line);
    }

    if (errors.length) {
      plan.errors.push({ line, name: name || '(không có tên)', message: errors.join('; ') });
      return;
    }
    if (target) {
      const changes = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== ''));
      plan.rows.push({ line, action: 'update', targetId: target.id, name: target.name, record: changes, note });
    } else {
      plan.rows.push({ line, action: 'add', name, record: fields, note });
    }
  });
  return plan;
}

// Đọc file người dùng chọn. Tìm sheet có dòng tiêu đề (không cần đúng sheet đầu tiên)
async function readTable(file, { columns, marker, minColumns, sample, plan }) {
  const XLSX = await loadXlsx();
  let wb;
  try {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  } catch {
    throw new Error('Không đọc được file. Hãy dùng file Excel (.xlsx) lấy từ "File mẫu".');
  }
  const byHeader = columnsByHeader(columns);
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', blankrows: true, raw: true });
    const headerAt = rows.findIndex(r => r.some(c => headerKey(c) === headerKey(marker))
      && r.filter(c => byHeader.has(headerKey(c))).length >= minColumns);
    if (headerAt < 0) continue;
    if (rows.length - headerAt - 1 > MAX_IMPORT_ROWS) {
      throw new Error(`File có quá nhiều dòng (tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần nhập).`);
    }
    return plan(rows, headerAt);
  }
  throw new Error(`Không tìm thấy các cột của mẫu (${sample}). Hãy dùng file lấy từ "File mẫu".`);
}

export const readPersonImport = (file, data) => {
  const units = (data.donvitochuc || []).map(u => u.name).filter(Boolean);
  return readTable(file, {
    columns: PERSON_IMPORT_COLUMNS, marker: 'Họ và tên', minColumns: 4, sample: 'Họ và tên, Số CCCD...',
    plan: (rows, headerAt) => planPersonImport(rows, headerAt, data, units)
  });
};

export const readUnitImport = (file, data) => readTable(file, {
  columns: UNIT_IMPORT_COLUMNS, marker: 'Tên đơn vị', minColumns: 2, sample: 'Tên đơn vị, Người đứng đầu...',
  plan: (rows, headerAt) => planUnitImport(rows, headerAt, data)
});
