// ==========================================
// ĐỊNH NGHĨA CỘT CHO BẢNG HIỂN THỊ VÀ FILE XUẤT
//  h: tiêu đề cột | v: giá trị chữ (dùng khi xuất file) | html: cách hiển thị trên web
//  exportOnly: chỉ có trong file xuất | primary: cột tiêu đề của thẻ trên điện thoại
// ==========================================
import { esc, fmtDate, statusTypeOf } from './utils.js';
import { icon, isCustomIcon } from './icons.js';
import { portalCategoryOf } from './model.js';

export const statusBadge = (row) => row.status
  ? `<span class="badge badge-${row.statusType || statusTypeOf(row.status)}">${esc(row.status)}</span>`
  : '<span class="muted">—</span>';

const tag = (text, tone = 'blue') => text ? `<span class="tag tone-${tone}">${esc(text)}</span>` : '<span class="muted">—</span>';
const strong = (text, sub) => `<strong class="cell-title">${esc(text) || '—'}</strong>${sub ? `<small class="cell-sub">${esc(sub)}</small>` : ''}`;
const mono = (text, cls = '') => text ? `<span class="mono ${cls}">${esc(text)}</span>` : '<span class="muted">—</span>';
const note = { h: 'Ghi chú', v: r => r.notes, html: r => r.notes ? `<span class="cell-note" title="${esc(r.notes)}">${esc(r.notes)}</span>` : '<span class="muted">—</span>' };
const status = (h = 'Trạng thái') => ({ h, v: r => r.status, html: statusBadge });

export const peripheralList = (r) => {
  const list = [];
  if (r.isLaptop === 'Có') list.push('Laptop');
  if (r.printer && r.printer !== 'Không') list.push(['Có', 'Có (Chưa rõ)'].includes(r.printer) ? 'Máy in' : `Máy in: ${r.printer}`);
  if (r.scanner === 'Có') list.push('Máy scan');
  return list;
};

const levelTone = (lvl = '') => (lvl.includes('2') ? 'red' : lvl.includes('3') ? 'blue' : 'yellow');

