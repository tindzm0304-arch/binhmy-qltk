// Điểm khởi động của website
import { boot } from './app.js';

boot();

// Cho phép cài đặt lên màn hình điện thoại và mở khi mất mạng
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
