// ==========================================
// GIAO DIỆN CÁC TRANG (trả về chuỗi HTML)
// ctx = { data, info, ui, notes, links, docs, units }
// ==========================================
import { icon } from './icons.js';
import { esc, statusTypeOf, searchTerms, matchesTerms } from './utils.js';
import { columnsFor } from './columns.js';
import { fileIconName } from './files.js';
import { computeInsights } from './insights.js';
import { PORTAL_OTHER } from './config.js';
import {
  accountKeysOf, softwareKeysOf, collectAlerts, statusBreakdown, hasUnitFilter, hasStatus,
  portalClusters
} from './model.js';

const KIND_DESC = {
  person: 'Quản lý hồ sơ nhân sự gốc — nguồn dữ liệu chuẩn cho mọi phần mềm',
  account: 'Quản lý tài khoản phần mềm',
  device: 'Quản lý phần cứng, máy tính và thiết bị ngoại vi',
  camera: 'Quản lý hệ thống camera an ninh',
  unit: 'Quản lý danh sách phòng ban, đơn vị trực thuộc',
  code: 'Mã định danh điện tử của cơ quan, trường học',
  appconfig: 'Tạo mới, chỉnh sửa các phần mềm / tiện ích mở rộng',
  portalcluster: 'Tạo cụm nghiệp vụ để gom phần mềm trên Cổng điều phối. Mỗi phần mềm chọn cụm trong Cấu hình phần mềm'
};

const STATUS_LABEL = { success: 'Bình thường', info: 'Theo dõi', warning: 'Cần xử lý', danger: 'Nghiêm trọng' };

const GROUP_LABEL = { system: 'Hệ thống', asset: 'Tài sản & Thiết bị', software: 'Phần mềm', config: 'Tổ chức & Cấu hình' };

// ---------------- MENU ----------------
export function renderNav(ctx, routeId) {
  const { info, data } = ctx;
  const item = (href, id, label, ic, tone, count) => `
    <a href="${href}" class="nav-item${routeId === id ? ' is-active' : ''}"${routeId === id ? ' aria-current="page"' : ''} data-tone="${tone}" title="${esc(label)}">
      <span class="nav-ic">${icon(ic, 18)}</span><span class="nav-label">${esc(label)}</span>${count !== undefined ? `<span class="nav-count">${count}</span>` : ''}
    </a>`;
  const mod = (k) => item(`#/m/${k}`, `m:${k}`, info[k].title, info[k].icon, info[k].tone, (data[k] || []).length);
  const keysOf = (g) => Object.keys(info).filter(k => info[k].group === g);
  const group = (title, html) => html ? `<div class="nav-group"><p class="nav-title">${esc(title)}</p>${html}</div>` : '';

  return [
    group('Hệ thống',
      item('#/', 'portal', 'Cổng điều phối', 'compass', 'blue') +
      item('#/tongquan', 'dashboard', 'Tổng quan', 'dashboard', 'blue') +
      mod('tonghopchung') +
      item('#/accounts', 'accounts', 'Tổng hợp tài khoản', 'userCheck', 'blue') +
      item('#/software', 'software', 'Tổng hợp phần mềm', 'layers', 'blue')),
    group(GROUP_LABEL.asset, keysOf('asset').map(mod).join('')),
    group(GROUP_LABEL.software, [...keysOf('software'), ...keysOf('dynamic')].map(mod).join('')),
    group(GROUP_LABEL.config, ['quanlyphanmem', 'donvitochuc', 'madinhdanh', 'cumdieuphoi'].map(mod).join(''))
  ].join('');
}

// ---------------- THÀNH PHẦN DÙNG CHUNG ----------------
const cellHtml = (c, r) => (c.html ? c.html(r) : (esc(c.v(r)) || '<span class="muted">—</span>'));

