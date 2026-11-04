// ==========================================
// CẤU HÌNH CHUNG - chỉnh sửa tại đây khi cần thay đổi danh mục, tài khoản, dữ liệu mẫu
// ==========================================

export const APP_NAME = 'Hệ Thống Quản Trị Bình Mỹ';
export const STORAGE_KEY = 'binhmy-qltk:v1';

export const SUGGESTED_UNITS = [
  'Lãnh đạo', 'Văn phòng HĐND và UBND', 'Phòng Kinh tế', 'Phòng Văn hóa - Xã hội',
  'Trung tâm Phục vụ hành chính công', 'Trung tâm Cung ứng dịch vụ công', 'Công an', 'Quân sự',
  'Ban quản lý dự án đầu tư xây dựng', 'Trạm y tế', 'Ấp', 'Trường học'
];

// tone: màu nhấn của module (blue | red | yellow | slate)
// kind: loại biểu mẫu/bảng dùng cho module
// group: nhóm hiển thị trên menu
export const MODULES = {
  tonghopchung: { title: 'Thông tin chung', icon: 'badge', tone: 'blue', kind: 'person', group: 'system' },
  thietbi: { title: 'Quản lý thiết bị', icon: 'monitor', tone: 'blue', kind: 'device', group: 'asset' },
  thietbimat: { title: 'Thiết bị mật', icon: 'shield', tone: 'red', kind: 'device', group: 'asset' },
  camera: { title: 'Hệ thống Camera', icon: 'camera', tone: 'yellow', kind: 'camera', group: 'asset' },
  donvitochuc: { title: 'Đơn vị tổ chức', icon: 'building', tone: 'blue', kind: 'unit', group: 'config' },
  madinhdanh: { title: 'Mã định danh', icon: 'fingerprint', tone: 'yellow', kind: 'code', group: 'config' },
  quanlyphanmem: { title: 'Cấu hình Phần mềm', icon: 'layers', tone: 'blue', kind: 'appconfig', group: 'config' },
  cumdieuphoi: { title: 'Cụm Cổng điều phối', icon: 'compass', tone: 'blue', kind: 'portalcluster', group: 'config' }
};

// Phần mềm mặc định đã gỡ khỏi hệ thống: khi mở trang, dữ liệu cũ của các khóa này trong trình duyệt sẽ bị xóa
export const REMOVED_MODULE_KEYS = ['dichvucong', 'qlvb', 'mail', 'cks', 'sso', 'pakn1022', 'chinhquyenso', 'nentangso', 'gis'];

// Các module là "tài khoản phần mềm" (dùng để thống kê & phân quyền)
export const ACCOUNT_MODULE_KEYS = Object.keys(MODULES).filter(k => MODULES[k].kind === 'account');

// Module không hiển thị trong bảng phân quyền / thống kê phần mềm
export const NON_SOFTWARE_KEYS = ['madinhdanh', 'donvitochuc', 'quanlyphanmem', 'cumdieuphoi', 'thietbi', 'thietbimat', 'camera', 'tonghopchung'];

export const ICON_CHOICES = [
  ['globe', 'Web / Mạng'], ['file', 'Văn bản / Hồ sơ'], ['users', 'Nhân sự'], ['building', 'Cơ quan'],
  ['chart', 'Biểu đồ'], ['shield', 'Bảo mật'], ['database', 'Dữ liệu'], ['cloud', 'Đám mây'], ['map', 'Bản đồ']
];

export const TONE_CHOICES = [['blue', 'Xanh dương'], ['red', 'Đỏ'], ['yellow', 'Vàng'], ['slate', 'Trung tính']];

