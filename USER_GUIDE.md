# 📚 LiveMeetingNote - Hướng dẫn sử dụng đầy đủ

## 🎯 Mục đích chương trình

**LiveMeetingNote** là ứng dụng web, giúp ghi chép cuộc họp với các khả năng:

- 🎙️ Ghi âm chất lượng cao và đánh dấu thời gian tự động
- 📴 Làm việc hoàn toàn offline
- 💾 Lưu trữ file trực tiếp vào máy tính
- 🌐 Tương thích đa nền tảng (Chrome, Edge, Firefox, Safari)
- 🔒 100% bảo mật - Không upload dữ liệu lên server

---

## ✨ Tính năng chi tiết

### 1. 🎙️ Ghi âm cuộc họp

- **Định dạng:** WAV chất lượng cao (44.1kHz stereo)
- **Thời lượng:** Không giới hạn
- **Hiển thị:** Real-time duration counter
- **Microphone:** Tự động chọn microphone mặc định của hệ thống

**Cách sử dụng:**
1. Click nút **"Record"** (màu đỏ)
2. Cho phép truy cập microphone khi trình duyệt yêu cầu
3. Bắt đầu nói và ghi chép
4. Click **"Stop"** để kết thúc ghi âm

### 2. ⏱️ Timestamp tự động

Timestamp giúp đánh dấu các thời điểm quan trọng trong cuộc họp để dễ dàng review sau này.

**Tính năng:**
- Nhấn **ENTER** trong khi ghi âm → chèn timestamp màu xanh `[HH:MM:SS]`
- Timestamp ghi lại chính xác thời điểm trong audio
- **Double-click** vào timestamp → tự động jump đến vị trí đó khi playback
- Timestamp được lưu trong metadata.json với độ chính xác millisecond

**Ví dụ:**
```
[00:02:15] Chủ tọa khai mạc cuộc họp
[00:05:30] Thảo luận về dự án Q1
[00:15:45] Quyết định phân công nhiệm vụ
```

### 3. 📝 Rich Text Editor

Editor hỗ trợ định dạng văn bản đa dạng như Microsoft Word:

**Toolbar:**
- **Bold** (Ctrl+B) - In đậm
- **Italic** (Ctrl+I) - In nghiêng
- **Underline** (Ctrl+U) - Gạch chân
- **Bullet list** - Danh sách dấu đầu dòng
- **Numbered list** - Danh sách đánh số
- **Text color** - Màu chữ
- **Background color** - Màu nền
- **Font size** - Kích thước chữ

**Tips:**
- Sử dụng màu để highlight các điểm quan trọng
- Dùng numbered list cho action items
- Dùng bullet list cho notes chung

### 4. 🎵 Audio Playback với WaveSurfer.js

Sau khi ghi âm hoặc load project, audio player hiển thị waveform đồ họa.

**Controls:**
- **Play/Pause** - Phát/Tạm dừng (hoặc nhấn Space)
- **Skip -10s** - Lùi 10 giây
- **Skip +10s** - Tiến 10 giây
- **Volume slider** - Điều chỉnh âm lượng
- **Zoom slider** - Phóng to/thu nhỏ waveform
- **Seek bar** - Kéo thả để jump đến vị trí bất kỳ

**Tương tác:**
- **Double-click** vào waveform → Seek đến vị trí đó
- **Right-click** vào waveform → Chèn timestamp tại vị trí đang nghe (hữu ích khi review)
- **Double-click** timestamp trong notes → Jump audio đến vị trí đó

### 5. 💾 Lưu trữ file tự động

#### Chrome/Edge (File System Access API):
1. Click **"Select Folder"** → Chọn thư mục lưu trữ
2. Cấp quyền write access cho folder
3. Khi save, files tự động lưu vào subfolder có format:
   ```
   YYYYMMDD_HHMM_[Meeting Title]/
   ```