export function dataTable({ columns, rows, offset = 0, editable = false, rowAttr = () => '', emptyText = 'Không có dữ liệu phù hợp', emptyCta = '' }) {
  if (!rows.length) {
    return `<div class="empty">${icon('search', 40)}<p>${esc(emptyText)}</p>${emptyCta}</div>`;
  }
  const cols = columns.filter(c => !c.exportOnly);
  const primary = cols.find(c => c.primary) || cols[0];
  const actions = (r) => editable ? `<div class="row-actions">
      <button class="icon-btn sm" data-action="edit" data-id="${esc(r.id)}" aria-label="Sửa">${icon('edit', 16)}</button>
      <button class="icon-btn sm danger" data-action="delete" data-id="${esc(r.id)}" aria-label="Xóa">${icon('trash', 16)}</button>
    </div>` : '';

  const table = `<div class="table-wrap"><table class="table">
    <thead><tr><th class="col-idx">STT</th>${cols.map(c => `<th class="${c.align ? 'ta-' + c.align : ''}">${c.hHtml || esc(c.h)}</th>`).join('')}${editable ? '<th class="col-act">Thao tác</th>' : ''}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr ${rowAttr(r)} style="--i:${Math.min(i, 12)}">
      <td class="col-idx">${offset + i + 1}</td>
      ${cols.map(c => `<td class="${c.align ? 'ta-' + c.align : ''}">${cellHtml(c, r)}</td>`).join('')}
      ${editable ? `<td class="col-act">${actions(r)}</td>` : ''}
    </tr>`).join('')}</tbody></table></div>`;

  const cards = `<ul class="rec-cards">${rows.map((r, i) => {
    const details = cols.filter(c => c !== primary && c.v(r)).map(c => `<div class="rec-row"><dt>${esc(c.h)}</dt><dd>${cellHtml(c, r)}</dd></div>`).join('');
    return `<li class="rec-card" ${rowAttr(r)} style="--i:${Math.min(i, 12)}">
      <div class="rec-head"><span class="rec-idx">${offset + i + 1}</span><div class="rec-title">${cellHtml(primary, r)}</div>${actions(r)}</div>
      ${details ? `<dl class="rec-body">${details}</dl>` : ''}
    </li>`;
  }).join('')}</ul>`;

  return table + cards;
}

export function pager(total, page, perPage) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total ? (page - 1) * perPage + 1 : 0;
  const to = Math.min(total, page * perPage);
  const nums = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return `<nav class="pager" aria-label="Phân trang">
    <span class="pager-info">Hiển thị <strong>${from}–${to}</strong> / ${total} dòng</span>
    <div class="pager-btns">
      <button class="icon-btn sm" data-action="page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Trang trước">${icon('chevronLeft', 18)}</button>
      ${nums.map(n => n === '…' ? '<span class="pager-gap">…</span>' : `<button class="pager-num${n === page ? ' is-active' : ''}" data-action="page" data-page="${n}"${n === page ? ' aria-current="page"' : ''}>${n}</button>`).join('')}
      <button class="icon-btn sm" data-action="page" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Trang sau">${icon('chevronRight', 18)}</button>
    </div>
  </nav>`;
}

export function renderToolbar(ctx, { showUnit = true, placeholder = 'Tìm theo tên, đơn vị, tài khoản...' } = {}) {
  const { ui, units } = ctx;
  return `<div class="toolbar">
    <label class="search-field">${icon('search', 18)}<span class="sr-only">Tìm trong bảng</span>
      <input id="local-search" type="search" value="${esc(ui.search)}" placeholder="${esc(placeholder)}" autocomplete="off"></label>
    <div class="toolbar-group">
      ${showUnit ? `<label class="select-field"><span class="sr-only">Lọc theo đơn vị</span>${icon('filter', 16)}
        <select id="unit-filter"><option value="All">Tất cả đơn vị</option>${units.map(u => `<option value="${esc(u)}"${ui.unit === u ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select></label>` : ''}
      <label class="select-field small"><span class="sr-only">Số dòng mỗi trang</span>
        <select id="per-page">${[10, 25, 50, 100].map(n => `<option value="${n}"${ui.perPage === n ? ' selected' : ''}>${n} dòng</option>`).join('')}</select></label>
      <button class="btn btn-soft-blue" data-action="export" data-format="excel">${icon('download', 16)}<span>Excel</span></button>
      <button class="btn btn-soft-red" data-action="export" data-format="word">${icon('download', 16)}<span>Word</span></button>
    </div>
  </div>`;
}

function statusChips(rows, active) {
  const b = statusBreakdown(rows);
  const chip = (key, label, n) => `<button class="chip chip-${key}${active === key ? ' is-active' : ''}" data-action="status-filter" data-status="${key}" aria-pressed="${active === key}">${esc(label)}<span>${n}</span></button>`;
  return `<div class="chips" role="group" aria-label="Lọc theo trạng thái">${chip('all', 'Tất cả', rows.length)}${['success', 'info', 'warning', 'danger'].filter(k => b[k]).map(k => chip(k, STATUS_LABEL[k], b[k])).join('')}</div>`;
}

const pageHead = ({ tone, ic, eyebrow, title, desc, actions = '', extra = '' }) => `
  <header class="page-head" data-tone="${tone}">
    <div class="ph-main">
      <span class="ph-icon">${icon(ic, 28)}</span>
      <div class="ph-text"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${desc ? `<p class="ph-desc">${desc}</p>` : ''}</div>
      ${actions ? `<div class="ph-actions">${actions}</div>` : ''}
    </div>${extra}
  </header>`;

// ---------------- TỔNG QUAN ----------------
export function renderDashboard(ctx) {
  const { data, info } = ctx;
  const accountKeys = accountKeysOf(info);
  const accounts = accountKeys.flatMap(k => data[k] || []);
  const totalPeople = (data.tonghopchung || []).length;
  const devices = (data.thietbi || []).length + (data.thietbimat || []).length + (data.camera || []).length;
  const units = (data.donvitochuc || []).length || (data.madinhdanh || []).length;
  const alerts = collectAlerts(data, info);
  const insights = computeInsights(data, info, accountKeys);
  const b = statusBreakdown(accounts);
  const clusters = portalClusters(data, info).filter(c => c.items.length);
  const softwareCount = clusters.reduce((n, c) => n + c.items.length, 0);

  const kpi = (href, tone, ic, n, label, sub) => `
    <a class="kpi" href="${href}" data-tone="${tone}">
      <span class="kpi-ic">${icon(ic, 22)}</span>
      <strong class="kpi-num" data-count="${n}">${n}</strong>
      <span class="kpi-label">${esc(label)}</span>
      <span class="kpi-sub">${esc(sub)} ${icon('arrowRight', 14)}</span>
    </a>`;

  const stack = accounts.length ? ['success', 'info', 'warning', 'danger'].filter(k => b[k]).map(k => `<span class="stack-seg seg-${k}" style="--w:${(b[k] / accounts.length) * 100}%" title="${STATUS_LABEL[k]}: ${b[k]}"></span>`).join('') : '';

  const coverage = Object.keys(info).filter(k => !['tonghopchung', 'quanlyphanmem', 'cumdieuphoi'].includes(k)).map(k => {
    const count = (data[k] || []).length;
    const kind = info[k].kind;
    const base = ['unit', 'code'].includes(kind) ? 15 : Math.max(totalPeople, 1);
    const pct = Math.min(100, Math.round((count / base) * 100));
    const unitLabel = ['unit', 'code'].includes(kind) ? 'đơn vị' : ['device', 'camera'].includes(kind) ? 'thiết bị' : 'tài khoản';
    return `<a class="cov" href="#/m/${k}" data-tone="${info[k].tone}">
      <span class="cov-ic">${icon(info[k].icon, 18)}</span>
      <span class="cov-text"><strong>${esc(info[k].title)}</strong><small>${count} ${unitLabel}</small></span>
      <span class="cov-pct">${pct}%</span>
      <span class="bar"><span class="bar-fill" style="--w:${pct}%"></span></span>
    </a>`;
  }).join('');

  return `<section class="view view-dashboard">
    <a class="portal-teaser" href="#/portal" data-tone="blue">
      <span class="portal-teaser-ic">${icon('compass', 20)}</span>
      <span class="portal-teaser-text"><strong>Cổng điều phối</strong><small>${clusters.length} cụm · ${softwareCount} phần mềm — xem theo từng cụm nghiệp vụ</small></span>
      ${icon('arrowRight', 16, 'portal-teaser-go')}
    </a>

    <div class="kpi-grid">
      ${kpi('#/m/tonghopchung', 'blue', 'users', totalPeople, 'Nhân sự hiện tại', 'Hồ sơ gốc')}
      ${kpi('#/accounts', 'yellow', 'key', accounts.length, 'Tài khoản phần mềm', `${accountKeys.length} phần mềm`)}
      ${kpi('#/m/thietbi', 'red', 'monitor', devices, 'Tài sản thiết bị', 'Máy tính, camera')}
      ${kpi('#/m/donvitochuc', 'blue', 'building', units, 'Phòng ban & đơn vị', 'Cơ cấu tổ chức')}
    </div>

    <div class="grid-main">
      <section class="card insight-card">
        <div class="card-head"><h2>${icon('sparkles', 20)} Trợ lý thông minh</h2><span class="pill">${insights.length} gợi ý</span></div>
        ${insights.length ? `<ul class="insights">${insights.map((x, i) => `
          <li><a class="insight lvl-${x.level}" href="${x.route}" style="--i:${i}">
            <span class="insight-ic">${icon(x.icon, 18)}</span>
            <span class="insight-text"><strong>${esc(x.title)}</strong><small>${esc(x.detail)}</small></span>
            ${icon('chevronRight', 18, 'insight-go')}
          </a></li>`).join('')}</ul>`
          : `<div class="empty compact">${icon('checkCircle', 40)}<p>Dữ liệu sạch, không phát hiện vấn đề.</p></div>`}
      </section>

      <section class="card alert-card">
        <div class="card-head"><h2>${icon('alert', 20)} Cảnh báo tài khoản</h2><span class="pill pill-red">${alerts.length}</span></div>
        ${alerts.length ? `<ul class="alerts">${alerts.slice(0, 30).map(a => `
          <li><a class="alert-item lvl-${a.type}" href="#/m/${a.moduleKey}">
            <span class="alert-dot"></span>
            <span class="alert-text"><strong>${esc(a.user)}</strong><small>${esc(a.moduleName)}${a.account ? ' · ' + esc(a.account) : ''}</small></span>
            <span class="badge badge-${a.type}">${esc(a.status)}</span>
          </a></li>`).join('')}</ul>`
          : `<div class="empty compact">${icon('checkCircle', 40)}<p>Không có tài khoản nào cần xử lý.</p></div>`}
      </section>
    </div>

    <section class="card">
      <div class="card-head"><h2>${icon('chart', 20)} Tình trạng triển khai</h2>
        ${accounts.length ? `<div class="legend">${['success', 'info', 'warning', 'danger'].map(k => `<span class="lg lg-${k}">${STATUS_LABEL[k]} · ${b[k]}</span>`).join('')}</div>` : ''}
      </div>
      ${stack ? `<div class="stack" role="img" aria-label="Phân bố trạng thái tài khoản">${stack}</div>` : ''}
      <div class="cov-grid">${coverage}</div>
    </section>
  </section>`;
}

// ---------------- CỔNG ĐIỀU PHỐI ----------------
const healthTone = (h) => (h === null ? 'slate' : h >= 80 ? 'blue' : h >= 50 ? 'yellow' : 'red');

// Chỉ cho phép đường dẫn http(s) để nút "Truy cập" không mở liên kết lạ
const safeUrl = (u) => {
  try { const x = new URL(u); return ['http:', 'https:'].includes(x.protocol) ? x.href : ''; } catch { return ''; }
};

// Thẻ phần mềm: logo, tên và nút truy cập tới đường dẫn đã cấu hình (chưa có thì dẫn tới trang phần mềm để thêm)
const appCard = (s, i, links) => {
  const url = safeUrl(links[s.key]);
  return `
  <div class="app-card" data-tone="${esc(s.tone)}" style="--i:${Math.min(i, 12)}">
    <span class="app-ic">${icon(s.icon, 26)}</span>
    <strong class="app-name">${esc(s.name)}</strong>
    ${url
      ? `<a class="btn btn-primary app-open" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon('external', 16)} Truy cập</a>`
      : `<a class="btn btn-outline app-open" href="#/m/${esc(s.key)}">${icon('link', 16)} Thêm đường dẫn</a>`}
  </div>`;
};

