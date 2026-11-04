// ==========================================
// TRỢ LÝ THÔNG MINH (chạy hoàn toàn trên trình duyệt, không gửi dữ liệu ra ngoài)
// ==========================================
import { normalizeStr, removeAccents, searchTerms, matchesTerms, recordSearchText } from './utils.js';

const PROVINCES = { '001': 'Hà Nội', '031': 'Hải Phòng', '048': 'Đà Nẵng', '079': 'TP. Hồ Chí Minh', '092': 'Cần Thơ' };

// Giải mã số CCCD 12 số: 3 số tỉnh + 1 số giới tính/thế kỷ + 2 số năm sinh + 6 số ngẫu nhiên
export function parseCCCD(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length !== 12) return null;
  const g = Number(digits[3]);
  const birthYear = 1900 + Math.floor(g / 2) * 100 + Number(digits.slice(4, 6));
  if (birthYear > new Date().getFullYear()) return null;
  const code = digits.slice(0, 3);
  return { digits, gender: g % 2 === 0 ? 'Nam' : 'Nữ', birthYear, provinceCode: code, province: PROVINCES[code] || null };
}

const personKey = (p) => normalizeStr(p.name) + '|' + normalizeStr(p.unit);
const SKIP_LOOKUP = ['madinhdanh', 'donvitochuc', 'quanlyphanmem', 'camera', 'tonghopchung'];
const PERSON_FIELDS = ['name', 'phone', 'email', 'cccd', 'cccdDate', 'unit', 'role', 'gender', 'dob', 'address'];

// Gợi ý điền nhanh khi gõ họ tên trong biểu mẫu
export function findPersonMatches(name, data, moduleInfo, activeKey) {
  const q = normalizeStr(name);
  if (q.length < 3) return null;

  const master = (data.tonghopchung || []).find(u => normalizeStr(u.name).includes(q));
  if (activeKey === 'tonghopchung') {
    return master && normalizeStr(master.name) === q
      ? { type: 'duplicate', message: `Đã có hồ sơ gốc trùng tên "${master.name}" (${master.unit || 'chưa rõ đơn vị'}). Kiểm tra lại để tránh tạo trùng.` }
      : null;
  }
  if (master) {
    const suggestion = {};
    PERSON_FIELDS.forEach(f => { if (master[f]) suggestion[f] = master[f]; });
    return { type: 'master', message: `Tìm thấy hồ sơ gốc của "${master.name}" — ${master.role || 'chưa rõ chức vụ'}, ${master.unit || 'chưa rõ đơn vị'}.`, suggestion };
  }

  const found = []; const suggestion = {};
  Object.keys(data).forEach(k => {
    if (SKIP_LOOKUP.includes(k) || !moduleInfo[k]) return;
    const m = (data[k] || []).find(u => normalizeStr(u.name).includes(q));
    if (!m) return;
    found.push(moduleInfo[k].title);
    PERSON_FIELDS.forEach(f => { if (!suggestion[f] && m[f]) suggestion[f] = m[f]; });
  });
  if (found.length) return { type: 'other', message: `"${suggestion.name}" đã có tại: ${found.join(', ')}.`, suggestion };
  return { type: 'new', message: 'Người dùng mới, chưa có trong hệ thống.' };
}

// Mọi hồ sơ gốc khớp từ đang gõ: bỏ dấu, mỗi từ gõ phải là đầu một từ trong họ tên ("nguyen" ra "Nguyễn ...").
// Người có họ tên bắt đầu bằng từ gõ được xếp lên trước
export function findMasterCandidates(query, data) {
  const terms = searchTerms(query);
  if (terms.join('').length < 2) return [];
  const isHit = (p) => {
    const words = removeAccents(p.name).split(/\s+/);
    return terms.every(t => words.some(w => w.startsWith(t)));
  };
  const lead = (p) => (removeAccents(p.name).startsWith(terms[0]) ? 0 : 1);
  return (data.tonghopchung || [])
    .filter(isHit)
    .sort((a, b) => lead(a) - lead(b) || normalizeStr(a.name).localeCompare(normalizeStr(b.name), 'vi'));
}

