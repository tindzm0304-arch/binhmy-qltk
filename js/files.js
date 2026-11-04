// ==========================================
// XEM TRƯỚC TÀI LIỆU
// ==========================================
import { getFile } from './db.js';
import { loadScript } from './utils.js';

const LIBS = {
  mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
};

export const fileExt = (name = '') => (name.split('.').pop() || '').toLowerCase();

export const fileIconName = (name = '') => {
  const ext = fileExt(name);
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return 'file';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'table';
  return 'paperclip';
};

// Trả về { kind, url?, html?, text? } để hiển thị trong cửa sổ xem trước
export async function buildPreview(doc) {
  const blob = await getFile(doc.id);
  if (!blob) return { kind: 'error', message: 'Không tìm thấy nội dung tệp trên trình duyệt này. Tệp chỉ lưu trên thiết bị đã tải lên.' };
  const ext = fileExt(doc.name);
  const url = URL.createObjectURL(blob);
  try {
    if ((doc.fileType || '').startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return { kind: 'image', url, blob };
    if (ext === 'pdf') return { kind: 'pdf', url, blob };
    if (['txt', 'md', 'json'].includes(ext)) return { kind: 'text', text: await blob.text(), url, blob };
    if (ext === 'docx') {
      await loadScript(LIBS.mammoth);
      const res = await window.mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
      return { kind: 'html', html: res.value || '<p class="muted">Tài liệu rỗng.</p>', url, blob };
    }
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      await loadScript(LIBS.xlsx);
      const wb = window.XLSX.read(await blob.arrayBuffer(), { type: 'array' });
      return { kind: 'html', html: window.XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]]), url, blob };
    }
    return { kind: 'none', url, blob };
  } catch (e) {
    return { kind: 'error', message: 'Không thể phân tích nội dung tệp này. Vui lòng tải xuống để xem.', url, blob };
  }
}
