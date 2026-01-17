import React, { useState, useEffect } from 'react';
import { MetadataPanel } from './components/MetadataPanel';
import { RecordingControls } from './components/RecordingControls';
import { NotesEditor } from './components/NotesEditor';
import { AudioPlayer } from './components/AudioPlayer';
import { FileManagerService } from './services/fileManager';
import type { MeetingInfo } from './types/types';
import './styles/global.css';

export const App: React.FC = () => {
  const [folderPath, setFolderPath] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo>({
    title: `Meeting ${new Date().toISOString().split('T')[0]}`,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    location: '',
    host: '',
    attendees: ''
  });
  const [notes, setNotes] = useState<string>('');
  const [timestampMap, setTimestampMap] = useState<Map<number, number>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedNotesSnapshot, setSavedNotesSnapshot] = useState<string>('');

  // Check browser compatibility
  useEffect(() => {
    if (!FileManagerService.isSupported()) {
      console.warn(
        'File System Access API not supported. Files will be downloaded instead.'
      );
    }
  }, []);

  // Track unsaved changes
  useEffect(() => {
    // Có dữ liệu chưa lưu nếu:
    // 1. Đang recording
    // 2. Có audio/notes nhưng chưa save lần đầu
    // 3. Đã save nhưng notes bị sửa đổi
    const notesModified = isSaved && savedNotesSnapshot !== notes;
    const hasData = isRecording || (!isSaved && (audioBlob !== null || notes.trim().length > 0)) || notesModified;
    setHasUnsavedChanges(hasData);
  }, [isRecording, audioBlob, notes, isSaved, savedNotesSnapshot]);

  // Prevent accidental page close/reload when recording or has unsaved data
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        // Chuẩn modern browsers
        e.preventDefault();
        // Chrome requires returnValue to be set
        e.returnValue = 'Bạn có dữ liệu chưa lưu. Bạn có chắc muốn rời khỏi trang?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Clear unsaved changes flag after successful save
  const handleAudioBlobChange = (blob: Blob | null) => {
    setAudioBlob(blob);
  };

  const handleSaveComplete = () => {
    setIsSaved(true);
    setHasUnsavedChanges(false);
    setSavedNotesSnapshot(notes); // Save snapshot to detect future changes
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>📝 Live Meeting Notes</h1>
        <div className="status-indicator">
          {navigator.onLine ? '🌐 Online' : '📴 Offline'}
          {hasUnsavedChanges && <span className="unsaved-indicator" title="Bạn có dữ liệu chưa lưu">⚠️ Chưa lưu</span>}
        </div>
      </header>

      <MetadataPanel meetingInfo={meetingInfo} onChange={setMeetingInfo} />

      <RecordingControls
        folderPath={folderPath}
        onFolderSelect={setFolderPath}
        isRecording={isRecording}
        onRecordingChange={setIsRecording}
        onAudioBlobChange={handleAudioBlobChange}
        onSaveComplete={handleSaveComplete}
        meetingInfo={meetingInfo}
        notes={notes}
        timestampMap={timestampMap}
        audioBlob={audioBlob}
        isSaved={isSaved}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      <NotesEditor
        isRecording={isRecording}
        notes={notes}
        onNotesChange={setNotes}
        timestampMap={timestampMap}
        onTimestampMapChange={setTimestampMap}
      />

      <AudioPlayer audioBlob={audioBlob} />
    </div>
  );
};
