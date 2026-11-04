// ==========================================
// DỮ LIỆU SUY DIỄN (thống kê, tổng hợp, lọc) - không thay đổi state
// ==========================================
import { MODULES, SUGGESTED_UNITS, PORTAL_OTHER } from './config.js';
import { normalizeStr, sortRecords, searchTerms, matchesTerms, recordSearchText, statusTypeOf } from './utils.js';

export function buildModuleInfo(data) {
  const info = {};
  Object.entries(MODULES).forEach(([k, v]) => { info[k] = { ...v }; });
  (data.quanlyphanmem || []).forEach(pm => {
    if (!pm.col1 || MODULES[pm.col1]) return;
    info[pm.col1] = {
      title: pm.name, icon: pm.col2 || 'globe', tone: pm.col3 || 'blue', category: pm.category || '',
      kind: 'account', group: 'dynamic', isDynamic: true
    };
  });
  return info;
}

export const accountKeysOf = (info) => Object.keys(info).filter(k => info[k].kind === 'account');
export const softwareKeysOf = (info) => accountKeysOf(info);

// Cùng một người: trùng họ tên và đơn vị (cách đồng bộ và liên kết tài khoản dùng chung)
export const isSamePerson = (a, b) => normalizeStr(a.name) === normalizeStr(b.name) && normalizeStr(a.unit) === normalizeStr(b.unit);

// Các phần mềm (kể cả phần mềm tự tạo) mà hồ sơ gốc đã có tài khoản
export const linkedAccountKeys = (data, info, person) => accountKeysOf(info).filter(k => (data[k] || []).some(item => isSamePerson(item, person)));
export const unitsOf = (data) => (data.donvitochuc?.length ? data.donvitochuc.map(u => u.name).filter(Boolean) : SUGGESTED_UNITS);

export function userSummary(data, info) {
  const map = {};
  accountKeysOf(info).forEach(k => (data[k] || []).forEach(item => {
    if (!item.name) return;
    const key = normalizeStr(item.name) + '|' + normalizeStr(item.unit);
    if (!map[key]) map[key] = { id: key, name: item.name, role: item.role || '', unit: item.unit || '', modules: {} };
    if (!map[key].role && item.role) map[key].role = item.role;
    map[key].modules[k] = true;
  }));
  return Object.values(map).map(u => ({ ...u, count: Object.keys(u.modules).length }));
}

export function softwareSummary(data, info) {
  return softwareKeysOf(info).map(k => {
    const rows = data[k] || [];
    const pm = info[k].isDynamic ? (data.quanlyphanmem || []).find(x => x.col1 === k) : null;
    return {
      id: k, key: k, name: info[k].title, icon: info[k].icon, tone: info[k].tone, isDynamic: !!info[k].isDynamic,
      category: info[k].category || '',
      accountCount: rows.length,
      issueCount: rows.filter(r => ['warning', 'danger'].includes(r.statusType || statusTypeOf(r.status))).length,
      notes: pm?.notes || ''
    };
  });
}

// Sức khỏe (%) = tỷ lệ tài khoản ổn định (Bình thường / Đợi cấp); null nếu chưa có trạng thái nào
export function healthOf(b) {
  const counted = b.success + b.info + b.warning + b.danger;
  return counted ? Math.round(((b.success + b.info) / counted) * 100) : null;
}

// Các cụm do người dùng tạo trong module "Cụm Cổng điều phối" (theo thứ tự đã nhập)
export const portalCategoriesOf = (data) => (data.cumdieuphoi || []).map(c => ({
  key: c.col1, title: c.name || 'Chưa đặt tên', desc: c.notes || '', icon: c.col2 || 'layers', tone: c.col3 || 'blue'
}));

export const portalCategoryOf = (data, key) => portalCategoriesOf(data).find(c => c.key === key) || PORTAL_OTHER;

// Các cụm của Cổng điều phối: phần mềm được gom theo cụm + thống kê sức khỏe từng cụm
export function portalClusters(data, info) {
  const software = softwareSummary(data, info);
  const cats = portalCategoriesOf(data);
  const known = cats.map(c => c.key);
  return [...cats, PORTAL_OTHER].map(cat => {
    const items = software.filter(s => (cat === PORTAL_OTHER ? !known.includes(s.category) : s.category === cat.key));
    const rows = items.flatMap(s => data[s.key] || []);
    const breakdown = statusBreakdown(rows);
    return {
      ...cat, items, breakdown,
      accountCount: rows.length,
      issueCount: items.reduce((n, s) => n + s.issueCount, 0),
      health: healthOf(breakdown)
    };
  });
}

export function collectAlerts(data, info) {
  const alerts = [];
  accountKeysOf(info).forEach(k => (data[k] || []).forEach(item => {
    const type = item.statusType || statusTypeOf(item.status);
    if (type === 'danger' || type === 'warning') alerts.push({ moduleKey: k, moduleName: info[k].title, id: item.id, user: item.name, account: item.account, status: item.status, type });
  }));
  return alerts.sort((a, b) => (a.type === b.type ? 0 : a.type === 'danger' ? -1 : 1));
}

export function statusBreakdown(rows) {
  const out = { success: 0, info: 0, warning: 0, danger: 0 };
  rows.forEach(r => { if (r.status) out[r.statusType || statusTypeOf(r.status)]++; });
  return out;
}

const NO_UNIT_FILTER = ['unit', 'code', 'appconfig', 'portalcluster'];
export const hasUnitFilter = (kind) => !NO_UNIT_FILTER.includes(kind);
export const hasStatus = (kind) => !['person', 'appconfig', 'portalcluster'].includes(kind);

// Lọc + sắp xếp danh sách theo ô tìm kiếm, đơn vị, trạng thái
export function filterRows(rows, kind, ui, textOf) {
  let out = rows || [];
  const terms = searchTerms(ui.search || '');
  if (terms.length) out = out.filter(r => matchesTerms(textOf ? textOf(r) : recordSearchText(r, kind), terms));
  if (hasUnitFilter(kind) && ui.unit && ui.unit !== 'All') out = out.filter(r => normalizeStr(r.unit) === normalizeStr(ui.unit));
  if (ui.status && ui.status !== 'all') out = out.filter(r => (r.statusType || statusTypeOf(r.status)) === ui.status);
  return sortRecords(out, kind);
}
