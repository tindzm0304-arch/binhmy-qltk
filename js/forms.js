// ==========================================
// BIỂU MẪU THÊM / SỬA - mô tả bằng dữ liệu, dựng HTML tự động
// ==========================================
import { STATUS_OPTIONS, ICON_CHOICES, TONE_CHOICES, CLUSTER_ICON_CHOICES, PORTAL_OTHER } from './config.js';
import { esc, removeAccents, statusTypeOf } from './utils.js';
import { icon, isCustomIcon } from './icons.js';

const F = (k, label, extra = {}) => ({ k, label, type: 'text', ...extra });
const YES_NO = [['Không', 'Không'], ['Có', 'Có']];
const name = (label = 'Họ và tên', ph = 'Ví dụ: Nguyễn Văn A') => F('name', label, { req: true, ph, smart: true, span: 2, autocomplete: 'off' });
const gender = F('gender', 'Giới tính', { type: 'select', opts: [['Nam', 'Nam'], ['Nữ', 'Nữ']] });
const role = (req = true) => F('role', 'Chức vụ', { req, ph: 'Ví dụ: Chuyên viên' });
const unit = (label = 'Đơn vị', req = true) => F('unit', label, { type: 'unit', req, ph: 'Chọn hoặc nhập tên đơn vị...' });
const linkedUnit = (label = 'Đơn vị tổ chức') => F('unit', label, { type: 'select', req: true, opts: 'units', placeholder: 'Chọn đơn vị tổ chức...' });
const phone = F('phone', 'Số điện thoại', { type: 'tel', cls: 'mono', inputmode: 'tel', ph: '09xx xxx xxx' });
const email = (label = 'Email cá nhân') => F('email', label, { type: 'email', ph: 'ten@tphcm.gov.vn' });
const cccd = F('cccd', 'Số CCCD', { cls: 'mono', inputmode: 'numeric', maxlength: 12, ph: '12 chữ số', smartCccd: true });
const cccdDate = F('cccdDate', 'Ngày cấp CCCD', { type: 'date' });
const notes = (ph = 'Các thông tin lưu ý khác (nếu có)...') => F('notes', 'Ghi chú thêm', { type: 'textarea', span: 2, ph });
const status = (kind, label = 'Trạng thái') => F('status', label, { type: 'select', opts: STATUS_OPTIONS[kind] });