**Ví dụ folder structure:**
```
📁 20260119_1430_Weekly_Team_Meeting/
├── 📄 20260119_1430_Weekly_Team_Meeting.wav
├── 📄 20260119_1430_Weekly_Team_Meeting_meeting_info.json
├── 📄 20260119_1430_Weekly_Team_Meeting_metadata.json
└── 📄 20260119_1430_Weekly_Team_Meeting.docx
```

#### Safari/Firefox (Download fallback):
- Files được download vào thư mục **Downloads** mặc định
- Bạn cần tự tổ chức files vào folder

**Output files:**
- **`.wav`** - File ghi âm
- **`_meeting_info.json`** - Metadata cuộc họp (title, date, host, attendees...)
- **`_metadata.json`** - Notes content + timestamp map (tương thích C# TranscriptionProject)
- **`.docx`** - Word document để chia sẻ qua email

### 6. 📂 Load Project

Load lại project đã lưu để tiếp tục chỉnh sửa.

**Cách sử dụng:**
1. Click nút **"Load Project"**
2. Chọn **folder** chứa project (folder có chứa các file .wav, .json)
3. Ứng dụng tự động load:
   - Meeting information
   - Notes content với timestamps
   - Audio file để playback
   - Timestamp map để seek

**Sau khi load:**
- Chỉnh sửa notes/meeting info tùy ý
- Click **"Save Changes"** → Tạo version mới với timestamp hiện tại
- Files mới sẽ không ghi đè files cũ (có timestamp khác nhau)

### 7. 🔄 Auto-backup & Recovery

Bảo vệ dữ liệu khỏi mất mát do sự cố.

**Cơ chế:**
- Tự động backup mỗi **3 giây** sau khi có thay đổi
- Backup lưu vào **localStorage** (meeting info, notes, timestamps) + **IndexedDB** (audio blob)
- Khi refresh page/đóng browser/crash → Hiện dialog khôi phục

**Dialog khôi phục:**
```
🔄 Khôi phục dữ liệu
Phát hiện dữ liệu tự động sao lưu từ 5 phút trước.
[✅ Khôi phục]  [🗑️ Bỏ qua]
```

**Khi nào backup bị xóa:**
- Khi click **Save** thành công
- Khi click **"Bỏ qua"** trong dialog

### 8. 📴 Offline Support (PWA)

Ứng dụng hoạt động 100% offline sau lần load đầu tiên.

**Service Worker:**
- Cache tất cả assets (HTML, CSS, JS, fonts, icons)
- Cache WaveSurfer.js, Quill.js, RecordRTC libraries
- Interceptor cho tất cả requests

**Cài đặt như app native:**
- Chrome/Edge: Click icon "Install" trên address bar
- Safari iOS: **Share** → **Add to Home Screen**
- Android: Banner "Add to Home screen" tự động hiện

**Status indicator:**
- 🌐 **Online** - Có kết nối internet
- 📴 **Offline** - Không có internet (vẫn hoạt động bình thường)

### 9. 🎤 Speech-to-Text (Chuyển đổi giọng nói sang văn bản)

Chuyển đổi giọng nói thành văn bản real-time trong quá trình ghi âm sử dụng **Google Web Speech API** (hoàn toàn miễn phí).

**Cấu hình:**
1. Click nút **"Cấu hình Speech-to-Text"** (chỉ hiện khi online)
2. Điền các thông tin:
   - **Language**: Chọn ngôn ngữ (Tiếng Việt, English, etc.)
   - **Max Alternatives**: Số lượng kết quả thay thế (1-5)
   - **Interim Results**: Bật để xem kết quả tạm thời
3. Click **"Lưu"**

**Sử dụng:**
- Bật toggle **"Tự động chuyển giọng nói thành văn bản: ON"** trước khi ghi âm
- Bắt đầu ghi âm → Nói vào microphone
- Kết quả hiện real-time trong panel **"Kết quả chuyển đổi giọng nói sang văn bản"**
- Panel tự động expand/collapse theo nội dung

**Các loại kết quả:**
- 🔵 **Tạm thời (Interim)**: Kết quả đang xử lý, có thể thay đổi
- 🟢 **Cuối cùng (Final)**: Kết quả đã xác định, không thay đổi
- 🟡 **Đã chỉnh sửa (Edited)**: User đã edit thủ công

**Chỉnh sửa transcription:**
1. **Double-click** vào segment → Mở edit mode
2. Chỉnh sửa:
   - **Text**: Nội dung văn bản
   - **Speaker**: Tên người nói
   - **Time**: Thời gian (format: `YYYY-MM-DD HH:MM:SS`)
   - **Audio Time**: Vị trí trên audio (format: `MM:SS` hoặc `H:MM:SS`)
3. Click **💾 Save** hoặc **❌ Cancel**

**Xóa segment:**
- Xóa toàn bộ text trong edit mode → Click Save
- Hiện dialog xác nhận xóa
- Click **"Xóa segment"** → Segment biến mất khỏi danh sách

**Seek audio:**
- **Double-click** vào **audio time tag** (📍 MM:SS) → Jump đến vị trí đó trên audio
- Không trigger edit mode

### 10. 🤖 AI Text Refinement (Chuẩn hóa văn bản bằng AI)

Sử dụng **Google Gemini AI** để chuẩn hóa và làm sạch kết quả chuyển đổi giọng nói.

**⚠️ YÊU CẦU:**
- Cần **Gemini API Key** (miễn phí)
- Cần kết nối internet
- **KHÔNG sử dụng với thông tin nhạy cảm** (dữ liệu gửi đến Google API)

**Lấy Gemini API Key (miễn phí):**
1. Truy cập: https://aistudio.google.com/app/apikey
2. Click **"Create API Key"**
3. Copy API key
4. Paste vào **Settings → Gemini API Key**
5. Hệ thống tự động tải danh sách models

**Chọn Gemini Model:**
- **Gemini 2.5 Flash** (Khuyên dùng): Nhanh, chất lượng tốt
- **Gemini 2.5 Pro**: Chất lượng cao hơn, chậm hơn
- **Gemini 2.0 Flash**: Cân bằng giữa tốc độ và chất lượng

**Sử dụng:**
1. Sau khi có kết quả chuyển đổi giọng nói
2. Click nút **"🤖 Chuẩn hóa bằng AI"** trong header của Transcription Panel
3. Đọc kỹ **cảnh báo bảo mật:**
   - ⚠️ Dữ liệu sẽ gửi đến Google Gemini API
   - 🚫 **KHÔNG dùng** với:
     - Mật khẩu, số tài khoản, thông tin tài chính
     - Thông tin y tế cá nhân (bệnh án, đơn thuốc...)
     - CCCD/CMND, địa chỉ, số điện thoại nhạy cảm
     - Bí mật thương mại, kế hoạch kinh doanh
     - API keys, tokens, credentials
4. Click **"Đồng ý, tiếp tục"**
5. Đợi AI xử lý (hiện progress bar)
6. Kết quả được thay thế toàn bộ transcription hiện tại

**AI sẽ thực hiện:**
- ✅ Sửa lỗi nhận diện từ Web Speech API
- ✅ Loại bỏ từ thừa, từ đệm (à, ừm, thì, là, mà...)
- ✅ Thêm dấu câu đúng quy tắc (dấu chấm, phẩy, hỏi, than...)
- ✅ Viết hoa chính xác (đầu câu, danh từ riêng, chức danh...)
- ✅ Gộp các đoạn liên quan thành câu hoàn chỉnh

**Dữ liệu gửi đến AI:**
- **Primary**: Transcriptions (có thể đã được user edit → độ tin cậy cao)
- **Supplementary**: Raw transcripts (output gốc từ Web Speech API → chỉ tham khảo metadata)

**Sau khi refine:**
- Segments được đánh dấu **"🤖 AI"**
- Có thể **edit lại** nếu cần
- **Save project** → Lưu cả raw transcripts để refine lại sau

**Tips:**
- Review kết quả trước khi save
- Có thể refine nhiều lần với model khác nhau
- Khi load project cũ, raw transcripts được giữ nguyên để refine lại

### 11. ⚠️ Unsaved Changes Warning

Bảo vệ dữ liệu chưa lưu.

**Indicators:**
- Icon **⚠️ Chưa lưu** hiển thị trên header khi có thay đổi
- Cảnh báo khi đóng tab/refresh page:
  ```
  Bạn có dữ liệu chưa lưu. Bạn có chắc muốn rời khỏi trang?
  ```

**Trạng thái:**
1. **Recording** → Unsaved (đang ghi âm)
2. **Has audio/notes** → Unsaved (có dữ liệu chưa save lần đầu)
3. **Saved** → No warning (đã save)
4. **Modified after save** → Unsaved (chỉnh sửa sau khi save)

---

## 🎮 Workflow sử dụng

### Scenario 1: Ghi âm cuộc họp mới

```
1. Click "Select Folder" → Chọn thư mục lưu file
2. Điền thông tin cuộc họp:
   - Meeting Title: "Weekly Team Meeting"
   - Date: 2026-01-19
   - Time: 14:30
   - Location: "Conference Room A"
   - Host: "John Doe"
   - Attendees: "Alice, Bob, Charlie"
3. Click "Record" → Bắt đầu ghi âm
4. Gõ notes, nhấn ENTER để chèn timestamp khi có điểm quan trọng
5. Click "Stop" → Files tự động lưu vào folder
6. Review: Playback audio, double-click timestamp để seek
```

### Scenario 2: Chỉ ghi chép không ghi âm

```
1. Click "Select Folder" (optional - có thể bỏ qua nếu dùng Safari/Firefox)
2. Điền thông tin cuộc họp
3. Gõ notes (KHÔNG nhấn Record)
4. Click "Save Notes" → Lưu meeting_info.json + metadata.json + .docx
   (Không có file .wav)
```

### Scenario 3: Load project cũ để chỉnh sửa

```
1. Click "Load Project" → Chọn folder project cũ
   (Ví dụ: 20260119_1430_Weekly_Team_Meeting/)
2. Dữ liệu tự động load lên form
3. Chỉnh sửa notes/meeting info
4. Click "Save Changes" → Tạo version mới:
   20260119_1530_Weekly_Team_Meeting/ (timestamp mới)
```

---

## 📊 Định dạng dữ liệu

### meeting_info.json

```json
{
  "MeetingTitle": "Weekly Team Meeting",
  "MeetingDate": "2026-01-19",
  "MeetingTime": "14:30",
  "Location": "Conference Room A",
  "Host": "John Doe",
  "Attendees": "Alice, Bob, Charlie",
  "CreatedAt": "2026-01-19T14:30:00.000Z"
}
```

### metadata.json

```json
{
  "ProjectName": "20260119_1430_Weekly_Team_Meeting",
  "Model": "Live Recording",
  "Language": "vi",
  "AudioFileName": "20260119_1430_Weekly_Team_Meeting.wav",
  "Duration": "00:15:30.5000000",
  "RecordingStartTime": "2026-01-19T14:30:00.000Z",
  "Timestamps": [
    {
      "Index": 0,
      "Text": "Opening remarks and agenda review",
      "DateTime": "2026-01-19T14:30:15.500Z",
      "StartTime": "00:00:15.5000000",
      "EndTime": "00:02:30.2500000",
      "Highlight": false
    },
    {
      "Index": 1,
      "Text": "Discussion on Q1 project goals",
      "DateTime": "2026-01-19T14:32:30.250Z",
      "StartTime": "00:02:30.2500000",
      "EndTime": "00:05:45.7500000",
      "Highlight": false
    }
  ]
}
```

**Lưu ý:** Format tương thích với C# TranscriptionProject để import vào hệ thống khác.

---

## ⌨️ Keyboard Shortcuts

| Phím | Chức năng |
|------|-----------|
| `Enter` | Insert timestamp (khi đang recording) |
| `Ctrl+B` | Bold text |
| `Ctrl+I` | Italic text |
| `Ctrl+U` | Underline text |
| `Space` | Play/Pause audio (khi focus player) |

## 🖱️ Mouse Actions

| Action | Chức năng |
|--------|-----------|
| **Double-click timestamp** | Seek audio đến vị trí đó |
| **Double-click waveform** | Seek đến vị trí click |
| **Right-click waveform** | Insert timestamp tại vị trí đang nghe |

---

## 💡 Use Cases

### 1. Cuộc họp nội bộ
- Ghi âm toàn bộ cuộc họp
- Đánh dấu các quyết định quan trọng bằng timestamp
- Export Word document để gửi email tổng kết

### 2. Phỏng vấn ứng viên
- Ghi âm câu hỏi - trả lời
- Ghi chú đánh giá kèm timestamp
- Review lại các câu trả lời bằng audio playback

### 3. Training/Workshop
- Ghi âm bài giảng
- Note các key points với timestamp
- Chia sẻ file cho người vắng mặt

### 4. Họp khách hàng
- Ghi âm yêu cầu của khách hàng
- Timestamp các thỏa thuận quan trọng
- Lưu trữ làm tài liệu pháp lý

### 5. Remote teams
- Ghi âm meeting online (qua screen recorder)
- Ghi chép action items
- Chia sẻ notes + audio cho timezone khác

---

## 🔧 Troubleshooting

### Microphone không hoạt động
**Nguyên nhân:** Browser chưa được cấp quyền microphone
**Giải pháp:**
1. Click icon 🔒 trên address bar
2. Chọn "Site settings"
3. Microphone → Allow

### File không lưu được (Chrome/Edge)
**Nguyên nhân:** Chưa cấp quyền write cho folder
**Giải pháp:**
1. Click "Select Folder" lại
2. Chọn folder
3. Click "View files" → Allow

### Audio không play được
**Nguyên nhân:** Browser không hỗ trợ WAV format
**Giải pháp:**
- Cập nhật browser lên version mới nhất
- Sử dụng Chrome/Edge

### Backup không khôi phục được
**Nguyên nhân:** localStorage bị xóa hoặc audio blob quá lớn
**Giải pháp:**
- Audio dài hơn 1 giờ có thể không backup được
- Khuyến nghị: Save định kỳ mỗi 15-20 phút

---

## ⚡ Performance Tips

- **Bundle size:** ~2MB (minified)
- **Audio recording:** Real-time, không lag
- **File save:** Instant (Chrome/Edge với File System Access API)
- **Recommended:** Chrome 90+ hoặc Edge 90+ để có trải nghiệm tốt nhất

---

## 📞 Support & Feedback

- **GitHub Issues:** [https://github.com/nsmo-public/LiveMeetingNotes/issues](https://github.com/nsmo-public/Web_MeetingNote/issues)
- **Discussions:** [https://github.com/nsmo-public/LiveMeetingNotes/discussions](https://github.com/nsmo-public/Web_MeetingNote/discussions)
- **Documentation:** [README.md](README.md) | [QUICKSTART.md](QUICKSTART.md) | [PRIVACY.md](PRIVACY.md)

---

## 🎉 Kết luận

**LiveMeetingNote** là giải pháp ghi chép cuộc họp:
- ✅ Chuyên nghiệp
- ✅ Miễn phí
- ✅ Bảo mật (100% client-side)
- ✅ Offline-capable
- ✅ Cross-platform

Phù hợp cho doanh nghiệp, teams, freelancers, giáo dục và bất kỳ ai cần ghi âm + ghi chép có tổ chức.

**Happy note-taking! 📝🎙️**