const addCard = () => `
  <a class="app-card app-add" href="#/m/quanlyphanmem" data-tone="slate">
    <div class="app-top"><span class="app-ic">${icon('plus', 26)}</span></div>
    <div class="app-body"><strong>Thêm phần mềm</strong><p>Tạo phần mềm mới và chọn cụm cho phần mềm này.</p></div>
  </a>`;

const clusterSection = (c, i, links) => `
  <section class="cluster-section" data-tone="${esc(c.tone)}" style="--i:${Math.min(i, 12)}" aria-labelledby="cl-${esc(c.key)}">
    <header class="cluster-bar">
      <span class="cluster-ic">${icon(c.icon, 18)}</span>
      <div class="cluster-title"><h3 id="cl-${esc(c.key)}">${esc(c.title)}</h3><p>${esc(c.desc)}</p></div>
      <div class="cluster-stats">
        <span class="meta-pill">${c.items.length} ứng dụng</span>
        ${c.health === null ? '' : `<span class="meta-pill health-${healthTone(c.health)}">Ổn định ${c.health}%</span>`}
        ${c.issueCount ? `<span class="meta-pill meta-warn">${c.issueCount} cần xử lý</span>` : ''}
      </div>
    </header>
    <div class="app-grid">${c.items.length ? c.items.map((s, n) => appCard(s, n, links)).join('') : addCard()}</div>
  </section>`;

