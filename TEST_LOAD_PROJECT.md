# Test Case: Load Project

## Mô tả vấn đề
Các file `*_metadata.json` và `*_meeting_info.json` có đầy đủ thông tin nhưng không hiển thị lên form.

## Nguyên nhân đã phát hiện

### 1. Lỗi reconstruct timestampMap
**Vị trí**: `RecordingControls.tsx` dòng ~346-365

**Vấn đề**: Position của timestamp được tính SAU khi thêm text, nhưng logic ban đầu trong NotesEditor set position ở ĐẦU mỗi block.

**Cách sửa**: Di chuyển việc tính position và set timestampMap ra TRƯỚC khi thêm text vào notesText.

```typescript
// TRƯỚC (SAI):
notesText += ts.Text || '';
const position = notesText.length; // Position ở cuối block
timestampMapData.set(position, datetime);

// SAU (ĐÚNG):
const position = notesText.length; // Position ở đầu block
timestampMapData.set(position, datetime);
notesText += ts.Text || '';
```

### 2. Cần thêm debug logs
Để trace dữ liệu qua các component, đã thêm console.log ở:
- `fileManager.loadProjectFromFolder()`: Log dữ liệu raw từ file
- `RecordingControls.handleLoadProject()`: Log mapping PascalCase → camelCase
- `App.handleLoadProject()`: Log khi receive và update state
- `MetadataPanel useEffect`: Log khi props thay đổi

## Cách test

1. **Tạo một project mới**:
   - Click "Select Folder" chọn thư mục
   - Nhập thông tin Meeting (title, date, time, location, host, attendees)
   - Click "Record", đợi vài giây, click "Stop"
   - Kiểm tra thư mục đã có folder mới với 4 files:
     - `*.wav` - file audio
     - `*_meeting_info.json` - thông tin meeting
     - `*_metadata.json` - metadata với timestamps
     - `*.docx` - file Word

2. **Test Load Project**:
   - Refresh trang (hoặc clear dữ liệu hiện tại)
   - Click "Load Project"
   - Chọn thư mục project đã tạo ở bước 1
   - **Kiểm tra**:
     - Form "Meeting Information" hiển thị đầy đủ thông tin
     - Notes Editor hiển thị đúng nội dung
     - Audio player có file audio
     - Timestamps được hiển thị đúng

3. **Kiểm tra console logs**:
   ```
   Loading project from folder: [tên folder]
   Loaded meeting_info.json: {...}
   Loaded metadata.json: {...}
   Mapping meetingInfo: { rawData: {...}, mapped: {...} }
   App.handleLoadProject received: {...}
   MetadataPanel received meetingInfo: {...}
   ```

## Expected Output

Sau khi load project:
- **Meeting Title**: Hiển thị đúng tiêu đề
- **Date**: Hiển thị đúng ngày
- **Time**: Hiển thị đúng giờ
- **Location**: Hiển thị địa điểm
- **Host**: Hiển thị người chủ trì
- **Attendees**: Hiển thị danh sách người tham gia
- **Notes**: Hiển thị các ghi chú với timestamps
- **Audio**: Có thể play lại audio

## File Structure mẫu

```
20260119_1430_Weekly_Meeting/
├── 20260119_1430_Weekly_Meeting.wav
├── 20260119_1430_Weekly_Meeting_meeting_info.json
├── 20260119_1430_Weekly_Meeting_metadata.json
└── 20260119_1430_Weekly_Meeting.docx
```

### meeting_info.json format:
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

### metadata.json format:
```json
{
  "ProjectName": "20260119_1430_Weekly_Meeting",
  "Model": "Live Recording",
  "Language": "vi",
  "OriginalFileName": "20260119_1430_Weekly_Meeting.wav",
  "AudioFileName": "20260119_1430_Weekly_Meeting.wav",
  "Duration": "00:02:30.500",
  "Timestamps": [
    {
      "Index": 0,
      "Text": "First note",
      "DateTime": "2026-01-19T14:30:00.000Z",
      "StartTime": "00:00:00.000",
      "EndTime": "00:00:15.000",
      "Highlight": false
    }
  ]
}
```