// Cụm mặc định của Cổng điều phối: chỉ dùng để tạo dữ liệu ban đầu.
// Từ đó, cụm được tạo / sửa / xóa trong module "Cụm Cổng điều phối" (lưu trong trình duyệt).
export const DEFAULT_PORTAL_CLUSTERS = [
  { key: 'dieuhanh', title: 'Điều hành & Hành chính', desc: 'Văn bản, điều hành và quản lý công việc hằng ngày', icon: 'landmark', tone: 'blue' },
  { key: 'nhansu', title: 'Nhân sự & Tài khoản', desc: 'Hồ sơ cán bộ, cấp quyền và quản lý tài khoản', icon: 'users', tone: 'blue' },
  { key: 'antoan', title: 'An ninh & Bảo mật', desc: 'Camera, thiết bị mật, xác thực và bảo vệ dữ liệu', icon: 'shield', tone: 'red' },
  { key: 'dulieu', title: 'Dữ liệu & Báo cáo', desc: 'Thống kê, dữ liệu dùng chung và bản đồ số', icon: 'chart', tone: 'yellow' },
  { key: 'dichvu', title: 'Dịch vụ công & Tiện ích', desc: 'Tiếp nhận, giải quyết thủ tục và phục vụ người dân', icon: 'globe', tone: 'blue' },
  { key: 'hatang', title: 'Hạ tầng & Thiết bị', desc: 'Mạng, máy chủ và thiết bị đầu cuối', icon: 'cloud', tone: 'slate' }
];

// Cụm dành cho phần mềm chưa chọn cụm (hoặc cụm đã bị xóa)
export const PORTAL_OTHER = { key: 'chuaphanloai', title: 'Chưa phân loại', desc: 'Phần mềm chưa được gán cụm. Mở Cấu hình Phần mềm để phân loại.', icon: 'layers', tone: 'slate' };

// Biểu tượng cho cụm (tên phải có trong icons.js)
export const CLUSTER_ICON_CHOICES = [
  ['landmark', 'Điều hành / Hành chính'], ['users', 'Nhân sự'], ['shield', 'Bảo mật'], ['chart', 'Báo cáo / Biểu đồ'],
  ['globe', 'Dịch vụ / Web'], ['cloud', 'Hạ tầng / Đám mây'], ['database', 'Dữ liệu'], ['layers', 'Tổng hợp'],
  ['compass', 'Điều phối'], ['building', 'Cơ quan'], ['file', 'Văn bản / Hồ sơ'], ['map', 'Bản đồ'],
  ['lock', 'Khóa / Mật'], ['folder', 'Thư mục'], ['monitor', 'Thiết bị']
];

// Bản ghi cụm ban đầu (khớp cấu trúc module: name = tên, col1 = mã, col2 = biểu tượng, col3 = màu, notes = mô tả)
export const seedPortalClusters = () => DEFAULT_PORTAL_CLUSTERS.map((c, i) => ({
  id: 201 + i, name: c.title, col1: c.key, col2: c.icon, col3: c.tone, notes: c.desc
}));

// Trạng thái -> mức màu (blue = ổn/thông tin, yellow = cảnh báo, red = nguy hiểm)
export const STATUS_TYPE = {
  'Bình thường': 'success', 'Đang hoạt động': 'success',
  'Đợi cấp': 'info', 'Quên mật khẩu': 'warning', 'Khóa': 'danger',
  'Cũ/Yếu': 'info', 'Đang sửa': 'warning', 'Đang sửa chữa': 'warning', 'Hư hỏng': 'danger', 'Thanh lý': 'info',
  'Mất kết nối': 'warning', 'Đang bảo trì': 'info', 'Ngừng hoạt động': 'danger', 'Ngừng hoạt động / Giải thể': 'danger'
};

export const STATUS_OPTIONS = {
  account: [
    ['Bình thường', 'Bình thường (Hoạt động tốt)'], ['Đợi cấp', 'Đợi cấp (Chưa có tài khoản)'],
    ['Quên mật khẩu', 'Quên mật khẩu (Cần reset)'], ['Khóa', 'Khóa (Đã thu hồi / Nghỉ việc)']
  ],
  device: [
    ['Bình thường', 'Bình thường (Đang dùng tốt)'], ['Cũ/Yếu', 'Cũ/Yếu (Cần nâng cấp)'],
    ['Đang sửa', 'Đang sửa chữa'], ['Hư hỏng', 'Hư hỏng'], ['Thanh lý', 'Đã thanh lý']
  ],
  camera: [
    ['Bình thường', 'Đang hoạt động (Bình thường)'], ['Mất kết nối', 'Mất kết nối mạng / Không lên hình'],
    ['Đang bảo trì', 'Đang bảo trì / Sửa chữa'], ['Hư hỏng', 'Hư hỏng (Cần thay thế)']
  ],
  unit: [['Bình thường', 'Đang hoạt động'], ['Ngừng hoạt động', 'Ngừng hoạt động / Giải thể']]
};