// Lưới ứng dụng theo cụm — vẽ lại khi tìm kiếm hoặc chọn cụm (nằm trong #table-region)
export function renderPortalGrid(ctx) {
  const { data, info, ui, links } = ctx;
  const terms = searchTerms(ui.search || '');
  const showAll = ui.cluster === 'All';
  // Cụm do người dùng tạo luôn hiện (kể cả chưa có phần mềm, để bấm "Thêm phần mềm"); riêng "Chưa phân loại" chỉ hiện khi có phần mềm
  const clusters = portalClusters(data, info)
    .filter(c => (showAll ? c.key !== PORTAL_OTHER.key || c.items.length > 0 : c.key === ui.cluster))
    .map(c => ({ ...c, items: c.items.filter(s => !terms.length || matchesTerms(s.name, terms)) }))
    .filter(c => c.items.length || !terms.length);
  if (!clusters.length) {
    return !terms.length && showAll
      ? `<div class="empty">${icon('compass', 40)}<p>Chưa có cụm nào. Tạo cụm trong “Cụm Cổng điều phối” rồi chọn cụm cho từng phần mềm.</p><a class="btn btn-primary" href="#/m/cumdieuphoi">${icon('plus', 18)} Tạo cụm</a></div>`
      : `<div class="empty">${icon('search', 40)}<p>Không có ứng dụng phù hợp với bộ lọc.</p></div>`;
  }
  return `<div class="cluster-list">${clusters.map((c, n) => clusterSection(c, n, links)).join('')}</div>`;
}

