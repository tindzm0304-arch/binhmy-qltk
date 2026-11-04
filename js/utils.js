// ==========================================
// HÀM TIỆN ÍCH DÙNG CHUNG
// ==========================================
import { SUGGESTED_UNITS, STATUS_TYPE } from './config.js';

export const normalizeStr = (str) => (str ? String(str).normalize('NFC').trim().toLowerCase() : '');

export const removeAccents = (str) => {
  if (!str) return '';
  return String(str).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/đ/g, 'd');
};

// Chống chèn mã HTML khi hiển thị dữ liệu người dùng nhập
export const esc = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

export const uid = () => Date.now() + Math.floor(Math.random() * 1000);

export const fmtDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  return isNaN(d) ? String(val) : d.toLocaleDateString('vi-VN');
};

export const statusTypeOf = (status) => STATUS_TYPE[status] || 'info';

export const debounce = (fn, ms = 160) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

export const searchTerms = (query) => removeAccents(query).split(/\s+/).filter(Boolean);

export const matchesTerms = (text, terms) => {
  const hay = removeAccents(text);
  return terms.every(t => hay.includes(t));
};

// Chuỗi tìm kiếm của một bản ghi, theo loại module
export const recordSearchText = (item, kind) => {
  const v = (...keys) => keys.map(k => item[k] || '').join(' ');
  switch (kind) {
    case 'appconfig': return v('name', 'col1', 'notes');
    case 'portalcluster': return v('name', 'col1', 'notes');
    case 'unit': return v('name', 'col3', 'phone', 'email', 'notes');
    case 'code': return v('col1', 'col2', 'col3', 'col4', 'col5', 'col6');
    case 'device': return v('name', 'unit', 'brand', 'cpu', 'role', 'notes');
    case 'camera': return v('name', 'unit', 'brand', 'col1', 'col2', 'notes');
    case 'person': return v('name', 'cccd', 'unit', 'role', 'phone', 'email', 'address');
    default: return v('name', 'account', 'unit', 'role', 'phone', 'email', 'cccd', 'notes');
  }
};

// ---------- Sắp xếp thông minh theo Đơn vị và Chức vụ ----------
const unitOrderMap = SUGGESTED_UNITS.reduce((acc, unit, idx) => { acc[normalizeStr(unit)] = idx; return acc; }, {});

export const getRolePriority = (roleStr) => {
  const r = normalizeStr(roleStr);
  if (!r) return 99;
  if (r.includes('bí thư')) {
    if (r.includes('phó') && r.includes('thường trực')) return 2;
    if (r.includes('phó')) return 3;
    return 1;
  }
  if (r.includes('chủ tịch')) return r.includes('phó') ? 5 : 4;
  if (r.includes('trưởng') || r.includes('chỉ huy')) return r.includes('phó') ? 7 : 6;
  if (r.includes('ủy viên')) return 8;
  if (r.includes('công chức') || r.includes('chuyên viên') || r.includes('cán bộ')) return 9;
  if (r.includes('nhân viên') || r.includes('kct')) return 10;
  return 50;
};

const getAdminLevelPriority = (levelStr) => {
  const s = normalizeStr(levelStr);
  if (s.includes('2')) return 1;
  if (s.includes('3')) return 2;
  if (s.includes('4')) return 3;
  return 99;
};

const cmp = (a, b) => normalizeStr(a).localeCompare(normalizeStr(b), 'vi');

export const sortRecords = (list, kind) => {
  if (!list || list.length === 0) return [];
  return [...list].sort((a, b) => {
    if (kind === 'portalcluster') return 0; // giữ thứ tự hiển thị trên Cổng điều phối
    if (kind === 'appconfig') return cmp(a.name, b.name);
    if (kind === 'unit') return cmp(a.name, b.name);
    if (kind === 'code') {
      const pa = getAdminLevelPriority(a.col3); const pb = getAdminLevelPriority(b.col3);
      return pa !== pb ? pa - pb : cmp(a.col1, b.col1);
    }
    const oa = unitOrderMap[normalizeStr(a.unit)] ?? 999;
    const ob = unitOrderMap[normalizeStr(b.unit)] ?? 999;
    if (oa !== ob) return oa - ob;
    const ra = getRolePriority(a.role); const rb = getRolePriority(b.role);
    if (ra !== rb) return ra - rb;
    return cmp(a.name, b.name);
  });
};

// ---------- Tải thư viện ngoài khi cần (xem trước Word/Excel, Markdown) ----------
const loadedScripts = {};
export const loadScript = (src) => {
  if (!loadedScripts[src]) {
    loadedScripts[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = () => { delete loadedScripts[src]; reject(new Error('Không tải được thư viện: ' + src)); };
      document.head.appendChild(s);
    });
  }
  return loadedScripts[src];
};

export const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

export const todayStamp = () => {
  const d = new Date();
  return [d.getDate(), d.getMonth() + 1].map(n => String(n).padStart(2, '0')).join('') + d.getFullYear();
};

export const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
};

// ---------- Biểu tượng tải lên từ máy ----------
// Thu nhỏ ảnh vừa khung vuông (giữ tỉ lệ, nền trong suốt) để bản ghi lưu gọn trong trình duyệt
export const fileToIconDataUrl = (file, size = 128) => new Promise((resolve, reject) => {
  if (!file || !file.type.startsWith('image/')) return reject(new Error('Vui lòng chọn một tệp hình ảnh.'));
  if (file.size > 5 * 1024 * 1024) return reject(new Error('Ảnh quá lớn (tối đa 5 MB).'));
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const w = img.naturalWidth; const h = img.naturalHeight;
    if (!w || !h) return reject(new Error('Không đọc được ảnh này.'));
    const scale = Math.min(1, size / w, size / h);
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    canvas.getContext('2d').drawImage(img, (size - w * scale) / 2, (size - h * scale) / 2, w * scale, h * scale);
    resolve(canvas.toDataURL('image/png'));
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh này.')); };
  img.src = url;
});