// Cảnh báo trùng số CCCD với người khác
export function findCccdConflict(cccd, name, data, currentId) {
  const digits = String(cccd || '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  const hit = (data.tonghopchung || []).find(p => p.id !== currentId && String(p.cccd || '').replace(/\D/g, '') === digits);
  if (!hit || normalizeStr(hit.name) === normalizeStr(name)) return null;
  return hit;
}

// Phân tích chất lượng dữ liệu cho bảng "Trợ lý thông minh" ở trang Tổng quan
export function computeInsights(data, moduleInfo, accountKeys) {
  const out = [];
  const people = data.tonghopchung || [];
  const names = (list) => list.slice(0, 4).map(x => x.name || x.col1).join(', ') + (list.length > 4 ? ` và ${list.length - 4} mục khác` : '');

  const byCccd = {};
  people.forEach(p => {
    const d = String(p.cccd || '').replace(/\D/g, '');
    if (d) (byCccd[d] = byCccd[d] || []).push(p);
  });
  const dupCccd = Object.values(byCccd).filter(g => g.length > 1).flat();
  if (dupCccd.length) out.push({ level: 'danger', icon: 'fingerprint', title: `${dupCccd.length} hồ sơ trùng số CCCD`, detail: names(dupCccd), route: '#/m/tonghopchung' });

  const badCccd = people.filter(p => p.cccd && String(p.cccd).replace(/\D/g, '').length !== 12);
  if (badCccd.length) out.push({ level: 'warning', icon: 'badge', title: `${badCccd.length} hồ sơ có CCCD không đủ 12 số`, detail: names(badCccd), route: '#/m/tonghopchung' });

  const weakPw = [];
  accountKeys.forEach(k => (data[k] || []).forEach(a => { if (a.password && String(a.password).length < 6) weakPw.push(a); }));
  if (weakPw.length) out.push({ level: 'warning', icon: 'lock', title: `${weakPw.length} tài khoản dùng mật khẩu quá ngắn (dưới 6 ký tự)`, detail: names(weakPw), route: '#/accounts' });

  const broken = [...(data.thietbi || []), ...(data.thietbimat || [])].filter(d => d.status === 'Hư hỏng' || d.status === 'Đang sửa');
  if (broken.length) out.push({ level: 'danger', icon: 'monitor', title: `${broken.length} thiết bị hư hỏng hoặc đang sửa`, detail: names(broken), route: '#/m/thietbi' });

  const camDown = (data.camera || []).filter(d => d.statusType === 'danger' || d.statusType === 'warning');
  if (camDown.length) out.push({ level: 'warning', icon: 'camera', title: `${camDown.length} camera mất kết nối / hư hỏng`, detail: names(camDown), route: '#/m/camera' });

  const accountOwners = new Set();
  accountKeys.forEach(k => (data[k] || []).forEach(a => accountOwners.add(personKey(a))));
  const noAccount = people.filter(p => !accountOwners.has(personKey(p)));
  if (noAccount.length) out.push({ level: 'info', icon: 'userCheck', title: `${noAccount.length} nhân sự chưa được cấp tài khoản phần mềm nào`, detail: names(noAccount), route: '#/accounts' });

  const noContact = people.filter(p => !p.phone && !p.email);
  if (noContact.length) out.push({ level: 'info', icon: 'phone', title: `${noContact.length} hồ sơ thiếu số điện thoại và email`, detail: names(noContact), route: '#/m/tonghopchung' });

  const emptySoft = accountKeys.filter(k => moduleInfo[k] && (data[k] || []).length === 0);
  if (emptySoft.length) out.push({ level: 'info', icon: 'layers', title: `${emptySoft.length} phần mềm chưa có tài khoản nào`, detail: emptySoft.slice(0, 5).map(k => moduleInfo[k].title).join(', '), route: '#/software' });

  const noHead = (data.donvitochuc || []).filter(u => !u.col3);
  if (noHead.length) out.push({ level: 'info', icon: 'building', title: `${noHead.length} đơn vị chưa có người đứng đầu`, detail: names(noHead), route: '#/m/donvitochuc' });

  const rank = { danger: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

// Tìm kiếm toàn hệ thống (bỏ dấu, nhiều từ khóa, nhận diện CCCD)
export function globalSearch(query, data, moduleInfo) {
  if (!query || query.trim().length < 2) return null;
  const terms = searchTerms(query);
  const modules = Object.entries(moduleInfo).filter(([, i]) => matchesTerms(i.title, terms)).map(([key, i]) => ({ key, ...i }));

  let cccdMatch = null;
  const m = query.match(/\d{9,12}/);
  if (m) cccdMatch = (data.tonghopchung || []).find(u => String(u.cccd || '').includes(m[0])) || null;

  const groups = [];
  Object.keys(data).forEach(k => {
    const info = moduleInfo[k];
    if (!info) return;
    const hits = (data[k] || []).filter(it => matchesTerms(recordSearchText(it, info.kind), terms));
    if (hits.length) groups.push({ key: k, info, hits });
  });
  return { modules, groups, cccdMatch, total: groups.reduce((s, g) => s + g.hits.length, 0) };
}