export function renderPortal(ctx) {
  const { data, info, ui } = ctx;
  const clusters = portalClusters(data, info);
  const software = clusters.reduce((n, c) => n + c.items.length, 0);

  const options = [
    ['All', 'Tất cả cụm', software],
    ...clusters.filter(c => c.key !== PORTAL_OTHER.key || c.items.length).map(c => [c.key, c.title, c.items.length])
  ].map(([key, title, n]) => `<option value="${esc(key)}"${ui.cluster === key ? ' selected' : ''}>${esc(title)} (${n})</option>`).join('');

  return `<section class="view view-portal">
    <div class="portal-bar">
      <label class="portal-search">${icon('search', 18)}<span class="sr-only">Tìm phần mềm</span>
        <input id="local-search" type="search" value="${esc(ui.search)}" placeholder="Tìm phần mềm..." autocomplete="off"></label>
      <label class="select-field portal-filter">${icon('filter', 16)}<span class="sr-only">Lọc theo cụm</span>
        <select id="cluster-filter">${options}</select></label>
    </div>

    <div id="table-region" aria-live="polite"></div>
  </section>`;
}

// ---------------- TRANG MODULE ----------------
export function renderModuleView(ctx, key) {
  const { data, info, links, notes } = ctx;
  const mi = info[key];
  const kind = mi.kind;
  const rows = data[key] || [];
  const link = links[key];
  let note = notes[key];
  if (!note && mi.isDynamic) note = (data.quanlyphanmem || []).find(p => p.col1 === key)?.notes || '';

  const linkHtml = kind === 'account'
    ? (link ? `<a class="link-pill" href="${esc(link)}" target="_blank" rel="noopener">${icon('external', 14)} ${esc(link.replace(/^https?:\/\//, ''))}</a>` : '<span class="link-pill muted">' + icon('link', 14) + ' Chưa cấu hình đường dẫn</span>')
    : '';

  const actions = `
    ${kind !== 'appconfig' ? `<button class="btn btn-soft-yellow" data-action="edit-note">${icon('note', 16)}<span>Ghi chú</span></button>` : ''}
    ${kind === 'account' ? `<button class="btn btn-outline" data-action="edit-link">${icon('link', 16)}<span>Sửa link</span></button>` : ''}
    ${kind === 'person' ? `<button class="btn btn-outline" data-action="people-template" title="Tải file Excel mẫu (kèm các hồ sơ hiện có)">${icon('download', 16)}<span>File mẫu</span></button>
    <label class="btn btn-outline" title="Nhập hoặc cập nhật nhiều hồ sơ từ file Excel">${icon('upload', 16)}<span>Nhập Excel</span><input type="file" accept=".xlsx,.xls,.csv" class="sr-only" data-import-people></label>` : ''}
    ${kind === 'unit' ? `<button class="btn btn-outline" data-action="unit-template" title="Tải file Excel mẫu (kèm các đơn vị hiện có)">${icon('download', 16)}<span>File mẫu</span></button>
    <label class="btn btn-outline" title="Nhập hoặc cập nhật nhiều đơn vị từ file Excel">${icon('upload', 16)}<span>Nhập Excel</span><input type="file" accept=".xlsx,.xls,.csv" class="sr-only" data-import-units></label>` : ''}
    ${kind !== 'account' ? `<button class="btn btn-primary" data-action="add">${icon('plus', 18)}<span>Thêm mới</span></button>` : ''}`;

  const noteBox = note ? `<div class="note-box">${icon('info', 20)}<div><p class="note-title">Thông tin / Hướng dẫn</p><p class="note-text">${esc(note)}</p></div></div>` : '';

  return `<section class="view view-module">
    ${pageHead({ tone: mi.tone, ic: mi.icon, eyebrow: GROUP_LABEL[mi.group] || 'Module', title: mi.title, desc: `${esc(KIND_DESC[kind] || '')} ${linkHtml}`, actions, extra: noteBox })}
    <section class="card table-card">
      ${hasStatus(kind) && rows.length ? statusChips(rows, ctx.ui.status) : ''}
      ${renderToolbar(ctx, { showUnit: hasUnitFilter(kind) })}
      <div id="table-region" aria-live="polite"></div>
    </section>
    ${['appconfig', 'portalcluster'].includes(kind) ? '' : renderDocs(ctx, key)}
  </section>`;
}

