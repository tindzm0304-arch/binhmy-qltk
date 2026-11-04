// ==========================================
// CHỌN NHIỀU NGƯỜI TỪ HỒ SƠ GỐC (biểu mẫu thêm thiết bị và tài khoản)
// Gõ họ tên để lọc, bấm từng người hoặc "Chọn tất cả", rồi lưu một lượt: mỗi người một bản ghi
// ==========================================
import { esc, normalizeStr } from './utils.js';
import { icon } from './icons.js';
import { findMasterCandidates } from './insights.js';

const SHOW = 8; // số người hiện trong danh sách; phần còn lại gõ thêm để thu hẹp
// Ô thông tin cá nhân: khi đã chọn người thì lấy theo hồ sơ gốc của từng người nên bị khóa
const FROM_PERSON = ['gender', 'role', 'unit', 'account', 'phone', 'email', 'cccd', 'cccdDate'];

const sameId = (a, b) => String(a.id) === String(b.id);

// Nhãn và cách đếm theo loại biểu mẫu. key là module đang thêm (thiết bị hoặc phần mềm)
export function pickerLabels(kind, key) {
  if (kind === 'account') {
    return {
      noun: 'tài khoản',
      owned: (data, p) => (data[key] || []).filter(a => (a.personId !== undefined && String(a.personId) === String(p.id)) || normalizeStr(a.name) === normalizeStr(p.name)).length
    };
  }
  return {
    noun: 'thiết bị',
    owned: (data, p) => ['thietbi', 'thietbimat'].reduce((n, k) => n + (data[k] || []).filter(d => d.personId !== undefined && String(d.personId) === String(p.id)).length, 0)
  };
}

// Gắn gợi ý vào biểu mẫu. picked là mảng người đã chọn, dùng chung với lúc lưu
export function wirePersonPicker(form, picked, { getData, noun, owned }) {
  const input = form.querySelector('[data-pick-name]');
  const panel = form.querySelector('[data-smart-picker]');
  const fields = FROM_PERSON.map(k => form.elements[k]).filter(Boolean);
  let hits = [];

  const isPicked = (p) => picked.some(x => sameId(x, p));

  // Khi đã chọn người: họ tên và các ô thông tin cá nhân không bắt buộc, và được lấy theo từng hồ sơ gốc
  const lockFields = () => {
    const locked = picked.length > 0;
    fields.forEach(el => { el.disabled = locked; });
    [input, ...fields].forEach(el => {
      if (el.dataset.reqOrig === undefined) el.dataset.reqOrig = el.required ? '1' : '0';
      const wasReq = el.dataset.reqOrig === '1';
      el.required = wasReq && !locked;
      el.closest('.field')?.querySelector('.req')?.toggleAttribute('hidden', wasReq && locked);
    });
  };

  const render = () => {
    const shown = hits.slice(0, SHOW);
    const allPicked = hits.length > 0 && hits.every(isPicked);
    panel.hidden = !picked.length && !shown.length;
    panel.innerHTML = `${picked.length ? `<div class="picked-bar">
        <p>${icon('users', 16)} Đã chọn <strong>${picked.length}</strong> người. Lưu sẽ tạo ${picked.length} ${noun}, mỗi người một bản ghi.</p>
        <p class="picked-note">Thông tin cá nhân lấy theo hồ sơ gốc của từng người.</p>
        <div class="picked-chips">${picked.map(p => `<span class="picked-chip">${esc(p.name)}<button type="button" class="picked-x" data-unpick="${esc(p.id)}" aria-label="Bỏ chọn ${esc(p.name)}">${icon('x', 12)}</button></span>`).join('')}</div>
      </div>` : ''}
      ${shown.length ? `<div class="picker-head">
        <span>${hits.length} hồ sơ khớp${hits.length > SHOW ? `, đang hiện ${SHOW} người đầu. Gõ thêm để thu hẹp` : ''}</span>
        <button type="button" class="link-btn" data-pick-all>${allPicked ? 'Bỏ chọn tất cả' : `Chọn tất cả (${hits.length})`}</button>
      </div>
      <ul class="picker-list">${shown.map(p => {
        const on = isPicked(p);
        const count = owned(getData(), p);
        const sub = [p.role, p.unit].filter(Boolean).join(' · ') || 'Chưa có chức vụ, đơn vị';
        return `<li><button type="button" class="picker-item" aria-pressed="${on}" data-pick="${esc(p.id)}">
          <span class="check-box">${icon('check', 14)}</span>
          <span class="picker-main"><strong>${esc(p.name)}</strong><small>${esc(sub)}</small></span>
          ${count ? `<span class="picker-tag">Đã có ${count} ${noun}</span>` : ''}
        </button></li>`;
      }).join('')}</ul>` : ''}`;
  };

  const toggle = (p) => {
    const i = picked.findIndex(x => sameId(x, p));
    if (i >= 0) picked.splice(i, 1);
    else picked.push(p);
    lockFields();
    render();
  };

  input.addEventListener('input', () => {
    hits = findMasterCandidates(input.value, getData());
    render();
  });

  // Enter: thêm người đầu tiên còn trong danh sách, không gửi biểu mẫu
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const next = hits.find(p => !isPicked(p));
    if (!next) return;
    e.preventDefault();
    toggle(next);
  });

  panel.addEventListener('click', (e) => {
    const item = e.target.closest('[data-pick]');
    if (item) {
      toggle(hits.find(p => String(p.id) === item.dataset.pick));
      // Danh sách được vẽ lại, nên trả con trỏ về đúng dòng vừa bấm (để bàn phím vẫn dùng được)
      return panel.querySelector(`[data-pick="${item.dataset.pick}"]`)?.focus();
    }
    const unpick = e.target.closest('[data-unpick]');
    if (unpick) return toggle(picked.find(p => String(p.id) === unpick.dataset.unpick));
    if (e.target.closest('[data-pick-all]')) {
      const allPicked = hits.every(isPicked);
      hits.forEach(p => {
        const i = picked.findIndex(x => sameId(x, p));
        if (allPicked && i >= 0) picked.splice(i, 1);
        if (!allPicked && i < 0) picked.push(p);
      });
      lockFields();
      render();
    }
  });

  render();
}
