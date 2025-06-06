# Git Branch Time Tracker

Một VSCode extension giúp tracking thời gian làm việc theo từng Git branch cho mỗi project/repository.

## Tính năng

### 🕒 Tự động Tracking Thời gian

- Chỉ tính thời gian khi có hành động chỉnh sửa file (edit)
- Tự động bắt đầu tracking khi có thay đổi trên file
- Tự động dừng tracking khi rời khỏi VS Code hoặc không có hoạt động trong 30 giây
- Tracking theo từng Git branch riêng biệt

### 📊 Dashboard Trực quan

- Hiển thị danh sách tất cả projects/repositories
- Hiển thị spent time theo từng branch
- Hiển thị theo ngày với thời gian chi tiết
- Nhóm branches theo project/repository
- Tự động refresh mỗi 30 giây

### 🔧 Tích hợp Git

- Tự động detect Git repository hiện tại
- Tự động detect branch hiện tại
- Hỗ trợ multiple repositories trong workspace

### 💾 Lưu trữ Local

- Tất cả dữ liệu được lưu trữ local
- Không cần server hay kết nối internet
- Dữ liệu được persist giữa các session

## Cài đặt

1. Download file extension (.vsix)
2. Mở VS Code
3. Chạy command: `Extensions: Install from VSIX...`
4. Chọn file .vsix đã download
5. Reload VS Code

## Sử dụng

### Xem Dashboard

1. Mở Command Palette (`Ctrl+Shift+P` hoặc `Cmd+Shift+P`)
2. Chạy command: `Git Branch Time Tracker: Show Time Tracker Dashboard`
3. Hoặc click vào icon 🕒 trong Activity Bar

### Reset Data

1. Mở Command Palette
2. Chạy command: `Git Branch Time Tracker: Reset All Time Data`
3. Confirm để xóa tất cả dữ liệu tracking

### Tracking Tự động

- Extension sẽ tự động bắt đầu tracking khi bạn:
  - Chỉnh sửa file
  - Mở file mới
  - Thay đổi nội dung file
- Tracking sẽ dừng khi:
  - Không có hoạt động trong 30 giây
  - Rời khỏi VS Code
  - Chuyển sang branch khác

## Giao diện Dashboard

Dashboard hiển thị:

- **📁 Repository Name**: Tên của Git repository
- **🌿 Branch Name**: Tên branch với tổng thời gian làm việc
- **📅 Date**: Thời gian làm việc theo từng ngày
- **Time Format**: Hiển thị dưới dạng `Xh Ym Zs`

## Yêu cầu

- VS Code phiên bản 1.60.0 trở lên
- Git đã được cài đặt và có thể access từ command line
- Workspace phải là Git repository

## Cấu trúc dữ liệu

Dữ liệu được lưu trong file JSON với cấu trúc:

```json
{
  "date": "2025-06-06",
  "repository": "my-project",
  "branch": "feature/new-feature",
  "duration": 1800,
  "startTime": 1717689600000,
  "endTime": 1717691400000
}
```

## Hạn chế

- Chỉ tracking được trong Git repositories
- Cần Git command line tools
- Hiện tại chỉ support workspace đầu tiên nếu có multiple folders

## Đóng góp

Extension này được tạo để giúp developers theo dõi thời gian làm việc hiệu quả hơn. Mọi feedback và suggestions đều được welcome!

## License

MIT License