export function renderModuleTable(ctx, key, filtered) {
  const { ui, info } = ctx;
  const start = (ui.page - 1) * ui.perPage;
  const pageRows = filtered.slice(start, start + ui.perPage);
  const emptyCta = info[key].kind !== 'account' && !(ui.search || ui.unit !== 'All' || ui.status !== 'all')
    ? `<button class="btn btn-primary" data-action="add">${icon('plus', 18)} Thêm bản ghi đầu tiên</button>` : '';
  return dataTable({
    columns: columnsFor(info[key].kind, ctx.data), rows: pageRows, offset: start, editable: true,
    rowAttr: r => `data-action="detail" data-id="${esc(r.id)}" tabindex="0" role="button" aria-label="Xem chi tiết ${esc(r.name || r.col1 || '')}"`,
    emptyText: ui.search || ui.unit !== 'All' || ui.status !== 'all' ? 'Không tìm thấy kết quả phù hợp với bộ lọc.' : 'Chưa có dữ liệu.',
    emptyCta
  }) + pager(filtered.length, ui.page, ui.perPage);
}

function renderDocs(ctx, key) {
  const { docs, info } = ctx;
  const kind = info[key].kind;
  const d = docs[key] || {};
  const titles = ['device', 'camera'].includes(kind) ? ['Hồ sơ chứng từ / Bảo hành', 'Biên bản bàn giao / Kiểm kê']
    : ['unit', 'code'].includes(kind) ? ['Văn bản pháp lý / Quyết định', 'Quy chế tổ chức']
      : kind === 'person' ? ['Quyết định / Bằng cấp', 'Biểu mẫu / Giấy tờ khác']
        : ['Tài liệu quy định Thành phố', 'Tài liệu nội bộ Xã'];

  const box = (type, title, tone, ic) => {
    const files = d[type] || [];
    return `<div class="doc-box" data-tone="${tone}">
      <div class="doc-head"><h3>${icon(ic, 18)} ${esc(title)}</h3>
        <label class="btn btn-sm btn-outline">${icon('upload', 16)} Tải lên<input type="file" multiple class="sr-only" data-upload="${type}"></label>
      </div>
      ${files.length ? `<ul class="doc-list">${files.map(f => `
        <li class="doc-item">
          <button class="doc-open" data-action="preview-doc" data-doc-id="${esc(f.id)}" data-doc-type="${type}">
            <span class="doc-ic">${icon(fileIconName(f.name), 16)}</span>
            <span class="doc-text"><strong>${esc(f.name)}</strong><small>${esc(f.size)} · ${esc(f.date)}</small></span>
          </button>
          <button class="icon-btn sm" data-action="download-doc" data-doc-id="${esc(f.id)}" data-doc-type="${type}" aria-label="Tải xuống ${esc(f.name)}">${icon('download', 16)}</button>
          <button class="icon-btn sm danger" data-action="delete-doc" data-doc-id="${esc(f.id)}" data-doc-type="${type}" aria-label="Xóa ${esc(f.name)}">${icon('trash', 16)}</button>
        </li>`).join('')}</ul>`
        : '<div class="doc-empty">Kéo thả tệp vào đây hoặc bấm “Tải lên”</div>'}
    </div>`;
  };

  return `<section class="card">
    <div class="card-head"><h2>${icon('folder', 20)} Kho tài liệu & hướng dẫn</h2></div>
    <div class="doc-grid">${box('city', titles[0], 'blue', 'landmark')}${box('commune', titles[1], 'yellow', 'shieldCheck')}</div>
    <p class="field-hint">${icon('info', 14)} Tệp đính kèm được lưu trong trình duyệt của thiết bị đã tải lên (tối đa 25 MB/tệp).</p>
  </section>`;
}

