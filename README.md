# Git Branch Time Tracker

Extension VSCode giúp theo dõi thời gian làm việc trên từng git branch một cách tự động.

## ✨ Features

- **🔄 Auto Branch Detection**: Tự động phát hiện khi switch branch và start/stop timer
- **📁 File Tracking**: Theo dõi các files được modify trong mỗi session
- **📊 Dashboard**: Xem báo cáo chi tiết thời gian làm việc
- **⏱️ Real-time Status**: Hiển thị branch hiện tại và thời gian đã làm trên status bar
- **💾 Local Storage**: Dữ liệu được lưu local, không gửi lên server nào

## 🚀 Cách sử dụng

### Tự động tracking

Extension sẽ tự động:

- Bắt đầu track khi bạn mở VSCode trong git repository
- Detect khi bạn switch sang branch khác
- Stop timer của branch cũ và start timer cho branch mới
- Track các files bạn đang edit

### Xem báo cáo

1. **Status Bar**: Click vào status bar để mở dashboard
2. **Command Palette**: `Ctrl+Shift+P` → "Show Time Tracking Dashboard"

### Dashboard hiển thị:

- Tổng thời gian làm việc trên mỗi branch
- Chi tiết theo từng ngày
- Thời gian cụ thể (VD: 9:30 - 11:45)
- Danh sách files đã modify trong session

## 📱 Screenshots

### Status Bar

```
🌿 feature/user-auth | ⏰ 2h 30m
```

### Dashboard

```
Branch: feature/user-auth - 8.5 giờ
├── 03/06/2024 - 4.2 giờ
│   ├── 09:30 - 12:00 (2h 30m)
│   │   Files: auth.js, login.vue, middleware.ts
│   └── 14:00 - 15:45 (1h 45m)
│       Files: auth.test.js, utils.js
└── 02/06/2024 - 4.3 giờ
    └── 10:15 - 17:30 (4h 15m)
        Files: database.js, schema.sql
```

## ⚙️ Commands

| Command                        | Description                  |
| ------------------------------ | ---------------------------- |
| `Show Time Tracking Dashboard` | Mở dashboard xem báo cáo     |
| `Reset All Tracking Data`      | Xóa toàn bộ dữ liệu tracking |

## 🔧 Technical Details

### Data Structure

```json
{
  "feature/user-auth": {
    "totalTime": 14400,
    "sessions": [
      {
        "start": "2024-06-03T09:30:00Z",
        "end": "2024-06-03T12:00:00Z",
        "files": ["auth.js", "login.vue"]
      }
    ]
  }
}
```

### Storage Location

- **Windows**: `%APPDATA%\Code\User\globalStorage\local-dev.git-branch-time-tracker\`
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/local-dev.git-branch-time-tracker/`
- **Linux**: `~/.config/Code/User/globalStorage/local-dev.git-branch-time-tracker/`

## 📋 Requirements

- VSCode 1.60.0+
- Git repository trong workspace
- Git extension được enable

## 🛠️ Installation

### Method 1: Local Installation

```bash
# Clone hoặc download source code
git clone <repository-url>
cd git-branch-tracker

# Install dependencies
npm install

# Compile
npm run compile

# Package
npx vsce package

# Install
code --install-extension git-branch-time-tracker-1.0.0.vsix
```

### Method 2: Development Mode

```bash
# Trong folder extension
npm run compile

# Mở VSCode
code .

# Press F5 để test
```

## 🔄 Development

### Setup

```bash
npm install
npm run compile
```

### Scripts

- `npm run compile`: Build TypeScript
- `npm run watch`: Auto-compile khi có thay đổi
- `npx vsce package`: Tạo .vsix file

### Project Structure

```
git-branch-tracker/
├── src/
│   └── extension.ts      # Main extension code
├── out/                  # Compiled JavaScript
├── package.json          # Extension manifest
├── tsconfig.json         # TypeScript config
└── README.md            # Documentation
```

## 🐛 Known Issues

- Extension chỉ hoạt động với Git repositories
- Cần Git extension được enable
- Timer có thể không chính xác 100% nếu VSCode bị crash

## 🔮 Roadmap

- [ ] Export báo cáo ra CSV/JSON
- [ ] Integration với Git commits
- [ ] Estimate vs actual time comparison
- [ ] Multi-workspace support
- [ ] Dark/Light theme cho dashboard

## 📝 Changelog

### 1.0.0

- ✨ Auto branch detection
- ✨ File tracking
- ✨ Dashboard với báo cáo chi tiết
- ✨ Status bar integration

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push và tạo Pull Request

## 📄 License

MIT License - tự do sử dụng và modify.

## 🙋‍♂️ Support

Nếu gặp issue hoặc có feature request, tạo issue trong repository hoặc liên hệ trực tiếp.

---

**Happy Coding! 🚀**
