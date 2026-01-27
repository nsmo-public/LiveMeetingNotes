# 📝 LiveMeetingNote Web Application

> Progressive Web Application (PWA) for live meeting note-taking with audio recording

[![GitHub Pages](https://img.shields.io/badge/demo-live-brightgreen)](https://nsmo-public.github.io/Web_MeetingNote/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-blue)](https://reactjs.org/)

**LiveMeetingNote** là ứng dụng web chuyên nghiệp giúp ghi chép cuộc họp với khả năng ghi âm, đánh dấu thời gian tự động, và hoạt động hoàn toàn offline. 100% bảo mật - dữ liệu lưu trên máy bạn, không upload lên server.

📚 **[User Guide](USER_GUIDE.md)** | 🚀 **[Quick Start](QUICKSTART.md)** | 🔒 **[Privacy Policy](PRIVACY.md)**

## ✨ Features

- 🎙️ **Audio Recording** - Ghi âm chất lượng cao WebM (Opus codec, ~140MB/2.5h)
- 🎤 **Speech-to-Text** - Chuyển đổi giọng nói sang văn bản real-time (Web Speech API)
- 🤖 **AI Text Refinement** - Chuẩn hóa và làm sạch văn bản với Google Gemini AI
- ⏱️ **Real-time Timestamps** - Nhấn ENTER để chèn timestamp tự động
- 📝 **Rich Text Editor** - Định dạng văn bản với toolbar đầy đủ (Quill.js)
- 🎯 **Timestamp Seeking** - Double-click timestamp → jump đến vị trí audio
- ✏️ **Edit Transcriptions** - Double-click segment để chỉnh sửa thời gian, người nói, nội dung
- 💾 **Local File Storage** - Lưu files trực tiếp vào folder (Chrome/Edge)
- 🔄 **Auto-backup & Recovery** - Tự động backup mỗi 3s, khôi phục khi crash
- 📂 **Load Project** - Load lại project cũ để chỉnh sửa
- 📴 **Offline Support** - Hoạt động 100% offline sau lần load đầu
- 🌐 **Cross-Platform** - Tương thích Chrome, Edge, Firefox, Safari
- 📄 **Word Export** - Export file .docx để chia sẻ

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Deployment

```bash
# Deploy to GitHub Pages
npm run deploy
```

## 📱 Browser Compatibility

| Feature | Chrome/Edge | Safari | Firefox |
|---------|-------------|--------|---------|
| Audio Recording | ✅ | ✅ (14.1+) | ✅ |
| File System Access | ✅ | ⚠️ Download | ⚠️ Download |
| PWA Install | ✅ | ✅ | ✅ |
| Offline Mode | ✅ | ✅ | ✅ |

## 🎨 Tech Stack

- **Frontend**: React 18 + TypeScript
- **UI Framework**: Ant Design
- **Rich Text Editor**: Quill.js
- **Audio Recording**: MediaRecorder API (WebM/Opus codec)
- **Audio Player**: WaveSurfer.js
- **Build Tool**: Vite
- **PWA**: vite-plugin-pwa

## 📂 Project Structure

```
src/
├── components/          # React components
│   ├── MetadataPanel.tsx
│   ├── RecordingControls.tsx
│   ├── NotesEditor.tsx
│   └── AudioPlayer.tsx
├── services/            # Business logic
│   ├── audioRecorder.ts
│   ├── fileManager.ts
│   ├── metadataBuilder.ts
│   └── wordExporter.ts
├── hooks/               # Custom React hooks
├── types/               # TypeScript definitions
└── styles/              # CSS styles
```

## 🎯 Usage

1. **Select Folder** - Click "Select Folder" to choose where to save files (Chrome/Edge only)
2. **Start Recording** - Click red "Record" button to start audio capture
3. **Take Notes** - Type your notes in the editor
4. **Insert Timestamps** - Press ENTER while recording to add timestamp
5. **Stop Recording** - Click "Stop" to end recording and save files
6. **Playback** - Use audio player controls to review recording

### Keyboard Shortcuts

- `Enter` - Insert timestamp (during recording)
- `Ctrl+Enter` - Alternative timestamp shortcut
- `Space` - Play/Pause audio
- Double-click timestamp - Seek to audio position

## 📦 Output Files

After recording, the following files are saved:

- `Meeting_[timestamp].webm` - Audio recording (WebM/Opus format, highly compressed)
- `Meeting_[timestamp]_meeting_info.json` - Meeting metadata
- `Meeting_[timestamp]_metadata.json` - Notes with timestamps
- `Meeting_[timestamp].docx` - Word document export

### Metadata Format

**metadata.json structure:**
```json
{
  "ProjectName": "Meeting_2026-01-18T14-30-00",
  "Model": "Live Recording",
  "Language": "vi",
  "OriginalFileName": "Meeting_2026-01-18T14-30-00.webm",
  "AudioFileName": "Meeting_2026-01-18T14-30-00.webm",
  "Duration": "00:15:30.0000000",
  "Timestamps": [
    {
      "Index": 0,
      "Text": "Introduction and agenda",
      "StartTime": "00:00:15.000",
      "EndTime": "00:02:30.000",
      "Highlight": false
    }
  ]
}
```

**Meeting Info JSON:**
```json
{
  "MeetingTitle": "Weekly Team Meeting",
  "MeetingDate": "2026-01-18",
  "MeetingTime": "14:30",
  "Location": "Conference Room A",
  "Host": "John Doe",
  "Attendees": "Alice, Bob, Charlie",
  "CreatedAt": "2026-01-18T14:30:00.000Z"
}
```

## 🔧 Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Modern browser (Chrome/Edge recommended)

### Environment

No environment variables required. The app runs 100% client-side.

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## � Documentation

- **[📖 User Guide](USER_GUIDE.md)** - Hướng dẫn sử dụng đầy đủ
- **[🚀 Quick Start](QUICKSTART.md)** - Hướng dẫn cài đặt và sử dụng nhanh
- **[🔒 Privacy Policy](PRIVACY.md)** - Chính sách bảo mật và quyền riêng tư

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/nsmo-public/Web_MeetingNote/issues)
- **Discussions:** [GitHub Discussions](https://github.com/nsmo-public/Web_MeetingNote/discussions)
- **Demo:** [Live Demo](https://nsmo-public.github.io/Web_MeetingNote/)

---

**Made with ❤️ for better meeting notes**