// ---------------- TỔNG HỢP TÀI KHOẢN (ma trận phân quyền) ----------------
export function userSummaryColumns(info, forExport = false) {
  const keys = accountKeysOf(info);
  const base = forExport
    ? [{ h: 'Họ và tên', v: r => r.name }, { h: 'Chức vụ', v: r => r.role }, { h: 'Đơn vị', v: r => r.unit }]
    : [{ h: 'Nhân sự & đơn vị', v: r => r.name, primary: true, html: r => `<strong class="cell-title">${esc(r.name)}</strong><small class="cell-sub">${esc([r.role, r.unit].filter(Boolean).join(' · '))}</small>` },
      { h: 'Số PM', v: r => String(r.count), align: 'center', html: r => `<span class="count-pill">${r.count}</span>` }];
  return base.concat(keys.map(k => ({
    h: info[k].title,
    hHtml: `<span class="mx-head" data-tone="${info[k].tone}">${icon(info[k].icon, 16)}<span>${esc(info[k].title)}</span></span>`,
    v: r => (r.modules[k] ? 'X' : ''),
    align: 'center',
    html: r => (r.modules[k] ? `<span class="mx-yes" title="Đã cấp">${icon('check', 16)}</span>` : '<span class="mx-no" aria-label="Chưa cấp">·</span>')
  })));
}

export function renderUserSummary(ctx) {
  return `<section class="view">
    ${pageHead({ tone: 'blue', ic: 'userCheck', eyebrow: 'Hệ thống', title: 'Tổng hợp phân quyền phần mềm', desc: 'Nhân sự được sắp xếp thông minh theo đơn vị và chức vụ. Bấm vào một người để xem chi tiết.' })}
    <section class="card table-card matrix">
      ${renderToolbar(ctx, { placeholder: 'Tìm theo tên, chức vụ, đơn vị...' })}
      <div id="table-region" aria-live="polite"></div>
    </section>
  </section>`;
}

export function renderUserSummaryTable(ctx, filtered) {
  const { ui, info } = ctx;
  const start = (ui.page - 1) * ui.perPage;
  return dataTable({
    columns: userSummaryColumns(info), rows: filtered.slice(start, start + ui.perPage), offset: start,
    rowAttr: r => `data-action="person-detail" data-id="${esc(r.id)}" tabindex="0" role="button"`,
    emptyText: 'Chưa có tài khoản phần mềm nào.'
  }) + pager(filtered.length, ui.page, ui.perPage);
}

