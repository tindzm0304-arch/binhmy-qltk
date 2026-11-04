// ==========================================
// ỨNG DỤNG CHÍNH: định tuyến, sự kiện, hộp thoại, lưu dữ liệu
// ==========================================
import { APP_NAME, STORAGE_KEY, PORTAL_OTHER } from './config.js';
import { esc, uid, debounce, downloadBlob, formatSize, normalizeStr, searchTerms, matchesTerms, fileToIconDataUrl, todayStamp } from './utils.js';
import { icon } from './icons.js';
import { loadState, saveState, normalizeState, putFile, getFile, deleteFile } from './db.js';
import { buildModuleInfo, accountKeysOf, unitsOf, userSummary, softwareSummary, filterRows, portalCategoriesOf, isSamePerson, linkedAccountKeys } from './model.js';
import { columnsFor } from './columns.js';
import { renderForm, readForm, slugKey } from './forms.js';
import { findPersonMatches, findCccdConflict, parseCCCD, globalSearch } from './insights.js';
import { wirePersonPicker, pickerLabels } from './picker.js';
import { exportTable } from './export.js';
import { buildPersonTemplate, buildUnitTemplate, readPersonImport, readUnitImport } from './bulk.js';
import { buildPreview } from './files.js';
import {
  renderNav, renderDashboard, renderModuleView, renderModuleTable,
  renderUserSummary, renderUserSummaryTable, userSummaryColumns,
  renderSoftwareSummary, renderSoftwareTable, softwareColumns, renderDetail,
  renderPortal, renderPortalGrid
} from './views.js';

const $ = (sel, root = document) => root.querySelector(sel);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX_FILE = 25 * 1024 * 1024;

const store = { state: null };
const SIDEBAR_KEY = 'binhmy-qltk:sidebar';
const ui = { route: { id: '' }, search: '', unit: 'All', status: 'all', cluster: 'All', page: 1, perPage: 10 };
let info = {};
let pendingSearch = null;

const ctx = () => ({
  data: store.state.data, info, ui,
  notes: store.state.notes, links: store.state.links, docs: store.state.docs,
  units: unitsOf(store.state.data)
});

function commit() {
  info = buildModuleInfo(store.state.data);
  if (!saveState(store.state)) toast('Không lưu được dữ liệu: bộ nhớ trình duyệt đã đầy hoặc bị chặn.', 'danger');
}

// ==========================================
// KHUNG GIAO DIỆN
// ==========================================
function renderShell() {
  document.getElementById('app').innerHTML = `
  <a class="skip-link" href="#main">Bỏ qua tới nội dung chính</a>
  <div class="app-frame">
    <header class="topbar">
      <button class="icon-btn only-mobile" data-action="open-menu" aria-label="Mở menu">${icon('menu', 22)}</button>
      <div class="brand">
        <span class="brand-mark">${icon('shieldCheck', 20)}</span>
        <div class="brand-text"><strong>BÌNH MỸ</strong><span>Cổng điều phối số</span></div>
      </div>
      <div class="gsearch" id="gsearch-wrap">
        <label class="gsearch-field">${icon('search', 18)}<span class="sr-only">Tìm kiếm toàn hệ thống</span>
          <input id="gsearch" type="search" placeholder="Tìm phần mềm, cán bộ, CCCD..." autocomplete="off" aria-controls="gsearch-pop" aria-expanded="false">
          <kbd class="hide-sm">/</kbd></label>
        <div class="gsearch-pop" id="gsearch-pop" role="listbox" hidden></div>
      </div>
      <div class="topbar-right">
        <div class="clock hide-md" id="clock" aria-hidden="true"></div>
      </div>
    </header>
    <div class="shell">
      <aside class="sidebar" id="sidebar" aria-label="Menu chính">
        <button class="icon-btn only-mobile on-dark sidebar-close" data-action="close-menu" aria-label="Đóng menu">${icon('x', 20)}</button>
        <button class="sidebar-toggle" id="sidebar-toggle" data-action="toggle-sidebar" aria-expanded="true" aria-controls="sidebar" aria-label="Thu gọn menu" title="Thu gọn menu">${icon('chevronLeft', 16)}</button>
        <nav class="nav" id="nav"></nav>
      </aside>
      <div class="scrim" data-action="close-menu"></div>
      <div class="main-col">
        <main id="main" class="content" tabindex="-1"><div id="view" class="view-host"></div></main>
      </div>
    </div>
  </div>
  <button class="fab" id="fab" data-action="add" aria-label="Thêm mới" hidden>${icon('plus', 26)}</button>
  <div id="modal-root"></div>
  <div id="toast-root" class="toasts" aria-live="polite" aria-atomic="false"></div>`;
}

// Thu gọn / mở rộng cột menu trên máy tính (nhớ lựa chọn cho lần mở sau)
function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  const btn = $('#sidebar-toggle');
  if (btn) {
    const label = collapsed ? 'Mở rộng menu' : 'Thu gọn menu';
    btn.setAttribute('aria-expanded', String(!collapsed));
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }
  try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch { /* bỏ qua */ }
}

function renderChrome() {
  $('#nav').innerHTML = renderNav(ctx(), ui.route.id);
  $('#fab').hidden = !ui.route.key || info[ui.route.key]?.kind === 'account';
}

