# Hệ Thống Quản Trị Bình Mỹ — Cổng điều phối số

Website tĩnh viết hoàn toàn bằng **JavaScript thuần (ES Modules)**: không cần Google Apps Script, không cần máy chủ, không cần build. Đưa thẳng lên **GitHub Pages** là chạy.

## Tính năng

- **Cổng điều phối** (menu trên cùng): phần mềm được gom theo **cụm nghiệp vụ**. Mỗi cụm có vòng "sức khỏe" tài khoản; lọc theo cụm, tìm phần mềm, và liên kết tới Tổng quan, tổng hợp, thông tin chung, thiết bị, camera. Chọn cụm cho từng phần mềm trong *Cấu hình Phần mềm*.
- **Cụm Cổng điều phối** (trong nhóm *Tổ chức & Cấu hình*): tự tạo, sửa, xóa từng cụm (tên, mã, biểu tượng, màu, mô tả). Lần đầu có sẵn 6 cụm mẫu (Điều hành, Nhân sự, An ninh, Dữ liệu, Dịch vụ công, Hạ tầng) để sửa hoặc xóa tùy ý. Xóa cụm thì phần mềm trong cụm đó chuyển sang "Chưa phân loại".
- **Tổng quan thông minh**: chỉ số chính, vòng "sức khỏe" tài khoản, *Trợ lý thông minh* tự phát hiện CCCD trùng/sai, mật khẩu yếu, thiết bị hư, nhân sự chưa có tài khoản…
- **Module cố định**: Thông tin chung, Thiết bị, Thiết bị mật, Camera, Đơn vị tổ chức, Mã định danh, Cấu hình phần mềm, Cụm Cổng điều phối.
- **Phần mềm** không có sẵn: thêm trong **Cấu hình phần mềm**, phần mềm đó sẽ tự hiện trong nhóm *Phần mềm* trên menu và trong Tổng hợp phần mềm.
- **Thêm / sửa / xóa** có xác nhận và nút **Hoàn tác** khi xóa nhầm.
- **Gõ tên là gợi ý**: tự tìm hồ sơ gốc và điền sẵn; sửa hồ sơ gốc tự **đồng bộ** sang mọi tài khoản của người đó.
- **Thêm thiết bị hàng loạt**: gõ họ (ví dụ "nguyễn") để hiện danh sách người trong Thông tin chung, bấm từng người hoặc **Chọn tất cả**, rồi lưu một lượt để tạo mỗi người một thiết bị (thông số dùng chung).
- **Đọc số CCCD**: tự nhận giới tính, năm sinh, tỉnh cấp; cảnh báo trùng số với người khác.
- **Nhập hàng loạt Thông tin chung** bằng Excel: bấm *File mẫu* (có sẵn các hồ sơ hiện tại kèm mã hồ sơ), sửa hoặc thêm dòng, rồi *Nhập Excel*. Dòng có mã hồ sơ (hoặc CCCD) đã có thì cập nhật, còn lại thêm mới; có bản xem trước, dòng lỗi được bỏ qua và có thể hoàn tác.
- **Nhập hàng loạt Đơn vị tổ chức** bằng Excel: cùng cách làm như trên, file mẫu có sẵn các đơn vị hiện tại kèm mã đơn vị. Dòng có mã đơn vị (hoặc tên đơn vị) đã có thì cập nhật, còn lại thêm mới.
- **Tìm kiếm toàn hệ thống** (phím tắt `/`), không dấu, nhiều từ khóa, nhận diện CCCD.
- **Lọc** theo đơn vị, trạng thái; phân trang; **xuất Excel / Word**.
- **Ma trận phân quyền** và **thống kê phần mềm**.
- **Kho tài liệu**: kéo thả tệp, xem trước ảnh/PDF/Word/Excel/TXT.
- **Dùng tốt trên điện thoại**: menu trượt, bảng tự chuyển thành thẻ, hộp thoại dạng tấm trượt, nút thêm nhanh; cài được ra màn hình chính (PWA), mở được khi mất mạng.
- Hiệu ứng chuyển trang mượt (View Transitions), tôn trọng chế độ *giảm chuyển động* của thiết bị.

## Cấu trúc thư mục

```
index.html              Trang khởi động (chỉ nạp CSS + JS)
css/styles.css          Toàn bộ giao diện (màu trắng · xanh · đỏ · vàng)
js/main.js              Điểm khởi động
js/app.js               Bộ điều khiển: định tuyến, hộp thoại, lưu/sửa/xóa, tìm kiếm
js/views.js             Giao diện các trang
js/forms.js             Biểu mẫu từng module
js/columns.js           Cột bảng & cột file xuất
js/model.js             Thống kê, tổng hợp, lọc
js/insights.js          Trợ lý thông minh, đọc CCCD, tìm kiếm
js/db.js                Lưu dữ liệu (localStorage) và tệp (IndexedDB)
js/export.js            Xuất Excel / Word
js/files.js             Xem trước tài liệu
js/bulk.js              Nhập / xuất hàng loạt Thông tin chung qua Excel
js/config.js            ⚙️ Cấu hình: danh mục, trạng thái, dữ liệu mẫu
js/icons.js             Bộ biểu tượng SVG
manifest.webmanifest, sw.js, icon.svg   Cài đặt lên điện thoại / chạy offline
```

## Đưa lên GitHub Pages

1. Tạo repository mới trên GitHub (ví dụ `binhmy-qltk`).
2. Tải lên các tệp/thư mục: `index.html`, `css/`, `js/`, `icon.svg`, `manifest.webmanifest`, `sw.js`, `.nojekyll`, `README.md`.
   (Không cần tải `QLTK.html`, `Mã GS QLTK.txt` — đó là bản Google Apps Script cũ.)
3. Vào **Settings → Pages → Build and deployment**, chọn *Deploy from a branch*, nhánh `main`, thư mục `/ (root)`, bấm **Save**.
4. Sau 1–2 phút, trang có địa chỉ dạng `https://<tên-tài-khoản>.github.io/binhmy-qltk/`.

Dùng dòng lệnh:

```bash
git init
git add index.html css js icon.svg manifest.webmanifest sw.js .nojekyll README.md
git commit -m "Website quản trị Bình Mỹ"
git branch -M main
git remote add origin https://github.com/<tên-tài-khoản>/binhmy-qltk.git
git push -u origin main
```

## Chạy thử trên máy

Trình duyệt chặn ES Modules khi mở trực tiếp tệp `index.html`, nên cần một máy chủ tĩnh:

```bash
python -m http.server 5173
```

rồi mở `http://localhost:5173`.

## Lưu ý quan trọng

- **Dữ liệu nằm trong trình duyệt** của từng thiết bị (không còn dùng chung qua Google Sheet). Dữ liệu trên máy này không tự chuyển sang máy khác.
- **Chuyển sang máy khác**: trên máy cũ bấm nút **Sao lưu** (biểu tượng tải xuống, góc trên bên phải) để tải về một file `.json` (gồm cả tài liệu đính kèm). Trên máy mới mở website, bấm nút **Khôi phục** (biểu tượng tải lên) và chọn file đó. Khôi phục sẽ thay thế toàn bộ dữ liệu đang có trên máy đó. Nên sao lưu định kỳ.
- **Không có đăng nhập**: ai mở trang cũng thêm, sửa, xóa được (trên dữ liệu trong trình duyệt của chính họ). Không lưu mật khẩu thật của các hệ thống khác nếu đưa trang lên mạng công khai.