// ---------------- TỔNG HỢP PHẦN MỀM ----------------
export function softwareColumns() {
  return [
    { h: 'Tên phần mềm', v: r => r.name, primary: true, html: r => `<span class="sw-name"><span class="icon-chip tone-${esc(r.tone)}">${icon(r.icon, 16)}</span><strong>${esc(r.name)}</strong></span>` },
    { h: 'Số lượng tài khoản', v: r => String(r.accountCount), align: 'center', html: r => `<span class="count-pill">${r.accountCount}</span>` },
    { h: 'Cần xử lý', v: r => String(r.issueCount), align: 'center', html: r => r.issueCount ? `<span class="badge badge-warning">${r.issueCount}</span>` : '<span class="muted">0</span>' },
    { h: 'Phân loại', v: r => (r.isDynamic ? 'Mở rộng' : 'Mặc định'), html: r => `<span class="tag tone-${r.isDynamic ? 'yellow' : 'slate'}">${r.isDynamic ? 'Mở rộng' : 'Mặc định'}</span>` },
    { h: 'Ghi chú', v: r => r.notes, html: r => r.notes ? `<span class="cell-note">${esc(r.notes)}</span>` : '<span class="muted">—</span>' }
  ];
}

export function renderSoftwareSummary(ctx) {
  return `<section class="view">
    ${pageHead({ tone: 'yellow', ic: 'layers', eyebrow: 'Hệ thống', title: 'Tổng hợp phần mềm', desc: 'Số lượng tài khoản theo từng phần mềm, sắp xếp từ nhiều đến ít. Bấm để mở phần mềm.' })}
    <section class="card table-card">
      ${renderToolbar(ctx, { showUnit: false, placeholder: 'Tìm tên phần mềm...' })}
      <div id="table-region" aria-live="polite"></div>
    </section>
  </section>`;
}

export function renderSoftwareTable(ctx, filtered) {
  const { ui } = ctx;
  const start = (ui.page - 1) * ui.perPage;
  return dataTable({
    columns: softwareColumns(), rows: filtered.slice(start, start + ui.perPage), offset: start,
    rowAttr: r => `data-action="go" data-href="#/m/${esc(r.key)}" tabindex="0" role="link"`
  }) + pager(filtered.length, ui.page, ui.perPage);
}

// ---------------- CHI TIẾT BẢN GHI ----------------
export function renderDetail(ctx, key, row) {
  const { info, data } = ctx;
  const cols = columnsFor(info[key].kind, data);
  const items = cols.map(c => ({ h: c.h, v: c.v(row) })).filter(x => x.v);
  const accountKeys = accountKeysOf(info);
  const same = (a) => a.name && (a.name || '').trim().toLowerCase() === (row.name || '').trim().toLowerCase();
  const linked = ['person', 'account'].includes(info[key].kind)
    ? accountKeys.filter(k => k !== key && (data[k] || []).some(same)) : [];
  const master = info[key].kind === 'account' ? (data.tonghopchung || []).find(same) : null;

  return `<div class="detail">
    <dl class="detail-list">${items.map(x => `<div class="detail-row"><dt>${esc(x.h)}</dt><dd>${x.h.includes('Trạng thái') || x.h === 'Tình trạng' ? `<span class="badge badge-${row.statusType || statusTypeOf(row.status)}">${esc(x.v)}</span>` : esc(x.v)}</dd></div>`).join('')}</dl>
    ${master ? `<a class="callout callout-blue" href="#/m/tonghopchung" data-action="close-modal">${icon('badge', 20)}<div><strong>Có hồ sơ gốc</strong><p>${esc(master.name)} · ${esc(master.unit || '')} — bấm để mở Thông tin chung.</p></div></a>` : ''}
    ${linked.length ? `<div class="detail-linked"><p class="note-title">Tài khoản ở phần mềm khác</p><div class="tag-row">${linked.map(k => `<a class="tag tone-${info[k].tone}" href="#/m/${k}" data-action="close-modal">${icon(info[k].icon, 14)} ${esc(info[k].title)}</a>`).join('')}</div></div>` : ''}
    <div class="modal-foot inline">
      <button class="btn btn-soft-red" data-action="delete" data-id="${esc(row.id)}">${icon('trash', 16)} Xóa</button>
      <button class="btn btn-primary" data-action="edit" data-id="${esc(row.id)}">${icon('edit', 16)} Chỉnh sửa</button></div>
  </div>`;
}