// data: dữ liệu đầy đủ (cần để tra tên cụm và đếm phần mềm)
export function columnsFor(kind, data = {}) {
  switch (kind) {
    case 'appconfig': return [
      { h: 'Tên phần mềm', v: r => r.name, html: r => strong(r.name), primary: true },
      { h: 'Mã hệ thống (URL)', v: r => r.col1, html: r => mono(r.col1, 'text-blue') },
      { h: 'Biểu tượng', v: r => (isCustomIcon(r.col2) ? 'Ảnh tải lên' : r.col2), html: r => `<span class="icon-chip tone-${esc(r.col3 || 'blue')}">${icon(r.col2 || 'globe', 16)}</span>` },
      { h: 'Cụm phân loại', v: r => portalCategoryOf(data, r.category).title, html: r => { const c = portalCategoryOf(data, r.category); return `<span class="tag tone-${c.tone}">${esc(c.title)}</span>`; } },
      { ...note, h: 'Mô tả' }
    ];
    case 'portalcluster': {
      const softwareIn = (key) => (data.quanlyphanmem || []).filter(p => p.category === key).length;
      return [
        { h: 'Tên cụm', v: r => r.name, html: r => `<span class="sw-name"><span class="icon-chip tone-${esc(r.col3 || 'blue')}">${icon(r.col2 || 'layers', 16)}</span><strong>${esc(r.name)}</strong></span>`, primary: true },
        { h: 'Mã cụm', v: r => r.col1, html: r => mono(r.col1, 'text-blue') },
        { h: 'Số phần mềm', v: r => String(softwareIn(r.col1)), align: 'center', html: r => `<span class="count-pill">${softwareIn(r.col1)}</span>` },
        { ...note, h: 'Mô tả' }
      ];
    }
    case 'unit': return [
      { h: 'Tên đơn vị', v: r => r.name, html: r => strong(r.name), primary: true },
      { h: 'Người đứng đầu', v: r => r.col3 },
      { h: 'Số điện thoại', v: r => r.phone, html: r => mono(r.phone) },
      { h: 'Email', v: r => r.email },
      { h: 'Địa chỉ', v: r => r.address, exportOnly: true },
      status(),
      note
    ];
    case 'code': return [
      { h: 'Tên cơ quan, trường học', v: r => r.col1, html: r => strong(r.col1), primary: true },
      { h: 'Mã định danh', v: r => r.col2, html: r => mono(r.col2, 'text-blue') },
      { h: 'Cấp hành chính', v: r => r.col3, html: r => tag(r.col3, levelTone(r.col3)) },
      { h: 'Số điện thoại', v: r => r.col6, html: r => mono(r.col6) },
      { h: 'Email đại diện', v: r => r.col4 },
      { h: 'Địa chỉ', v: r => r.col5 },
      status()
    ];
    case 'device': return [
      { h: 'Họ và tên', v: r => r.name, html: r => strong(r.name, r.role), primary: true },
      { h: 'Chức vụ', v: r => r.role, exportOnly: true },
      { h: 'Đơn vị', v: r => r.unit },
      { h: 'Hiệu máy', v: r => r.brand, html: r => `<strong class="text-blue">${esc(r.brand) || '—'}</strong>${r.cpu ? `<small class="cell-sub">${esc(r.cpu)}</small>` : ''}` },
      { h: 'Cấu hình (CPU)', v: r => r.cpu, exportOnly: true },
      { h: 'RAM', v: r => r.ram },
      { h: 'Ổ cứng', v: r => r.storage },
      { h: 'Ngoại vi', v: r => peripheralList(r).join(', '), html: r => { const l = peripheralList(r); return l.length ? l.map(x => `<span class="tag tone-slate">${esc(x)}</span>`).join(' ') : '<span class="muted">—</span>'; } },
      status('Tình trạng'),
      note
    ];
    case 'camera': return [
      { h: 'Vị trí / Tên camera', v: r => r.name, html: r => strong(r.name), primary: true },
      { h: 'Đơn vị quản lý', v: r => r.unit },
      { h: 'Thương hiệu', v: r => r.brand },
      { h: 'Độ phân giải', v: r => r.col1, html: r => tag(r.col1, 'yellow') },
      { h: 'IP / Tên miền', v: r => r.col2, html: r => mono(r.col2, 'text-blue') },
      status(),
      note
    ];
    case 'person': return [
      { h: 'Họ và tên', v: r => r.name, html: r => strong(r.name, r.gender), primary: true },
      { h: 'Giới tính', v: r => r.gender, exportOnly: true },
      { h: 'Ngày sinh', v: r => fmtDate(r.dob) },
      { h: 'Số CCCD', v: r => r.cccd, html: r => mono(r.cccd, 'text-blue') },
      { h: 'Ngày cấp', v: r => fmtDate(r.cccdDate), exportOnly: true },
      { h: 'Địa chỉ', v: r => r.address, exportOnly: true },
      { h: 'Đơn vị', v: r => r.unit },
      { h: 'Chức vụ', v: r => r.role },
      { h: 'Số điện thoại', v: r => r.phone, html: r => mono(r.phone) },
      { h: 'Email', v: r => r.email, exportOnly: true },
      note
    ];
    default: return [
      { h: 'Họ và tên', v: r => r.name, html: r => strong(r.name, r.role), primary: true },
      { h: 'Chức vụ', v: r => r.role, exportOnly: true },
      { h: 'Đơn vị', v: r => r.unit },
      { h: 'Tên tài khoản', v: r => r.account, html: r => mono(r.account, 'text-blue strong') },
      { h: 'Giới tính', v: r => r.gender, exportOnly: true },
      { h: 'Số điện thoại', v: r => r.phone, html: r => mono(r.phone) },
      { h: 'Số CCCD', v: r => r.cccd, exportOnly: true },
      { h: 'Ngày cấp CCCD', v: r => fmtDate(r.cccdDate), exportOnly: true },
      { h: 'Email', v: r => r.email, exportOnly: true },
      status(),
      note
    ];
  }
}
