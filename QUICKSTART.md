# 🚀 LiveMeetingNote - Quick Start Guide

## ✅ Cài đặt thành công!

Dự án đã được thiết lập hoàn chỉnh với tất cả các tính năng sau:

### 📦 Features đã triển khai:
- ✅ Audio Recording với MediaRecorder API
- ✅ Speech-to-Text real-time với Web Speech API (miễn phí)
- ✅ AI Text Refinement với Google Gemini API (miễn phí)
- ✅ Real-time timestamp insertion (nhấn ENTER khi đang record)
- ✅ Rich Text Editor với Quill.js
- ✅ Audio Playback với controls (-10s, +10s, seekbar)
- ✅ Double-click audio time tag để seek
- ✅ Edit/Delete transcription segments
- ✅ File System Access API để lưu file trực tiếp vào folder (Chrome/Edge)
- ✅ Download fallback cho Safari/Firefox
- ✅ PWA support (offline capable - trừ AI refinement)
- ✅ Dark theme UI với Ant Design
- ✅ Metadata format tương thích với C# TranscriptionProject
- ✅ Auto-save raw transcripts cho AI refinement

---

## 🎮 Hướng dẫn sử dụng

### 1️⃣ Chạy Development Server

```bash
npm run dev
```

Mở browser tại: **http://localhost:5173/**

### 2️⃣ Sử dụng ứng dụng

#### A. Chuẩn bị:
1. **Chọn Folder** - Click nút "Select Folder" để chọn thư mục lưu file (Chrome/Edge only)
   - Safari/Firefox: Files sẽ được download thay vì lưu trực tiếp

2. **Điền Meeting Info** - Nhập thông tin cuộc họp:
   - Meeting Title
   - Date & Time
   - Location
   - Host
   - Attendees

3. **Cấu hình Speech-to-Text (Optional)** - Nếu muốn chuyển đổi giọng nói sang văn bản:
   - Click **"Cấu hình Speech-to-Text"**
   - Chọn ngôn ngữ (Tiếng Việt, English...)
   - Click **"Lưu"**
   - Bật toggle **"Tự động chuyển giọng nói thành văn bản: ON"**

4. **Cấu hình AI Refinement (Optional)** - Nếu muốn dùng AI chuẩn hóa văn bản:
   - Lấy API Key miễn phí: https://aistudio.google.com/app/apikey
   - Paste vào **Settings → Gemini API Key**
   - Chọn Model (khuyên dùng: **Gemini 2.5 Flash**)
   - ⚠️ **Lưu ý:** Không dùng với thông tin nhạy cảm

#### B. Recording:
1. **Start Recording** - Click nút đỏ "Record"
   - Cho phép microphone permission khi được yêu cầu
   - Timer sẽ bắt đầu đếm
   - Nếu bật Speech-to-Text → Kết quả hiện real-time

2. **Take Notes** - Gõ notes vào editor
   - **Nhấn ENTER** để chèn timestamp (màu xanh)
   - Timestamp format: `[HH:MM:SS]`
   - Sử dụng formatting toolbar (Bold, Italic, Colors)

3. **Edit Transcriptions** - Nếu có Speech-to-Text:
   - **Double-click** vào segment để edit
   - Chỉnh sửa text, speaker, time
   - Xóa toàn bộ text → Click Save → Xóa segment
   - **Double-click audio time tag** (📍 MM:SS) → Seek audio

4. **AI Refinement** - Nếu đã cấu hình Gemini:
   - Click **"🤖 Chuẩn hóa bằng AI"** trong header Transcription Panel
   - Đọc kỹ cảnh báo bảo mật
   - Click **"Đồng ý, tiếp tục"**
   - Đợi AI xử lý → Kết quả được chuẩn hóa

5. **Stop Recording** - Click nút "Stop"
   - Files sẽ được lưu tự động:
     - `[timestamp]_[Title].webm` - Audio file
     - `[timestamp]_[Title]_meeting_info.json` - Meeting metadata
     - `[timestamp]_[Title]_metadata.json` - Notes với timestamps
     - `[timestamp]_[Title]_transcription.json` - Transcriptions
     - `[timestamp]_[Title]_rawTranscripts.json` - Raw data cho AI
     - `[timestamp]_[Title].docx` - Word document