// ==========================================
// DỮ LIỆU MẪU (chỉ dùng lần đầu khi trình duyệt chưa có dữ liệu)
// ==========================================
export function buildSeedData() {
  const data = {};
  Object.keys(MODULES).forEach(k => { data[k] = []; });
  data.donvitochuc = [
    { id: 101, name: 'Lãnh đạo', col3: 'Nguyễn Văn A', phone: '02837971234', email: 'lanhdao@binhmy.gov.vn', address: 'Tầng 2, UBND', status: 'Bình thường', statusType: 'success', notes: 'Thường trực Đảng ủy, HĐND, UBND' },
    { id: 102, name: 'Phòng Văn hóa - Xã hội', col3: 'Trần Thị B', phone: '02837971235', email: 'vhxh@binhmy.gov.vn', address: 'Tầng 1, UBND', status: 'Bình thường', statusType: 'success', notes: '' }
  ];
  data.tonghopchung = [
    { id: 3, name: 'Nguyễn Văn A', gender: 'Nam', dob: '1985-05-12', cccd: '079085001234', cccdDate: '2021-10-15', address: 'Bình Mỹ, Củ Chi', role: 'Chủ tịch', unit: 'Lãnh đạo', phone: '0909123456', email: 'nva@tphcm.gov.vn', notes: 'Hồ sơ gốc (dữ liệu mẫu)' }
  ];
  data.thietbi = [
    { id: 2, name: 'Trần Thị B', role: 'Chuyên viên', unit: 'Phòng Văn hóa - Xã hội', brand: 'Dell', cpu: 'Core i5', ram: '8GB', storage: '256GB SSD', isLaptop: 'Có', printer: 'Không', scanner: 'Không', status: 'Bình thường', statusType: 'success', notes: 'Máy mới cấp' }
  ];
  data.thietbimat = [
    { id: 4, name: 'Trần Văn C', role: 'Chỉ huy trưởng', unit: 'Quân sự', brand: 'HP ProBook', cpu: 'Core i7', ram: '16GB', storage: '512GB SSD', isLaptop: 'Có', printer: 'Không', scanner: 'Không', status: 'Bình thường', statusType: 'success', notes: 'Không kết nối internet ngoài' }
  ];
  data.camera = [
    { id: 5, name: 'Cổng chính UBND', unit: 'Văn phòng HĐND và UBND', brand: 'Hikvision', col1: '4MP (2K)', col2: '192.168.1.101', col3: 'admin / Abc@123', status: 'Bình thường', statusType: 'success', notes: 'Góc quay 120 độ' }
  ];
  data.cumdieuphoi = seedPortalClusters();
  return data;
}

export const DEFAULT_LINKS = {};

export const DEFAULT_NOTES = {
  thietbi: 'Quản lý toàn bộ tài sản thiết bị tin học (Máy tính, máy in, máy scan...) của cơ quan.\nLưu ý: Thường xuyên cập nhật tình trạng hư hỏng, sửa chữa để báo cáo bảo trì.',
  thietbimat: 'Khu vực quản lý các thiết bị phục vụ công tác cơ mật, an ninh quốc phòng.\nTUYỆT ĐỐI: Không kết nối các máy tính này với mạng Internet bên ngoài.',
  camera: 'Quản lý hệ thống Camera giám sát an ninh tại cơ quan và các điểm cầu.\nLưu ý: Đảm bảo bảo mật tài khoản/mật khẩu luồng truyền hình ảnh.',
  donvitochuc: 'Quản lý danh sách các phòng ban, đơn vị trực thuộc, đoàn thể, trường học, ấp...\nDữ liệu tại đây sẽ tự động hiển thị làm danh sách lựa chọn (gợi ý) khi tạo tài khoản.',
  quanlyphanmem: 'Nơi khởi tạo và cấu hình các phần mềm / tiện ích mới.\nSau khi tạo mới, phần mềm sẽ tự động hiển thị trên thanh menu và trong Bảng tổng hợp phân quyền.',
  cumdieuphoi: 'Tạo và sắp xếp các cụm nghiệp vụ hiển thị trên Cổng điều phối (mỗi cụm một mục).\nPhần mềm chọn cụm trong Cấu hình phần mềm. Xóa cụm thì phần mềm thuộc cụm đó sẽ chuyển sang "Chưa phân loại".'
};