// ==========================================
// ĐỊNH TUYẾN & HIỆU ỨNG CHUYỂN TRANG
// ==========================================
function parseRoute() {
  const [a, b] = location.hash.replace(/^#\/?/, '').split('/');
  const key = b ? decodeURIComponent(b) : '';
  if (a === 'm' && info[key]) return { id: `m:${key}`, key };
  if (a === 'accounts') return { id: 'accounts' };
  if (a === 'software') return { id: 'software' };
  if (a === 'tongquan') return { id: 'dashboard' };
  return { id: 'portal' };
}

function withTransition(fn) {
  if (reducedMotion() || document.hidden) return fn();
  if (document.startViewTransition) {
    let ran = false;
    const update = () => { if (!ran) { ran = true; fn(); } };
    const t = document.startViewTransition(update);
    // Trình duyệt có thể hủy hoặc trì hoãn hiệu ứng (cửa sổ thu nhỏ, chuyển trang liên tiếp) — nội dung vẫn phải cập nhật ngay
    t.ready.catch(() => {});
    t.finished.catch(() => {});
    setTimeout(() => { if (!ran) { t.skipTransition(); update(); } }, 250);
    return t;
  }
  fn();
  const v = $('#view');
  v.classList.remove('is-entering'); void v.offsetWidth; v.classList.add('is-entering');
}

function onRoute() {
  const next = parseRoute();
  const first = !ui.route.id;
  const changed = next.id !== ui.route.id;
  ui.route = next;
  if (changed) Object.assign(ui, { search: '', unit: 'All', status: 'all', cluster: 'All', page: 1 });
  if (pendingSearch !== null) { ui.search = pendingSearch; ui.page = 1; pendingSearch = null; }
  closeMenu();
  const run = () => { renderView(); if (changed) $('#main').scrollTo({ top: 0 }); };
  changed && !first ? withTransition(run) : run();
}

function renderView() {
  const c = ctx();
  const v = $('#view');
  const r = ui.route;
  renderChrome();
  if (r.id === 'dashboard') v.innerHTML = renderDashboard(c);
  else if (r.id === 'portal') v.innerHTML = renderPortal(c);
  else if (r.id === 'accounts') v.innerHTML = renderUserSummary(c);
  else if (r.id === 'software') v.innerHTML = renderSoftwareSummary(c);
  else v.innerHTML = renderModuleView(c, r.key);
  renderTable();
  animateCounts(v);
  const title = r.key ? info[r.key].title : r.id === 'portal' ? 'Cổng điều phối' : r.id === 'accounts' ? 'Tổng hợp tài khoản' : r.id === 'software' ? 'Tổng hợp phần mềm' : 'Tổng quan';
  document.title = `${title} · ${APP_NAME}`;
}

function currentRows() {
  const { data } = store.state;
  const r = ui.route;
  if (r.id === 'accounts') return filterRows(userSummary(data, info), 'account', { ...ui, status: 'all' }, x => `${x.name} ${x.unit} ${x.role}`);
  if (r.id === 'software') {
    const terms = searchTerms(ui.search);
    return softwareSummary(data, info)
      .filter(x => !terms.length || matchesTerms(x.name, terms))
      .sort((a, b) => b.accountCount - a.accountCount || a.name.localeCompare(b.name, 'vi'));
  }
  if (r.key) return filterRows(data[r.key], info[r.key].kind, ui);
  return [];
}

function renderTable() {
  const region = $('#table-region');
  if (!region) return;
  if (ui.route.id === 'portal') { region.innerHTML = renderPortalGrid(ctx()); return; }
  const rows = currentRows();
  const pages = Math.max(1, Math.ceil(rows.length / ui.perPage));
  if (ui.page > pages) ui.page = pages;
  const c = ctx();
  const r = ui.route;
  region.innerHTML = r.id === 'accounts' ? renderUserSummaryTable(c, rows)
    : r.id === 'software' ? renderSoftwareTable(c, rows)
      : renderModuleTable(c, r.key, rows);
}

function animateCounts(root) {
  if (reducedMotion()) return;
  root.querySelectorAll('[data-count]').forEach(el => {
    const target = Number(el.dataset.count) || 0;
    const suffix = el.dataset.suffix || '';
    if (!target) return;
    const t0 = performance.now();
    const dur = 900;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString('vi-VN') + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// ==========================================
// HỘP THOẠI (MODAL), XÁC NHẬN, THÔNG BÁO
// ==========================================
const modalStack = [];
let modalSeq = 0;

function openModal({ title, sub = '', ic = 'info', tone = 'blue', body = '', foot = '', size = 'md' }) {
  const id = `modal-title-${++modalSeq}`;
  const layer = document.createElement('div');
  layer.className = 'modal-layer';
  layer.innerHTML = `<div class="modal-backdrop" data-action="close-modal"></div>
    <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-labelledby="${id}" tabindex="-1">
      <header class="modal-head" data-tone="${tone}">
        <span class="modal-ic">${icon(ic, 20)}</span>
        <div class="modal-titles"><h2 id="${id}">${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
        <button class="icon-btn" data-action="close-modal" aria-label="Đóng">${icon('x', 20)}</button>
      </header>
      <div class="modal-body">${body}</div>
      ${foot ? `<footer class="modal-foot">${foot}</footer>` : ''}
    </div>`;
  $('#modal-root').appendChild(layer);
  modalStack.push({ layer, lastFocus: document.activeElement });
  document.body.classList.add('modal-open');
  void layer.offsetWidth; // ép trình duyệt tính trạng thái ban đầu để hiệu ứng mở chạy mượt
  layer.classList.add('is-open');
  // Máy tính: đặt con trỏ vào ô nhập đầu tiên. Điện thoại: không bật bàn phím ngay, chỉ đưa focus vào hộp thoại
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const firstField = layer.querySelector('[autofocus]') || layer.querySelector('.modal-body input:not([type=hidden]):not([readonly]):not(.sr-only), .modal-body select, .modal-body textarea');
  const target = (finePointer && firstField) || layer.querySelector('.modal-foot .btn-primary') || layer.querySelector('.modal');
  target.focus({ preventScroll: true });
  return layer;
}

function closeModal() {
  const m = modalStack.pop();
  if (!m) return;
  m.layer.classList.remove('is-open');
  m.layer.classList.add('is-closing');
  setTimeout(() => { m.layer.remove(); m.onClose?.(); }, reducedMotion() ? 0 : 200);
  if (!modalStack.length) document.body.classList.remove('modal-open');
  if (m.lastFocus && document.contains(m.lastFocus)) m.lastFocus.focus({ preventScroll: true });
}

function confirmDialog(message, { okText = 'Đồng ý', danger = true, title = 'Xác nhận' } = {}) {
  return new Promise(resolve => {
    const layer = openModal({
      title, ic: danger ? 'alert' : 'info', tone: danger ? 'red' : 'blue', size: 'sm',
      body: `<p class="confirm-text">${esc(message)}</p>`,
      foot: `<button class="btn btn-ghost" data-confirm="no">Hủy</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm="yes">${esc(okText)}</button>`
    });
    const entry = modalStack[modalStack.length - 1];
    let answered = false;
    entry.onClose = () => { if (!answered) resolve(false); };
    layer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-confirm]');
      if (!b) return;
      answered = true;
      resolve(b.dataset.confirm === 'yes');
      closeModal();
    });
    setTimeout(() => layer.querySelector('[data-confirm="yes"]')?.focus(), 30);
  });
}

function toast(message, type = 'success', { action, onAction, duration = 4200 } = {}) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  const ic = { success: 'checkCircle', danger: 'alert', warning: 'alert', info: 'info' }[type] || 'info';
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'danger' ? 'alert' : 'status');
  el.innerHTML = `${icon(ic, 20)}<span class="toast-msg">${esc(message)}</span>${action ? `<button class="toast-action">${esc(action)}</button>` : ''}<button class="toast-x" aria-label="Đóng thông báo">${icon('x', 16)}</button>`;
  root.appendChild(el);
  void el.offsetWidth;
  el.classList.add('is-in');
  const remove = () => { el.classList.remove('is-in'); el.classList.add('is-out'); setTimeout(() => el.remove(), 260); };
  const timer = setTimeout(remove, duration);
  el.querySelector('.toast-x').onclick = () => { clearTimeout(timer); remove(); };
  if (action) el.querySelector('.toast-action').onclick = () => { clearTimeout(timer); remove(); onAction?.(); };
}

// ==========================================
// THÊM / SỬA / XÓA BẢN GHI
// ==========================================
const ADD_TITLE = { appconfig: 'Thêm phần mềm mới', unit: 'Thêm đơn vị tổ chức', device: 'Thêm thiết bị mới', camera: 'Thêm camera mới', person: 'Thêm nhân sự (hồ sơ gốc)', code: 'Thêm mã định danh', account: 'Thêm tài khoản mới', portalcluster: 'Thêm cụm Cổng điều phối' };
const PERSON_SYNC_SKIP = ['madinhdanh', 'donvitochuc', 'quanlyphanmem', 'cumdieuphoi', 'camera', 'tonghopchung'];
const findRow = (key, id) => (store.state.data[key] || []).find(x => String(x.id) === String(id));