#### C. Playback:
1. Sau khi stop recording, audio player sẽ hiển thị
2. **Play/Pause** - Click để phát/tạm dừng
3. **Skip** - Click -10s hoặc +10s để tua
4. **Seek** - Kéo seekbar hoặc:
   - **Double-click vào timestamp** trong notes
   - **Double-click audio time tag** trong transcriptions

---

## 🌐 Browser Support

| Browser | Recording | File Save | PWA Install | Offline |
|---------|-----------|-----------|-------------|---------|
| **Chrome 86+** | ✅ | ✅ Direct | ✅ | ✅ |
| **Edge 86+** | ✅ | ✅ Direct | ✅ | ✅ |
| **Firefox** | ✅ | ⚠️ Download | ✅ | ✅ |
| **Safari 14.1+** | ✅ | ⚠️ Download | ✅ | ✅ |

### Recommended: **Chrome** hoặc **Edge** để có trải nghiệm tốt nhất (lưu file trực tiếp vào folder)

---

## 📦 Build & Deploy

### Build for Production:
```bash
npm run build
```

Output: `dist/` folder

### Deploy to GitHub Pages:
```bash
npm run deploy
```

### Deploy to Netlify:
```bash
netlify deploy --prod --dir=dist
```

### Deploy to Vercel:
```bash
vercel --prod
```

---

## 🔧 Troubleshooting

### ❌ Microphone không hoạt động:
1. Kiểm tra browser permissions (Settings > Privacy > Microphone)
2. Đảm bảo đang dùng HTTPS (hoặc localhost)
3. Kiểm tra microphone có được kết nối không

### ❌ Không lưu được file:
1. **Chrome/Edge**: Đảm bảo đã click "Select Folder" trước khi record
2. **Safari/Firefox**: Files sẽ được download - check Downloads folder
3. Kiểm tra browser permissions cho file access

### ❌ Timestamp không insert:
1. Đảm bảo đang trong recording mode (nút "Stop" đang hiển thị)
2. Click vào editor để focus
3. Nhấn ENTER (không phải Shift+Enter)

### ❌ Audio không playback:
1. Đảm bảo đã stop recording trước
2. Kiểm tra audio file có được tạo không
3. Thử refresh page

---

## 🎨 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Insert timestamp (during recording) |
| `Ctrl+B` | Bold text |
| `Ctrl+I` | Italic text |
| `Ctrl+U` | Underline text |
| `Space` | Play/Pause audio (when focused on player) |
| Double-click timestamp | Seek to audio position |

---

## 📝 File Format

### Meeting Info JSON:
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

### Metadata JSON (metadata.json):
```json
{
  "ProjectName": "Meeting_2026-01-18T14-30-00",
  "Model": "Live Recording",
  "Language": "vi",
  "OriginalFileName": "Meeting_2026-01-18T14-30-00.wav",
  "AudioFileName": "Meeting_2026-01-18T14-30-00.wav",
  "Duration": "00:15:30.0000000",
  "Timestamps": [
    {
      "Index": 0,
      "Text": "Introduction and agenda",
      "StartTime": "00:00:15.000",
      "EndTime": "00:02:30.000",
      "Highlight": false
    },
    {
      "Index": 1,
      "Text": "Project timeline discussion",
      "StartTime": "00:02:30.500",
      "EndTime": "00:05:45.250",
      "Highlight": false
    }
  ]
}
```

**100% tương thích với cấu trúc metadata mới!**

---

## 🎯 Next Steps

### Phase 2 Enhancements (Optional):
- [ ] Add RTF export support
- [ ] Implement WaveSurfer.js waveform visualization
- [ ] Add IndexedDB caching for drafts
- [ ] Support multiple language UI (i18n)
- [ ] Add keyboard shortcuts panel
- [ ] Implement auto-save drafts
- [ ] Add export to PDF

### Testing:
- [ ] Test trên Chrome/Edge với File System Access
- [ ] Test trên Safari/Firefox với download fallback
- [ ] Test trên mobile browsers
- [ ] Test với recordings > 1 hour
- [ ] Test offline functionality

---

## 📞 Support

Nếu gặp vấn đề, check:
1. Browser console (F12) để xem errors
2. Network tab để check API calls
3. Application tab để check Service Worker status

---

## 🎉 Chúc mừng!

Bạn đã có một PWA hoàn chỉnh để ghi âm meeting với timestamps!

**Enjoy your LiveMeetingNote Web App! 🚀📝🎙️**
