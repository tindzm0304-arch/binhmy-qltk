// ==========================================
// LƯU TRỮ DỮ LIỆU (thay cho Google Sheet / Google Drive)
// - Dữ liệu bảng: localStorage của trình duyệt
// - Tệp đính kèm: IndexedDB của trình duyệt
// ==========================================
import { STORAGE_KEY, MODULES, REMOVED_MODULE_KEYS, buildSeedData, seedPortalClusters, DEFAULT_LINKS, DEFAULT_NOTES } from './config.js';

const TONES = ['blue', 'red', 'yellow', 'slate'];

// Chuyển tên biểu tượng / màu kiểu cũ (Material Symbols + Tailwind) sang bộ mới
const LEGACY_ICON = {
  Globe: 'globe', FileText: 'file', Users: 'users', Building2: 'building', Activity: 'chart',
  ShieldCheck: 'shield', Database: 'database', Cloud: 'cloud', Map: 'map'
};
const legacyTone = (cls = '') => {
  if (/rose|red|pink/.test(cls)) return 'red';
  if (/orange|amber|yellow/.test(cls)) return 'yellow';
  if (/slate|gray/.test(cls)) return 'slate';
  return 'blue';
};

// Bỏ dữ liệu, link, ghi chú, tài liệu của phần mềm mặc định đã gỡ
const withoutRemoved = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !REMOVED_MODULE_KEYS.includes(k)));

export function normalizeState(raw = {}) {
  const data = {};
  Object.keys(MODULES).forEach(k => { data[k] = []; });
  Object.entries(withoutRemoved(raw.data)).forEach(([k, v]) => { if (Array.isArray(v)) data[k] = v; });
  // Bản lưu cũ chưa có cụm: dùng cụm mặc định để Cổng điều phối vẫn hiển thị như trước
  if (!Array.isArray(raw.data?.cumdieuphoi)) data.cumdieuphoi = seedPortalClusters();

  data.quanlyphanmem = data.quanlyphanmem.map(pm => ({
    ...pm,
    col2: LEGACY_ICON[pm.col2] || pm.col2 || 'globe',
    col3: TONES.includes(pm.col3) ? pm.col3 : legacyTone(pm.col3)
  }));
  data.quanlyphanmem.forEach(pm => { if (pm.col1 && !data[pm.col1]) data[pm.col1] = []; });

  return {
    version: 1,
    data,
    links: { ...DEFAULT_LINKS, ...withoutRemoved(raw.links) },
    notes: { ...DEFAULT_NOTES, ...withoutRemoved(raw.notes || raw.data?.moduleNotes) },
    docs: raw.docs && typeof raw.docs === 'object' ? withoutRemoved(raw.docs) : {},
    updatedAt: raw.updatedAt || null
  };
}

// Có dữ liệu cũ của phần mềm đã gỡ trong bản lưu hay không
const hasRemovedData = (raw) => ['data', 'links', 'notes', 'docs'].some(part =>
  REMOVED_MODULE_KEYS.some(k => Object.prototype.hasOwnProperty.call(raw[part] || {}, k)));

// Xóa các tệp đính kèm (IndexedDB) của phần mềm đã gỡ
function removeDocFiles(docs = {}) {
  REMOVED_MODULE_KEYS.forEach(k => {
    Object.values(docs[k] || {}).forEach(list => (Array.isArray(list) ? list : []).forEach(d => deleteFile(d.id)));
  });
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const state = normalizeState(parsed);
      const migrated = !Array.isArray(parsed.data?.cumdieuphoi);
      if (hasRemovedData(parsed)) removeDocFiles(parsed.docs);
      if (migrated || hasRemovedData(parsed)) saveState(state);
      return { state, fresh: false };
    }
  } catch (e) { console.warn('Không đọc được dữ liệu đã lưu:', e); }
  return { state: normalizeState({ data: buildSeedData() }), fresh: true };
}

export function saveState(state) {
  state.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Không lưu được dữ liệu:', e);
    return false;
  }
}

// ---------- Tệp đính kèm trong IndexedDB ----------
const FILE_DB = 'binhmy-qltk-files';
const FILE_STORE = 'files';
const memoryFiles = new Map(); // dự phòng khi trình duyệt chặn IndexedDB (chế độ ẩn danh...)
let dbPromise = null;

function openFileDB() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB không khả dụng'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(FILE_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(FILE_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
  }
  return dbPromise;
}

async function fileTx(mode, action) {
  const db = await openFileDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, mode);
    const req = action(tx.objectStore(FILE_STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

export async function putFile(id, blob) {
  try { await fileTx('readwrite', s => s.put(blob, String(id))); }
  catch { memoryFiles.set(String(id), blob); }
}

export async function getFile(id) {
  const key = String(id);
  try { return (await fileTx('readonly', s => s.get(key))) || memoryFiles.get(key) || null; }
  catch { return memoryFiles.get(key) || null; }
}

export async function deleteFile(id) {
  const key = String(id);
  memoryFiles.delete(key);
  try { await fileTx('readwrite', s => s.delete(key)); } catch { /* bỏ qua */ }
}

// ---------- Sao lưu / khôi phục (một tệp JSON) ----------
const BACKUP_APP = 'binhmy-qltk';
const BACKUP_FORMAT = 1;

const blobToDataURL = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

const dataURLToBlob = (url) => {
  const comma = url.indexOf(',');
  const mime = url.slice(5, url.indexOf(';')) || 'application/octet-stream';
  const bin = atob(url.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

// Gom toàn bộ dữ liệu bảng + tệp đính kèm thành một đối tượng để ghi ra JSON
export async function buildBackup(state) {
  const ids = new Set();
  Object.values(state.docs || {}).forEach(byType => Object.values(byType || {}).forEach(list =>
    (Array.isArray(list) ? list : []).forEach(d => { if (d?.id) ids.add(String(d.id)); })));
  const files = {};
  for (const id of ids) {
    const blob = await getFile(id);
    if (blob) files[id] = await blobToDataURL(blob);
  }
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    state: { data: state.data, links: state.links, notes: state.notes, docs: state.docs, updatedAt: state.updatedAt },
    files
  };
}

// Đọc và kiểm tra tệp sao lưu; ném lỗi nếu không đúng định dạng
export function readBackup(text) {
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error('File không phải JSON hợp lệ.'); }
  if (payload?.app !== BACKUP_APP || !payload.state?.data || typeof payload.state.data !== 'object') {
    throw new Error('File này không phải bản sao lưu của Bình Mỹ.');
  }
  return payload;
}

// Ghi đè dữ liệu trên máy bằng bản sao lưu; trả về trạng thái mới
export async function restoreBackup(payload) {
  const state = normalizeState(payload.state);
  for (const [id, url] of Object.entries(payload.files || {})) {
    await putFile(id, dataURLToBlob(url));
  }
  if (!saveState(state)) throw new Error('Không đủ bộ nhớ trình duyệt để khôi phục dữ liệu.');
  return state;
}