// Hồ sơ gốc đổi họ tên / đơn vị: đồng bộ thông tin sang các tài khoản phần mềm của cùng người. Trả về số bản ghi đã đồng bộ
function syncPersonAccounts(data, original, updated) {
  const oName = normalizeStr(original.name); const oUnit = normalizeStr(original.unit);
  let synced = 0;
  Object.keys(data).forEach(k => {
    if (PERSON_SYNC_SKIP.includes(k) || !Array.isArray(data[k])) return;
    data[k] = data[k].map(item => {
      const linked = item.personId !== undefined && String(item.personId) === String(original.id);
      if (!linked && (normalizeStr(item.name) !== oName || normalizeStr(item.unit) !== oUnit)) return item;
      synced++;
      return { ...item, name: updated.name, unit: updated.unit, role: updated.role, phone: updated.phone, email: updated.email, cccd: updated.cccd, cccdDate: updated.cccdDate, gender: updated.gender };
    });
  });
  return synced;
}

function openForm(mode, record = null) {
  const key = ui.route.key;
  if (!key) return;
  const mi = info[key];
  const kind = mi.kind;
  const suggestTargets = ['person', 'account'].includes(kind)
    ? accountKeysOf(info).filter(k => k !== key).map(k => ({ key: k, title: info[k].title })) : [];

  // Đường dẫn của phần mềm lưu riêng trong links, nên lấy ra để điền sẵn khi sửa
  const formRecord = kind === 'appconfig' && record ? { ...record, link: store.state.links[record.col1] || '' } : (record || {});
  // Sửa hồ sơ gốc: liệt kê mọi phần mềm và đánh dấu những phần mềm người này đang có tài khoản
  const linked = mode === 'edit' && kind === 'person' ? linkedAccountKeys(store.state.data, info, record) : [];
  const software = mode === 'edit' && kind === 'person'
    ? accountKeysOf(info).map(k => ({ key: k, title: info[k].title, checked: linked.includes(k) })) : [];
  const layer = openModal({
    title: mode === 'add' ? (ADD_TITLE[kind] || 'Thêm mới') : 'Cập nhật thông tin',
    sub: mi.title, ic: mode === 'add' ? 'plus' : 'edit', tone: mode === 'add' ? 'blue' : 'yellow', size: 'lg',
    body: `<form id="data-form" class="form">${renderForm({ kind, moduleKey: key, record: formRecord, mode, units: unitsOf(store.state.data), unitRecords: store.state.data.donvitochuc || [], suggestTargets, software, clusters: portalCategoriesOf(store.state.data) })}</form>`,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Hủy bỏ</button>
      <button type="submit" form="data-form" class="btn btn-primary">${icon('save', 18)} ${mode === 'add' ? 'Lưu thông tin' : 'Cập nhật thay đổi'}</button>`
  });
  const form = layer.querySelector('form');
  // Những người đã chọn từ hồ sơ gốc (chọn nhiều): lưu cùng biểu mẫu để tạo mỗi người một bản ghi
  const picked = [];
  wireSmartForm(form, key, kind, mode, record, picked);
  form.addEventListener('submit', (e) => { e.preventDefault(); saveRecord(mode, key, record, form, picked); });
}

function wireSmartForm(form, key, kind, mode, record, picked) {
  const box = form.querySelector('[data-smart-box]');
  let suggestion = null;

  // Thiết bị và tài khoản: danh sách hồ sơ gốc khớp khi gõ thay cho khung gợi ý đơn lẻ
  const pickMode = mode === 'add' && !!form.querySelector('[data-pick-name]');
  if (pickMode) wirePersonPicker(form, picked, { getData: () => store.state.data, ...pickerLabels(kind, key) });

  const nameInput = form.querySelector('[data-smart-name]');
  if (nameInput && mode === 'add') {
    nameInput.addEventListener('input', debounce(() => {
      const found = findPersonMatches(nameInput.value, store.state.data, info, key);
      // Hồ sơ gốc đã hiện trong danh sách chọn nên không lặp lại ở khung này
      const res = pickMode && found?.type === 'master' ? null : found;
      suggestion = res?.suggestion || null;
      if (!res) { box.hidden = true; return; }
      const tone = res.type === 'new' ? 'slate' : res.type === 'duplicate' ? 'red' : 'blue';
      box.hidden = false;
      box.dataset.tone = tone;
      box.innerHTML = `${icon(res.type === 'duplicate' ? 'alert' : 'bot', 20)}<div><p>${esc(res.message)}</p>
        ${suggestion ? `<button type="button" class="btn btn-sm btn-primary" data-action="apply-suggestion">${icon('sparkles', 14)} ${res.type === 'master' ? 'Điền tự động từ hồ sơ gốc' : 'Tự động điền thông tin'}</button>` : ''}</div>`;
    }, 220));
  }

  form.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'apply-suggestion' && suggestion) {
      e.stopPropagation();
      const override = ['name', 'role', 'unit', 'gender'];
      Object.entries(suggestion).forEach(([k, v]) => {
        const el = form.elements[k];
        if (el && v && (override.includes(k) || !el.value)) el.value = v;
      });
      form.querySelector('[data-smart-cccd]')?.dispatchEvent(new Event('input'));
      box.hidden = true;
      toast('Đã tự động điền thông tin từ hệ thống.');
    }
    if (btn.dataset.action === 'cccd-fill') {
      e.stopPropagation();
      const p = parseCCCD(form.elements.cccd.value);
      if (p && form.elements.gender) form.elements.gender.value = p.gender;
      toast(`Đã áp dụng giới tính ${p?.gender || ''} theo số CCCD.`);
    }
  });

  const cccdInput = form.querySelector('[data-smart-cccd]');
  const hint = form.querySelector('[data-cccd-hint]');
  if (cccdInput && hint) {
    const update = () => {
      const raw = cccdInput.value.replace(/\D/g, '');
      if (cccdInput.value !== raw) cccdInput.value = raw;
      if (!raw) { hint.innerHTML = ''; hint.className = 'field-hint'; return; }
      const p = parseCCCD(raw);
      const msgs = [];
      let level = 'ok';
      if (raw.length !== 12) { msgs.push(`Cần đủ 12 số (đang có ${raw.length}).`); level = 'warn'; }
      else if (!p) { msgs.push('Số CCCD không hợp lệ.'); level = 'warn'; }
      else {
        msgs.push(`${p.gender} · sinh năm ${p.birthYear}${p.province ? ' · ' + p.province : ''}`);
        const dob = form.elements.dob?.value;
        if (dob && Number(dob.slice(0, 4)) !== p.birthYear) { msgs.push(`Năm sinh đã nhập (${dob.slice(0, 4)}) không khớp CCCD.`); level = 'warn'; }
        const g = form.elements.gender?.value;
        if (g && g !== p.gender) msgs.push(`<button type="button" class="link-btn" data-action="cccd-fill">Áp dụng giới tính ${p.gender}</button>`);
      }
      const conflict = findCccdConflict(raw, form.elements.name?.value, store.state.data, record?.id);
      if (conflict) { msgs.push(`Số này đang thuộc hồ sơ của ${esc(conflict.name)}.`); level = 'danger'; }
      hint.className = `field-hint hint-${level}`;
      hint.innerHTML = `${icon(level === 'ok' ? 'checkCircle' : 'alert', 14)} ${msgs.map(m => (m.startsWith('<button') ? m : esc(m))).join(' ')}`;
    };
    cccdInput.addEventListener('input', update);
    form.elements.dob?.addEventListener('change', update);
    form.elements.gender?.addEventListener('change', update);
    update();
  }

  const keyField = form.querySelector('[data-key-field]');
  const autoKey = form.querySelector('[data-auto-key]');
  if (keyField && mode === 'add') {
    keyField.addEventListener('input', () => { keyField.dataset.touched = '1'; keyField.value = slugKey(keyField.value); });
    autoKey?.addEventListener('input', () => { if (!keyField.dataset.touched) keyField.value = slugKey(autoKey.value); });
  }

  const iconPicker = form.querySelector('[data-icon-picker]');
  if (iconPicker) {
    const select = iconPicker.querySelector('select');
    const preview = iconPicker.querySelector('[data-icon-preview]');
    const showPreview = () => { preview.innerHTML = icon(select.value, 24); };
    select.addEventListener('change', showPreview);
    iconPicker.querySelector('[data-icon-upload]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const dataUrl = await fileToIconDataUrl(file);
        [...select.options].filter(o => o.dataset.custom).forEach(o => o.remove());
        const opt = new Option('Ảnh tải lên', dataUrl, false, true);
        opt.dataset.custom = '1';
        select.add(opt);
        showPreview();
      } catch (err) {
        toast(err.message, 'danger');
      }
    });
  }
}

const RESERVED_KEYS = ['dashboard', 'tongquan', 'accounts', 'software', 'portal', 'm'];

// Thiết bị có người dùng trùng họ tên với hồ sơ trong Thông tin chung thì liên kết với hồ sơ đó:
// chức vụ và đơn vị lấy theo hồ sơ gốc, và tự cập nhật khi sửa hồ sơ gốc
function linkDeviceToPerson(record, data) {
  const master = (data.tonghopchung || []).find(p => normalizeStr(p.name) === normalizeStr(record.name));
  record.personId = master?.id;
  if (!master) return;
  record.name = master.name;
  record.role = master.role || record.role || '';
  record.unit = master.unit || record.unit || '';
}

// Bản ghi cho một người được chọn từ hồ sơ gốc: thông tin cá nhân lấy từ hồ sơ gốc, phần còn lại lấy từ biểu mẫu
function personRecord(kind, record, p, id) {
  const link = { name: p.name, role: p.role || '', unit: p.unit, personId: p.id };
  if (kind === 'device') return { ...record, ...link, id };
  return {
    ...record, ...link, id, gender: p.gender || '', phone: p.phone || '', email: p.email || '',
    cccd: p.cccd || '', cccdDate: p.cccdDate || '', account: slugKey(p.name)
  };
}

async function saveRecord(mode, key, original, form, picked = []) {
  const kind = info[key].kind;
  const { record, suggest, software } = readForm(form, kind);
  const data = store.state.data;
  // Đường dẫn không lưu trong bản ghi phần mềm mà trong links (xem openForm)
  const link = record.link;
  delete record.link;

  // Bỏ tích phần mềm = xóa tài khoản ở phần mềm đó: hỏi lại trước khi làm
  if (mode === 'edit' && kind === 'person') {
    const dropped = linkedAccountKeys(data, info, original).filter(k => !software.includes(k));
    if (dropped.length && !(await confirmDialog(`Gỡ tài khoản của "${original.name}" khỏi ${dropped.map(k => info[k].title).join(', ')}? Các tài khoản này sẽ bị xóa khỏi phần mềm.`, { okText: 'Gỡ tài khoản' }))) return;
  }

  if (kind === 'appconfig') {
    if (mode === 'edit') record.col1 = original.col1;
    else if (!record.col1 || info[record.col1] || data[record.col1] || RESERVED_KEYS.includes(record.col1)) {
      form.elements.col1.focus();
      return toast('Mã hệ thống trống hoặc đã tồn tại, vui lòng chọn mã khác.', 'danger');
    }
    store.state.links[record.col1] = link || '';
  }

  if (kind === 'portalcluster') {
    if (mode === 'edit') record.col1 = original.col1;
    else if (!record.col1 || record.col1 === PORTAL_OTHER.key || portalCategoriesOf(data).some(c => c.key === record.col1)) {
      form.elements.col1.focus();
      return toast('Mã cụm trống hoặc đã tồn tại, vui lòng chọn mã khác.', 'danger');
    }
  }

  if (kind === 'code' && !(data.donvitochuc || []).some(u => u.name === record.col1)) {
    form.elements.col1.focus();
    return toast('Mã định danh phải liên kết với một đơn vị tổ chức đã tạo.', 'danger');
  }

  // Chọn người từ hồ sơ gốc: mỗi người một bản ghi, dùng chung thông số và trạng thái đã nhập ở biểu mẫu
  if (mode === 'add' && (kind === 'device' || kind === 'account') && picked.length) {
    const noUnit = picked.find(p => !p.unit);
    if (noUnit) return toast(`Hồ sơ gốc của "${noUnit.name}" chưa có đơn vị. Hãy bổ sung trong Thông tin chung rồi thử lại.`, 'danger');
    const units = new Set((data.donvitochuc || []).map(u => u.name));
    const noUnitRecord = kind === 'account' && picked.find(p => !units.has(p.unit));
    if (noUnitRecord) return toast(`Đơn vị "${noUnitRecord.unit}" của "${noUnitRecord.name}" chưa có trong Đơn vị tổ chức. Hãy tạo đơn vị đó trước.`, 'danger');
    const newId = newIdFactory(data);
    const rows = picked.map(p => personRecord(kind, record, p, newId()));
    data[key] = [...rows, ...(data[key] || [])];
    // Tạo tài khoản đồng thời ở các phần mềm đã tích: mỗi người cũng có một tài khoản ở từng phần mềm đó
    suggest.forEach(k => { data[k] = [...rows.map(r => ({ ...r, id: newId() })), ...(data[k] || [])]; });
    commit();
    closeModal();
    renderView();
    const label = kind === 'account' ? 'tài khoản' : 'thiết bị';
    toast(`Đã thêm ${rows.length} ${label}, mỗi người một bản ghi${suggest.length ? `, và cấp thêm tài khoản ở ${suggest.length} phần mềm` : ''}.`);
    return;
  }

  if (kind === 'device') linkDeviceToPerson(record, data);

  let msg;
  if (mode === 'add') {
    const id = uid();
    // Cụm mới nối xuống cuối để khớp thứ tự hiển thị trên Cổng điều phối
    data[key] = kind === 'portalcluster' ? [...(data[key] || []), { ...record, id }] : [{ ...record, id }, ...(data[key] || [])];
    if (kind === 'appconfig') data[record.col1] = [];
    suggest.forEach((k, i) => {
      const sub = {
        name: record.name, gender: record.gender, role: record.role, unit: record.unit, phone: record.phone, email: record.email,
        cccd: record.cccd, cccdDate: record.cccdDate,
        account: record.account || slugKey(record.name), password: record.password || '',
        status: record.status || 'Bình thường', statusType: record.statusType || 'success', id: id + i + 1
      };
      data[k] = [sub, ...(data[k] || [])];
    });
    msg = suggest.length ? `Đã lưu và tạo thêm ${suggest.length} tài khoản phần mềm.` : 'Đã lưu bản ghi mới.';
  } else {
    const updated = { ...original, ...record, id: original.id };
    data[key] = data[key].map(x => (String(x.id) === String(original.id) ? updated : x));
    msg = 'Đã cập nhật thay đổi.';
    if (kind === 'person') {
      const before = linkedAccountKeys(data, info, original);
      const synced = syncPersonAccounts(data, original, updated);
      const { added, removed } = applyPersonLinks(data, updated, software, before);
      const parts = [];
      if (synced) parts.push(`đồng bộ ${synced} bản ghi liên quan`);
      if (added) parts.push(`cấp thêm ${added} tài khoản`);
      if (removed) parts.push(`gỡ ${removed} tài khoản`);
      if (parts.length) msg = `Đã cập nhật: ${parts.join(', ')}.`;
    }
  }
  commit();
  closeModal();
  renderView();
  toast(msg);
}

// Cấp tài khoản ở phần mềm vừa tích, gỡ tài khoản ở phần mềm vừa bỏ tích. Trả về số tài khoản đã cấp và đã gỡ
function applyPersonLinks(data, person, software, before) {
  let added = 0;
  let removed = 0;
  const base = uid();
  software.filter(k => !before.includes(k)).forEach(k => {
    const account = {
      id: base + added, name: person.name, gender: person.gender, role: person.role, unit: person.unit, phone: person.phone, email: person.email,
      cccd: person.cccd, cccdDate: person.cccdDate, account: slugKey(person.name), password: '', status: 'Bình thường', statusType: 'success'
    };
    data[k] = [account, ...(data[k] || [])];
    added++;
  });
  before.filter(k => !software.includes(k)).forEach(k => {
    const rest = (data[k] || []).filter(item => !isSamePerson(item, person));
    removed += (data[k] || []).length - rest.length;
    data[k] = rest;
  });
  return { added, removed };
}

async function deleteRecord(id) {
  const key = ui.route.key;
  const row = findRow(key, id);
  if (!row) return;
  const label = row.name || row.col1 || 'bản ghi này';
  const used = info[key].kind === 'portalcluster' ? (store.state.data.quanlyphanmem || []).filter(p => p.category === row.col1).length : 0;
  const warn = used ? ` ${used} phần mềm đang thuộc cụm này sẽ chuyển sang "${PORTAL_OTHER.title}".` : '';
  if (!(await confirmDialog(`Xóa "${label}" khỏi ${info[key].title}?${warn}`, { okText: 'Xóa' }))) return;
  const list = store.state.data[key];
  const index = list.indexOf(row);
  list.splice(index, 1);
  const kind = info[key].kind;
  let orphan = null;
  if (kind === 'appconfig' && row.col1 && !(store.state.data[row.col1] || []).length) {
    orphan = row.col1;
    delete store.state.data[row.col1];
  }
  commit();
  while (modalStack.length) closeModal();
  renderView();
  toast(`Đã xóa "${label}".`, 'info', {
    action: 'Hoàn tác', duration: 7000,
    onAction: () => {
      store.state.data[key].splice(index, 0, row);
      if (orphan) store.state.data[orphan] = [];
      commit(); renderView(); toast('Đã khôi phục bản ghi.');
    }
  });
}

// ==========================================
// NHẬP HÀNG LOẠT (file Excel): Thông tin chung, Đơn vị tổ chức
// ==========================================
let pendingImport = null; // { plan, apply }: chờ người dùng xác nhận ở bản xem trước

const PEOPLE_IMPORT = { read: readPersonImport, apply: applyPeopleImport, sub: 'Thông tin chung' };
const UNIT_IMPORT = { read: readUnitImport, apply: applyUnitImport, sub: 'Đơn vị tổ chức' };

// Tải file mẫu: count và noun dùng cho dòng thông báo (ví dụ "gồm 3 đơn vị hiện có")
async function downloadBulkTemplate(makeBlob, fileBase, count, noun) {
  try {
    const blob = await makeBlob();
    downloadBlob(blob, `${fileBase}_${todayStamp()}.xlsx`);
    toast(`Đã tải file mẫu${count ? ` gồm ${count} ${noun} hiện có` : ''}.`);
  } catch {
    toast('Không tạo được file Excel. Kiểm tra kết nối mạng rồi thử lại.', 'danger');
  }
}

const downloadPeopleTemplate = () => {
  const { data } = store.state;
  return downloadBulkTemplate(() => buildPersonTemplate(data.tonghopchung || [], unitsOf(data)), 'Mau_Thong_tin_chung', data.tonghopchung?.length, 'hồ sơ');
};

const downloadUnitTemplate = () => {
  const { data } = store.state;
  return downloadBulkTemplate(() => buildUnitTemplate(data.donvitochuc || []), 'Mau_Don_vi_to_chuc', data.donvitochuc?.length, 'đơn vị');
};

async function importBulkFile(file, { read, apply, sub }) {
  if (!file) return;
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return toast('Chỉ nhận file Excel (.xlsx, .xls) hoặc .csv.', 'warning');
  try {
    const plan = await read(file, store.state.data);
    openImportPreview(file.name, plan, { apply, sub });
  } catch (e) {
    toast(e.message || 'Không đọc được file Excel.', 'danger');
  }
}

// Bản xem trước: chỉ ghi dữ liệu sau khi người dùng xác nhận
function openImportPreview(fileName, plan, { apply, sub }) {
  pendingImport = { plan, apply };
  const adds = plan.rows.filter(r => r.action === 'add').length;
  const updates = plan.rows.length - adds;
  const shown = plan.errors.slice(0, 50);
  const errorBox = plan.errors.length ? `<div class="callout callout-danger">${icon('alert', 20)}<div>
      <strong>${plan.errors.length} dòng lỗi, sẽ được bỏ qua</strong>
      <ul class="import-errors">${shown.map(e => `<li>Dòng ${e.line} (${esc(e.name)}): ${esc(e.message)}</li>`).join('')}</ul>
      ${plan.errors.length > shown.length ? `<p>Và ${plan.errors.length - shown.length} dòng lỗi khác.</p>` : ''}
    </div></div>` : '';
  const body = `
    <div class="import-stats">
      <div class="import-stat is-add"><b>${adds}</b><span>Thêm mới</span></div>
      <div class="import-stat is-update"><b>${updates}</b><span>Cập nhật</span></div>
      <div class="import-stat is-error"><b>${plan.errors.length}</b><span>Bỏ qua (lỗi)</span></div>
    </div>
    <p class="field-hint">Tệp: <strong>${esc(fileName)}</strong>. ${plan.rows.length ? 'Sau khi nhập vẫn có thể hoàn tác trong vài giây.' : 'Không có dòng hợp lệ nào để nhập.'}</p>
    ${errorBox}`;
  openModal({
    title: 'Xem trước nhập hàng loạt', sub, ic: 'upload', tone: 'blue', size: 'md', body,
    foot: `<button type="button" class="btn btn-ghost" data-action="close-modal">Hủy bỏ</button>
      <button type="button" class="btn btn-primary" data-action="confirm-import"${plan.rows.length ? '' : ' disabled'}>${icon('check', 18)} Nhập ${plan.rows.length} dòng</button>`
  });
}

// Nút "Nhập N dòng" ở bản xem trước
function applyPendingImport() {
  const pending = pendingImport;
  pendingImport = null;
  if (!pending?.plan.rows.length) return;
  pending.apply(pending.plan);
}

// Hàm cấp mã mới, không trùng mã nào trong dữ liệu
function newIdFactory(data) {
  const usedIds = new Set(Object.values(data).flat().map(x => String(x.id)));
  return () => { let id = uid(); while (usedIds.has(String(id))) id++; usedIds.add(String(id)); return id; };
}

// Ghi xong một lần nhập hàng loạt, có nút hoàn tác trong vài giây
function finishBulkImport(snapshot, parts, errorCount) {
  commit();
  closeModal();
  renderView();
  if (errorCount) parts.push(`bỏ qua ${errorCount} dòng lỗi`);
  toast(`Đã nhập hàng loạt: ${parts.join(', ')}.`, 'success', {
    action: 'Hoàn tác', duration: 9000,
    onAction: () => { store.state.data = snapshot; commit(); renderView(); toast('Đã hoàn tác lần nhập hàng loạt.'); }
  });
}

function applyPeopleImport(plan) {
  const { data } = store.state;
  const snapshot = structuredClone(data);
  const newId = newIdFactory(data);

  let list = data.tonghopchung || [];
  const added = [];
  let updated = 0;
  let synced = 0;
  plan.rows.forEach(row => {
    if (row.action === 'add') { added.push({ ...row.record, id: newId() }); return; }
    const original = list.find(p => String(p.id) === String(row.targetId));
    if (!original) return;
    const next = { ...original, ...row.record, id: original.id };
    synced += syncPersonAccounts(data, original, next);
    list = list.map(p => (p === original ? next : p));
    updated++;
  });
  data.tonghopchung = [...added, ...list];

  const parts = [`thêm mới ${added.length}`, `cập nhật ${updated}`];
  if (synced) parts.push(`đồng bộ ${synced} tài khoản`);
  finishBulkImport(snapshot, parts, plan.errors.length);
}

function applyUnitImport(plan) {
  const { data } = store.state;
  const snapshot = structuredClone(data);
  const newId = newIdFactory(data);

  let list = data.donvitochuc || [];
  const added = [];
  let updated = 0;
  plan.rows.forEach(row => {
    if (row.action === 'add') { added.push({ ...row.record, id: newId() }); return; }
    const original = list.find(u => String(u.id) === String(row.targetId));
    if (!original) return;
    list = list.map(u => (u === original ? { ...original, ...row.record, id: original.id } : u));
    updated++;
  });
  data.donvitochuc = [...added, ...list];

  finishBulkImport(snapshot, [`thêm mới ${added.length}`, `cập nhật ${updated}`], plan.errors.length);
}

function openDetail(id) {
  const key = ui.route.key;
  const row = findRow(key, id);
  if (!row) return;
  openModal({
    title: row.name || row.col1 || 'Chi tiết', sub: info[key].title, ic: info[key].icon, tone: info[key].tone, size: 'md',
    body: renderDetail(ctx(), key, row)
  });
}

function openPersonDetail(id) {
  const person = userSummary(store.state.data, info).find(p => p.id === id);
  if (!person) return;
  const master = (store.state.data.tonghopchung || []).find(p => normalizeStr(p.name) === normalizeStr(person.name));
  const mods = Object.keys(person.modules);
  openModal({
    title: person.name, sub: [person.role, person.unit].filter(Boolean).join(' · '), ic: 'userCheck', size: 'md',
    body: `<p class="note-title">Đã được cấp ${mods.length} tài khoản phần mềm</p>
      <ul class="link-list">${mods.map(k => {
        const acc = (store.state.data[k] || []).find(a => normalizeStr(a.name) === normalizeStr(person.name));
        return `<li><a href="#/m/${k}" data-action="close-modal" class="link-row" data-tone="${info[k].tone}"><span class="icon-chip tone-${info[k].tone}">${icon(info[k].icon, 16)}</span><span><strong>${esc(info[k].title)}</strong><small class="mono">${esc(acc?.account || '')}</small></span>${acc?.status ? `<span class="badge badge-${acc.statusType || 'info'}">${esc(acc.status)}</span>` : ''}</a></li>`;
      }).join('')}</ul>
      ${master ? `<a class="callout callout-blue" href="#/m/tonghopchung" data-action="close-modal">${icon('badge', 20)}<div><strong>Hồ sơ gốc</strong><p>CCCD ${esc(master.cccd || '—')} · ĐT ${esc(master.phone || '—')}</p></div></a>`
        : `<div class="callout callout-yellow">${icon('alert', 20)}<div><strong>Chưa có hồ sơ gốc</strong><p>Nên bổ sung người này vào mục Thông tin chung để đồng bộ dữ liệu.</p></div></div>`}`
  });
}

// ==========================================
// GHI CHÚ, ĐƯỜNG DẪN
// ==========================================
function openNoteEditor() {
  const key = ui.route.key;
  const layer = openModal({
    title: 'Ghi chú / Hướng dẫn', sub: info[key].title, ic: 'note', tone: 'yellow',
    body: `<form id="note-form" class="form"><div class="field"><label for="note-text">Nội dung hiển thị ở đầu trang</label>
      <textarea id="note-text" class="input" rows="7" placeholder="Mô tả phần mềm, hướng dẫn ngắn...">${esc(store.state.notes[key] || '')}</textarea></div></form>`,
    foot: `<button class="btn btn-ghost" data-action="close-modal">Hủy</button><button type="submit" form="note-form" class="btn btn-primary">${icon('save', 18)} Lưu ghi chú</button>`
  });
  layer.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    store.state.notes[key] = layer.querySelector('#note-text').value.trim();
    commit(); closeModal(); renderView(); toast('Đã lưu ghi chú.');
  });
}

function openLinkEditor() {
  const key = ui.route.key;
  const layer = openModal({
    title: 'Đường dẫn trang web', sub: info[key].title, ic: 'link',
    body: `<form id="link-form" class="form"><div class="field"><label for="link-url">Địa chỉ (URL)</label>
      <input id="link-url" type="url" class="input mono" placeholder="https://..." value="${esc(store.state.links[key] || '')}"></div></form>`,
    foot: `<button class="btn btn-ghost" data-action="close-modal">Hủy</button><button type="submit" form="link-form" class="btn btn-primary">${icon('save', 18)} Lưu đường dẫn</button>`
  });
  layer.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    store.state.links[key] = layer.querySelector('#link-url').value.trim();
    commit(); closeModal(); renderView(); toast('Đã lưu đường dẫn.');
  });
}

// ==========================================
// XUẤT FILE
// ==========================================
function doExport(format) {
  const rows = currentRows();
  if (!rows.length) return toast('Không có dữ liệu để xuất!', 'warning');
  const r = ui.route;
  if (r.id === 'accounts') exportTable({ format, rows, columns: userSummaryColumns(info, true), title: 'BẢNG TỔNG HỢP PHÂN QUYỀN TÀI KHOẢN PHẦN MỀM', fileBase: 'TongHop_TaiKhoan_BinhMy' });
  else if (r.id === 'software') exportTable({ format, rows, columns: softwareColumns(), title: 'BẢNG TỔNG HỢP SỐ LƯỢNG TÀI KHOẢN PHẦN MỀM', fileBase: 'TongHop_PhanMem_BinhMy' });
  else exportTable({ format, rows, columns: columnsFor(info[r.key].kind, store.state.data), title: `DANH SÁCH ${info[r.key].title.toUpperCase()}`, fileBase: 'Danh_sach_' + slugKey(info[r.key].title) });
  toast(`Đã xuất ${rows.length} dòng ra file ${format === 'excel' ? 'Excel' : 'Word'}.`);
}

// ==========================================
// TÀI LIỆU ĐÍNH KÈM
// ==========================================
const docList = (key, type) => {
  const docs = store.state.docs;
  docs[key] = docs[key] || {};
  docs[key][type] = docs[key][type] || [];
  return docs[key][type];
};

async function uploadFiles(files, type) {
  const key = ui.route.key;
  if (!key || !files?.length) return;
  const list = docList(key, type);
  let ok = 0; const skipped = [];
  for (const [i, file] of [...files].entries()) {
    if (file.size > MAX_FILE) { skipped.push(file.name); continue; }
    const id = `doc_${uid()}_${i}`;
    await putFile(id, file);
    list.unshift({ id, name: file.name, size: formatSize(file.size), date: new Date().toLocaleDateString('vi-VN'), fileType: file.type });
    ok++;
  }
  commit(); renderView();
  if (ok) toast(`Đã tải lên ${ok} tệp.`);
  if (skipped.length) toast(`Bỏ qua tệp quá 25 MB: ${skipped.join(', ')}`, 'warning');
}

async function downloadDoc(id, type) {
  const doc = docList(ui.route.key, type).find(d => d.id === id);
  const blob = doc && await getFile(id);
  if (!blob) return toast('Không tìm thấy tệp trên thiết bị này.', 'danger');
  downloadBlob(blob, doc.name);
}

async function removeDoc(id, type) {
  const list = docList(ui.route.key, type);
  const doc = list.find(d => d.id === id);
  if (!doc || !(await confirmDialog(`Xóa vĩnh viễn tệp "${doc.name}"?`, { okText: 'Xóa tệp' }))) return;
  list.splice(list.indexOf(doc), 1);
  await deleteFile(id);
  commit(); renderView(); toast('Đã xóa tệp.', 'info');
}

async function openPreview(id, type) {
  const doc = docList(ui.route.key, type).find(d => d.id === id);
  if (!doc) return;
  const layer = openModal({
    title: doc.name, sub: `${doc.size} · Bản xem trước`, ic: 'file', size: 'xl',
    body: `<div class="preview"><div class="preview-main" id="pv-main"><div class="loading"><span class="spinner"></span><p>Đang xử lý tài liệu...</p></div></div></div>`,
    foot: `<button class="btn btn-ghost" data-action="close-modal">Đóng</button>
      <button class="btn btn-outline" data-action="download-doc" data-doc-id="${esc(id)}" data-doc-type="${type}">${icon('download', 16)} Tải xuống</button>`
  });
  const main = layer.querySelector('#pv-main');
  const preview = await buildPreview(doc);
  const entry = modalStack.find(m => m.layer === layer);
  if (entry) entry.onClose = () => preview.url && URL.revokeObjectURL(preview.url);

  if (preview.kind === 'image') main.innerHTML = `<img src="${preview.url}" alt="${esc(doc.name)}" class="pv-img">`;
  else if (preview.kind === 'pdf') main.innerHTML = `<iframe src="${preview.url}" title="${esc(doc.name)}" class="pv-frame"></iframe>`;
  else if (preview.kind === 'html') main.innerHTML = `<div class="pv-doc">${preview.html}</div>`;
  else if (preview.kind === 'text') main.innerHTML = `<pre class="pv-text">${esc(preview.text)}</pre>`;
  else main.innerHTML = `<div class="empty">${icon(preview.kind === 'error' ? 'alert' : 'eyeOff', 40)}<p>${esc(preview.message || 'Không thể xem trước loại tệp này trên trình duyệt. Hãy tải xuống để mở.')}</p></div>`;
}

// ==========================================
// TÌM KIẾM TOÀN HỆ THỐNG
// ==========================================
function renderSearchPop() {
  const input = $('#gsearch'); const pop = $('#gsearch-pop');
  const res = globalSearch(input.value, store.state.data, info);
  if (!res) { pop.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
  const item = (href, q, ic, title, sub, tone = 'blue') => `<button class="gs-item" role="option" data-action="search-go" data-href="${esc(href)}" data-q="${esc(q)}">
    <span class="icon-chip tone-${tone}">${icon(ic, 16)}</span><span class="gs-text"><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${icon('arrowRight', 16, 'gs-go')}</button>`;
  let html = '';
  if (res.cccdMatch) {
    html += `<div class="gs-ai">${icon('sparkles', 18)}<span>Nhận diện CCCD thuộc về <strong>${esc(res.cccdMatch.name)}</strong></span></div>` +
      item('#/m/tonghopchung', res.cccdMatch.cccd, 'badge', res.cccdMatch.name, `Hồ sơ gốc · ${res.cccdMatch.unit || ''}`);
  }
  if (res.modules.length) html += `<p class="gs-group">Phần mềm & mục</p>` + res.modules.slice(0, 5).map(m => item(`#/m/${m.key}`, '', m.icon, m.title, 'Mở trang', m.tone)).join('');
  res.groups.slice(0, 6).forEach(g => {
    html += `<p class="gs-group">${esc(g.info.title)} <span>${g.hits.length}</span></p>` + g.hits.slice(0, 3).map(h =>
      item(`#/m/${g.key}`, h.cccd || h.name || h.col1 || '', g.info.icon, h.name || h.col1, [h.account || h.col2 || h.unit, h.cccd ? `CCCD ${h.cccd}` : ''].filter(Boolean).join(' · '), g.info.tone)).join('');
  });
  if (!html) html = `<div class="empty compact">${icon('search', 32)}<p>Không tìm thấy kết quả cho “${esc(input.value)}”.</p></div>`;
  else html = `<p class="gs-summary">${res.total} kết quả dữ liệu</p>` + html;
  pop.innerHTML = html;
  pop.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function closeSearch() {
  $('#gsearch-pop').hidden = true;
  $('#gsearch').setAttribute('aria-expanded', 'false');
}

// ==========================================
// MENU ĐIỆN THOẠI
// ==========================================
function openMenu() { document.body.classList.add('menu-open'); $('#sidebar .nav-item')?.focus(); }
function closeMenu() { document.body.classList.remove('menu-open'); }

// ==========================================
// GẮN SỰ KIỆN (ủy quyền sự kiện cho toàn trang)
// ==========================================
function bindEvents() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    const id = el.dataset.id;
    switch (a) {
      case 'open-menu': return openMenu();
      case 'close-menu': return closeMenu();
      case 'toggle-sidebar': return setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
      case 'close-modal': return closeModal();
      case 'focus-search': return $('#gsearch').focus();
      case 'add': return openForm('add');
      case 'edit': { const row = findRow(ui.route.key, id); while (modalStack.length) closeModal(); return row && openForm('edit', row); }
      case 'delete': return deleteRecord(id);
      case 'detail': return openDetail(id);
      case 'person-detail': return openPersonDetail(id);
      case 'go': location.hash = el.dataset.href; return;
      case 'page': ui.page = Number(el.dataset.page) || 1; renderTable(); return $('.table-card')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      case 'status-filter': {
        ui.status = ui.status === el.dataset.status ? 'all' : el.dataset.status;
        ui.page = 1;
        document.querySelectorAll('[data-action="status-filter"]').forEach(c => { const on = c.dataset.status === ui.status; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', on); });
        return renderTable();
      }
      case 'export': return doExport(el.dataset.format);
      case 'people-template': return downloadPeopleTemplate();
      case 'unit-template': return downloadUnitTemplate();
      case 'confirm-import': return applyPendingImport();
      case 'edit-note': return openNoteEditor();
      case 'edit-link': return openLinkEditor();
      case 'preview-doc': return openPreview(el.dataset.docId, el.dataset.docType);
      case 'download-doc': return downloadDoc(el.dataset.docId, el.dataset.docType);
      case 'delete-doc': return removeDoc(el.dataset.docId, el.dataset.docType);
      case 'toggle-pw': {
        const input = el.parentElement.querySelector('input');
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        el.innerHTML = icon(show ? 'eyeOff' : 'eye', 18);
        return;
      }
      case 'search-go': {
        e.preventDefault();
        const href = el.dataset.href; const q = el.dataset.q;
        $('#gsearch').value = ''; closeSearch();
        if (location.hash === href) { ui.search = q; ui.page = 1; renderView(); }
        else { pendingSearch = q; location.hash = href; }
        return;
      }
      default:
    }
  });

  // Phím Enter/Space trên dòng bảng, thẻ
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && t.matches('[data-action][tabindex]') && !t.matches('button, a, input')) {
      e.preventDefault(); t.click();
    }
    if (e.key === 'Escape') {
      if (modalStack.length) return closeModal();
      if (!$('#gsearch-pop').hidden) { closeSearch(); return $('#gsearch').blur(); }
      if (document.body.classList.contains('menu-open')) return closeMenu();
    }
    if (e.key === '/' && !modalStack.length && !t.matches('input, textarea, select, [contenteditable]')) {
      e.preventDefault(); $('#gsearch').focus();
    }
    if (e.key === 'Tab' && modalStack.length) trapFocus(e);
    if (t.id === 'gsearch' && e.key === 'ArrowDown') { e.preventDefault(); $('#gsearch-pop .gs-item')?.focus(); }
    if (t.classList?.contains('gs-item') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const items = [...document.querySelectorAll('#gsearch-pop .gs-item')];
      const i = items.indexOf(t) + (e.key === 'ArrowDown' ? 1 : -1);
      (i < 0 ? $('#gsearch') : items[Math.min(i, items.length - 1)]).focus();
    }
    if (t.id === 'gsearch' && e.key === 'Enter') { e.preventDefault(); $('#gsearch-pop .gs-item')?.click(); }
  });

  const onLocalSearch = debounce((val) => { ui.search = val; ui.page = 1; renderTable(); }, 140);
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'local-search') onLocalSearch(t.value);
    if (t.id === 'gsearch') renderSearchPop();
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'unit-filter') { ui.unit = t.value; ui.page = 1; renderTable(); }
    if (t.id === 'cluster-filter') { ui.cluster = t.value; renderView(); }
    if (t.id === 'per-page') { ui.perPage = Number(t.value); ui.page = 1; renderTable(); }
    if (t.dataset.upload) { uploadFiles(t.files, t.dataset.upload); t.value = ''; }
    if (t.matches('[data-import-people]')) { importBulkFile(t.files[0], PEOPLE_IMPORT); t.value = ''; }
    if (t.matches('[data-import-units]')) { importBulkFile(t.files[0], UNIT_IMPORT); t.value = ''; }
  });

  // Giữ focus ở ô tìm kiếm khi bấm vào kết quả (tránh danh sách bị đóng trước khi nhận click)
  $('#gsearch-pop').addEventListener('mousedown', (e) => e.preventDefault());
  document.addEventListener('focusin', (e) => {
    if (e.target.id === 'gsearch' && e.target.value) renderSearchPop();
  });
  document.addEventListener('focusout', () => {
    setTimeout(() => { if (!$('#gsearch-wrap').contains(document.activeElement)) closeSearch(); }, 120);
  });

  // Kéo thả tệp vào kho tài liệu
  document.addEventListener('dragover', (e) => {
    const box = e.target.closest?.('.doc-box');
    if (!box) return;
    e.preventDefault(); box.classList.add('is-drop');
  });
  document.addEventListener('dragleave', (e) => e.target.closest?.('.doc-box')?.classList.remove('is-drop'));
  document.addEventListener('drop', (e) => {
    const box = e.target.closest?.('.doc-box');
    if (!box) return;
    e.preventDefault(); box.classList.remove('is-drop');
    const type = box.querySelector('[data-upload]')?.dataset.upload;
    if (type) uploadFiles(e.dataTransfer.files, type);
  });

  // Đồng bộ khi mở nhiều tab
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try { store.state = normalizeState(JSON.parse(e.newValue)); info = buildModuleInfo(store.state.data); renderView(); } catch { /* bỏ qua */ }
  });

  window.addEventListener('hashchange', onRoute);
}

function trapFocus(e) {
  const modal = modalStack[modalStack.length - 1].layer.querySelector('.modal');
  const items = [...modal.querySelectorAll('a[href], button:not([disabled]), input:not([type=hidden]):not(.sr-only), select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
  if (!items.length) return;
  const first = items[0]; const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function startClock() {
  const el = $('#clock');
  const tick = () => {
    const d = new Date();
    el.innerHTML = `<strong>${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong><span>${d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>`;
  };
  tick();
  setInterval(tick, 1000);
}

// ==========================================
// KHỞI ĐỘNG
// ==========================================
export function boot() {
  const { state, fresh } = loadState();
  store.state = state;
  if (fresh) saveState(state);
  info = buildModuleInfo(state.data);
  renderShell();
  let collapsed = false;
  try { collapsed = localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { /* bỏ qua */ }
  setSidebarCollapsed(collapsed);
  bindEvents();
  onRoute();
  startClock();
  document.documentElement.classList.add('is-ready');
  if (fresh) setTimeout(() => toast('Chào mừng! Đang dùng dữ liệu mẫu — bấm “Thêm mới” ở từng mục để bắt đầu nhập liệu.', 'info', { duration: 6500 }), 600);
}