const SCHEMAS = {
  person: [
    { fields: [name(), gender, F('dob', 'Ngày sinh', { type: 'date' }), F('address', 'Địa chỉ thường trú / tạm trú', { span: 2, ph: 'Số nhà, đường, ấp/khu phố...' })] },
    { title: 'Công tác', fields: [role(), unit()] },
    { title: 'Giấy tờ & liên hệ', fields: [cccd, cccdDate, phone, email(), notes()] }
  ],
  account: [
    { fields: [{ ...name('Họ và tên', 'Gõ họ tên để tìm trong Thông tin chung...'), pick: true, hint: 'Gõ họ tên để chọn người có sẵn trong Thông tin chung, có thể chọn nhiều người để tạo tài khoản cho từng người. Giới tính, chức vụ, đơn vị, số liên hệ lấy theo hồ sơ gốc.' }, gender, role(), linkedUnit()] },
    { title: 'Tài khoản', fields: [F('account', 'Tên tài khoản phần mềm', { req: true, cls: 'mono', ph: 'vd: nguyen.van.a', autocomplete: 'off' }), F('password', 'Mật khẩu', { type: 'password', autocomplete: 'new-password' }), status('account', 'Trạng thái tài khoản')] },
    { title: 'Liên hệ & ghi chú', fields: [phone, email(), cccd, cccdDate, notes()] }
  ],
  device: [
    { fields: [{ ...name('Họ và tên người sử dụng', 'Gõ họ tên để tìm trong Thông tin chung...'), pick: true, hint: 'Gõ họ tên để chọn người có sẵn trong Thông tin chung, có thể chọn nhiều người để tạo thiết bị cho từng người. Chức vụ, đơn vị lấy theo hồ sơ gốc.' }, role(false), unit()] },
    { title: 'Thông số thiết bị chính', fields: [F('brand', 'Hiệu máy tính', { ph: 'Dell, HP, Lenovo...' }), F('cpu', 'Cấu hình (CPU)', { ph: 'Core i5-13500...' }), F('ram', 'Dung lượng RAM', { ph: '8GB' }), F('storage', 'Ổ đĩa lưu trữ', { ph: '256GB SSD' }), F('isLaptop', 'Laptop', { type: 'select', opts: YES_NO })] },
    { title: 'Thiết bị ngoại vi', fields: [F('printer', 'Máy in', { ph: 'Để trống nếu không có, hoặc ghi tên máy in' }), F('scanner', 'Máy scan', { type: 'select', opts: YES_NO })] },
    { title: 'Tình trạng', fields: [status('device', 'Tình trạng chung thiết bị'), notes('Bảo hành, ngày bàn giao, thông số khác...')] }
  ],
  camera: [
    { fields: [F('name', 'Vị trí lắp đặt / Tên camera', { req: true, span: 2, ph: 'Cổng chính UBND, Hành lang tầng 1...' }), unit('Đơn vị quản lý')] },
    { title: 'Thông số kỹ thuật & mạng', fields: [F('brand', 'Thương hiệu / Hãng', { ph: 'Hikvision, Dahua, KBVision...' }), F('col1', 'Độ phân giải', { ph: '2MP (1080p), 4MP (2K)...' }), F('col2', 'Địa chỉ IP / Tên miền', { cls: 'mono', ph: '192.168.1.100' }), F('col3', 'Tài khoản / Mật khẩu truy cập', { type: 'password', cls: 'mono', ph: 'admin / ******', autocomplete: 'off' })] },
    { fields: [status('camera', 'Tình trạng hoạt động'), notes('Góc quay, lưu trữ, bảo hành...')] }
  ],
  unit: [
    { fields: [F('name', 'Tên đơn vị tổ chức', { req: true, span: 2, ph: 'Ví dụ: Phòng Văn hóa - Xã hội' })] },
    { title: 'Liên hệ', fields: [F('col3', 'Người đứng đầu', { ph: 'Họ và tên trưởng đơn vị' }), phone, email('Email đơn vị'), status('unit'), F('address', 'Địa chỉ / Vị trí', { span: 2, ph: 'Tầng 2, UBND Xã...' }), notes('Chức năng, nhiệm vụ...')] }
  ],
  code: [
    { fields: [F('col1', 'Đơn vị tổ chức liên kết', { type: 'select', req: true, span: 2, opts: 'units' }), F('col2', 'Mã định danh', { req: true, cls: 'mono', ph: 'H29.241' }), F('col3', 'Cấp hành chính', { ph: 'Cấp 3 (Xã)' }), F('col6', 'Số điện thoại cơ quan', { type: 'tel', cls: 'mono' }), F('col4', 'Email đại diện', { type: 'email' }), F('col5', 'Địa chỉ', { span: 2 })] }
  ],
  appconfig: [
    { fields: [F('name', 'Tên phần mềm / tiện ích', { req: true, ph: 'Ví dụ: Quản lý Nhân sự', autoKey: true }), F('col1', 'Mã hệ thống (URL key)', { req: true, cls: 'mono', ph: 'Tự động tạo, vd: quanlynhansu', keyField: true }), F('link', 'Đường dẫn truy cập (URL)', { type: 'url', reqAdd: true, span: 2, cls: 'mono', ph: 'https://...' }), F('col2', 'Biểu tượng', { type: 'icon', opts: ICON_CHOICES }), F('col3', 'Màu chủ đạo', { type: 'select', opts: TONE_CHOICES }), F('category', 'Cụm trên Cổng điều phối', { type: 'select', opts: 'clusters' }), notes('Mô tả / hướng dẫn ngắn (hiển thị ở đầu trang phần mềm)...')] }
  ],
  portalcluster: [
    { fields: [F('name', 'Tên cụm', { req: true, span: 2, ph: 'Ví dụ: Điều hành & Hành chính', autoKey: true }), F('col1', 'Mã cụm (khóa)', { req: true, cls: 'mono', ph: 'Tự động tạo, vd: dieuhanh', keyField: true }), F('col3', 'Màu chủ đạo', { type: 'select', opts: TONE_CHOICES }), F('col2', 'Biểu tượng', { type: 'icon', opts: CLUSTER_ICON_CHOICES }), F('notes', 'Mô tả hiển thị trên Cổng điều phối', { type: 'textarea', span: 2, ph: 'Ví dụ: Văn bản, điều hành và quản lý công việc hằng ngày' })] }
  ]
};

export const schemaFor = (kind) => SCHEMAS[kind] || SCHEMAS.account;

const fieldValue = (f, record) => {
  let v = record[f.k];
  if (f.k === 'printer' && v === 'Không') v = '';
  if (v === undefined || v === null || v === '') {
    // Giá trị mặc định: lựa chọn đầu tiên; ô có placeholder thì để trống
    if (f.type === 'select') return f.placeholder ? '' : (f.opts[0]?.[0] ?? '');
    return '';
  }
  return v;
};

