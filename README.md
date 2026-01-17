# 📝 LiveMeetingNote Web Application

> Progressive Web Application (PWA) for live meeting note-taking with audio recording

## ✨ Features

- 🎙️ **Audio Recording** - Record meetings with microphone (MediaRecorder API)
- ⏱️ **Real-time Timestamps** - Press ENTER to insert timestamp during recording
- 📝 **Rich Text Editor** - Format notes with Quill.js editor
- 🎯 **Timestamp Seeking** - Double-click timestamp to jump to audio position
- 💾 **Local File Storage** - Save audio (.wav), notes, and metadata (.json) to disk
- 📴 **Offline Support** - Works 100% offline after first load
- 🌐 **Cross-Platform** - Runs on any modern browser (Chrome, Edge, Firefox, Safari)

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
- **Audio Recording**: RecordRTC / MediaRecorder API
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
│   └── metadataBuilder.ts
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

- `Meeting_[timestamp].wav` - Audio recording (WAV format)
- `Meeting_[timestamp]_meeting_info.json` - Meeting metadata
- `Meeting_[timestamp]_transcription.json` - Notes with timestamps

### Metadata Format

Compatible with existing MeetingTrace C# TranscriptionProject format:

```json
{
  "MeetingTitle": "Project Planning",
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

## 📞 Support

For issues or questions, please open a GitHub issue.