// Biểu tượng: chọn sẵn hoặc tải ảnh từ máy (ảnh tải lên nằm trong danh sách chọn và được xem trước)
const iconPicker = (f, val, id, cls, req) => {
  const current = val || 'globe';
  const opts = isCustomIcon(current) ? [...f.opts, [current, 'Ảnh tải lên']] : f.opts;
  return `<div class="icon-picker" data-icon-picker>
      <span class="icon-preview" data-icon-preview>${icon(current, 24)}</span>
      <select id="${id}" name="${f.k}" class="${cls}"${req}>${opts.map(([v, l]) => `<option value="${esc(v)}"${String(v) === current ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <label class="btn btn-sm btn-outline">${icon('upload', 16)} Tải ảnh lên<input type="file" accept="image/*" class="sr-only" data-icon-upload></label>
    </div>`;
};

function renderField(f, record, ctx) {
  const id = `f-${f.k}`;
  const val = fieldValue(f, record);
  // reqAdd: bắt buộc khi thêm mới, còn khi sửa thì không
  const isReq = f.req || (f.reqAdd && ctx.mode === 'add');
  const req = isReq ? ' required aria-required="true"' : '';
  // Ô họ tên có gợi ý chọn nhiều người (chỉ khi thêm mới): khung gợi ý nằm ngay dưới ô nhập
  const pick = f.pick && ctx.mode === 'add';
  const attrs = [
    f.ph ? `placeholder="${esc(f.ph)}"` : '', f.inputmode ? `inputmode="${f.inputmode}"` : '',
    f.maxlength ? `maxlength="${f.maxlength}"` : '', f.autocomplete ? `autocomplete="${f.autocomplete}"` : '',
    f.smart ? 'data-smart-name' : '', f.smartCccd ? 'data-smart-cccd' : '', f.autoKey && ctx.mode === 'add' ? 'data-auto-key' : '',
    f.keyField ? 'data-key-field' : '', f.keyField && ctx.mode === 'edit' ? 'readonly' : '', pick ? 'data-pick-name' : ''
  ].filter(Boolean).join(' ');
  const cls = `input ${f.cls || ''}`;
  let control;
  if (f.type === 'select') {
    const placeholder = f.placeholder ? `<option value=""${val === '' ? ' selected' : ''}>${esc(f.placeholder)}</option>` : '';
    control = `<select id="${id}" name="${f.k}" class="${cls}"${req}>${placeholder}${f.opts.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  } else if (f.type === 'icon') {
    control = iconPicker(f, val, id, cls, req);
  } else if (f.type === 'textarea') {
    control = `<textarea id="${id}" name="${f.k}" class="${cls}" rows="3" ${attrs}${req}>${esc(val)}</textarea>`;
  } else if (f.type === 'password') {
    control = `<div class="input-wrap"><input id="${id}" name="${f.k}" type="password" class="${cls}" value="${esc(val)}" ${attrs}${req}><button type="button" class="input-btn" data-action="toggle-pw" aria-label="Hiện/ẩn mật khẩu">${icon('eye', 18)}</button></div>`;
  } else {
    const type = f.type === 'unit' ? 'text' : f.type;
    const list = f.type === 'unit' ? ' list="unit-options"' : '';
    control = `<input id="${id}" name="${f.k}" type="${type}" class="${cls}" value="${esc(val)}"${list} ${attrs}${req}>`;
  }
  const hint = f.smartCccd ? '<p class="field-hint" data-cccd-hint></p>' : f.keyField ? `<p class="field-hint">${ctx.mode === 'edit' ? 'Không đổi được mã sau khi tạo (dữ liệu đang gắn với mã này).' : 'Chỉ gồm chữ thường không dấu và số.'}</p>` : f.hint ? `<p class="field-hint">${esc(f.hint)}</p>` : '';
  const picker = pick ? '<div class="smart-picker" data-smart-picker hidden></div>' : '';
  return `<div class="field${f.span === 2 ? ' span-2' : ''}">
    <label for="${id}">${esc(f.label)}${isReq ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
    ${control}${hint}${picker}
  </div>`;
}

export function renderForm({ kind, moduleKey, record = {}, mode, units, unitRecords = [], suggestTargets, software = [], clusters = [] }) {
  const ctx = { kind, mode };
  const unitOpts = unitRecords.map(u => u.name).filter(Boolean).map(n => [n, n]);
  // Ô chọn có opts: 'clusters' lấy các cụm đã tạo; opts: 'units' lấy danh sách Đơn vị tổ chức đã tạo
  const resolve = (f) => {
    if (f.opts === 'clusters') return { ...f, opts: [['', PORTAL_OTHER.title], ...clusters.map(c => [c.key, c.title])] };
    if (f.opts !== 'units') return f;
    // Giữ đơn vị cũ của bản ghi nếu chưa có trong danh sách, để sửa không làm mất liên kết
    const current = record[f.k];
    const missing = current && !unitOpts.some(([v]) => v === current) ? [[current, `${current} (chưa có trong danh sách)`]] : [];
    return { ...f, opts: [...unitOpts, ...missing] };
  };
  const sections = schemaFor(kind);
  const banner = kind === 'device' && moduleKey === 'thietbimat'
    ? `<div class="callout callout-danger">${icon('shield', 20)}<div><strong>Chế độ quản lý Thiết bị mật</strong><p>Tuân thủ nghiêm ngặt quy định không kết nối mạng ngoài.</p></div></div>`
    : kind === 'person'
      ? `<div class="callout callout-blue">${icon('badge', 20)}<div><strong>Hồ sơ gốc nhân sự</strong><p>Dữ liệu tại đây là bản gốc; khi sửa, thông tin sẽ tự đồng bộ sang các tài khoản phần mềm của cùng người.</p></div></div>`
      : ['code', 'account'].includes(kind) && !unitOpts.length
        ? `<div class="callout callout-danger">${icon('alert', 20)}<div><strong>Chưa có đơn vị tổ chức</strong><p>Hãy tạo đơn vị tổ chức trong mục "Đơn vị tổ chức" trước, sau đó quay lại để liên kết.</p></div></div>`
        : '';

  const body = sections.map((s, i) => `
    <fieldset class="form-section">
      ${s.title ? `<legend>${esc(s.title)}</legend>` : ''}
      <div class="form-grid">${s.fields.map(f => renderField(resolve(f), record, ctx)).join('')}</div>
      ${i === 0 ? '<div class="smart-box" data-smart-box hidden></div>' : ''}
    </fieldset>`).join('');

  const suggest = mode === 'add' && suggestTargets?.length ? `
    <fieldset class="form-section">
      <legend>${icon('sparkles', 16)} Tạo tài khoản đồng thời</legend>
      <p class="field-hint">Chọn các phần mềm cần cấp tài khoản cùng lúc cho người này.</p>
      <div class="check-grid">${suggestTargets.map(t => `
        <label class="check-card"><input type="checkbox" name="suggest" value="${esc(t.key)}"><span class="check-box">${icon('check', 14)}</span><span>${esc(t.title)}</span></label>`).join('')}
      </div>
    </fieldset>` : '';

  // Khi sửa hồ sơ gốc: tích các phần mềm người này đang có tài khoản (bỏ tích = gỡ tài khoản ở phần mềm đó)
  const linked = mode === 'edit' && software.length ? `
    <fieldset class="form-section">
      <legend>${icon('layers', 16)} Phần mềm đang sử dụng</legend>
      <p class="field-hint">Tích để cấp tài khoản cho người này; bỏ tích để gỡ tài khoản khỏi phần mềm đó.</p>
      <div class="check-grid">${software.map(s => `
        <label class="check-card"><input type="checkbox" name="software" value="${esc(s.key)}"${s.checked ? ' checked' : ''}><span class="check-box">${icon('check', 14)}</span><span>${esc(s.title)}</span></label>`).join('')}
      </div>
    </fieldset>` : '';

  return `${banner}${body}${suggest}${linked}<datalist id="unit-options">${units.map(u => `<option value="${esc(u)}"></option>`).join('')}</datalist>`;
}

export const slugKey = (text) => removeAccents(text).replace(/[^a-z0-9]/g, '');

// Đọc dữ liệu biểu mẫu thành bản ghi
export function readForm(form, kind) {
  const fd = new FormData(form);
  const suggest = fd.getAll('suggest');
  fd.delete('suggest');
  const software = fd.getAll('software');
  fd.delete('software');
  const rec = {};
  fd.forEach((v, k) => { rec[k] = typeof v === 'string' ? v.trim() : v; });
  if (kind === 'device' && !rec.printer) rec.printer = 'Không';
  if (kind === 'appconfig' || kind === 'portalcluster') rec.col1 = slugKey(rec.col1 || rec.name);
  if (rec.status) rec.statusType = statusTypeOf(rec.status);
  return { record: rec, suggest, software };
}
