import React, { useState, useEffect, useRef } from 'react';
import { MetadataPanel } from './components/MetadataPanel';
import { RecordingControls } from './components/RecordingControls';
import { NotesEditor } from './components/NotesEditor';
import { AudioPlayer } from './components/AudioPlayer';
import { FileManagerService } from './services/fileManager';
import { saveBackup, loadBackup, clearBackup, hasBackup, getBackupAge } from './services/autoBackup';
import type { MeetingInfo } from './types/types';
import './styles/global.css';

export const App: React.FC = () => {
  const [folderPath, setFolderPath] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo>({
    title: `${new Date().toISOString().split('T')[0]} _ `,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    location: '',
    host: '',
    attendees: ''
  });
  const [notes, setNotes] = useState<string>('');
  const [timestampMap, setTimestampMap] = useState<Map<number, number>>(new Map());
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedNotesSnapshot, setSavedNotesSnapshot] = useState<string>('');
  const [isLiveMode, setIsLiveMode] = useState(true); // true = live recording, false = loaded project
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [backupAge, setBackupAge] = useState<number | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check browser compatibility
  useEffect(() => {
    if (!FileManagerService.isSupported()) {
      console.warn(
        'File System Access API not supported. Files will be downloaded instead.'
      );
    }
  }, []);
  
  // Check for existing backup on mount
  useEffect(() => {
    const checkBackup = async () => {
      if (hasBackup()) {
        const age = getBackupAge();
        setBackupAge(age);
        setShowBackupDialog(true);
      }
    };
    checkBackup();
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
  
  // Auto-save to localStorage with debounce (every 3 seconds after changes)
  useEffect(() => {
    // Auto-save whenever there are unsaved changes (including after first save)
    // Backup will be cleared only when user explicitly saves
    if (hasUnsavedChanges) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        const meetingInfoForBackup = {
          projectName: meetingInfo.title,
          location: meetingInfo.location,
          participants: meetingInfo.attendees
        };
        
        saveBackup(
          meetingInfoForBackup,
          notes,
          timestampMap,
          recordingStartTime,
          audioBlob,
          isSaved
        );
      }, 3000); // Auto-save 3 seconds after last change
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [meetingInfo, notes, timestampMap, recordingStartTime, audioBlob, hasUnsavedChanges, isSaved]);

  // Switch to live mode when starting a new recording
  useEffect(() => {
    if (isRecording) {
      setIsLiveMode(true);
    }
  }, [isRecording]);

  // Debug: Log when meetingInfo changes
  useEffect(() => {
    console.log('📝 App meetingInfo state updated:', meetingInfo);
  }, [meetingInfo]);

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
    // Clear auto-backup after successful save
    clearBackup();
  };
  
  const handleRestoreBackup = async () => {
    const backup = await loadBackup();
    if (backup) {
      setMeetingInfo({
        title: backup.meetingInfo.projectName,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        location: backup.meetingInfo.location,
        host: '',
        attendees: backup.meetingInfo.participants
      });
      setNotes(backup.notes);
      setTimestampMap(backup.timestampMap);
      setRecordingStartTime(backup.recordingStartTime);
      if (backup.audioBlob) {
        setAudioBlob(backup.audioBlob);
      }
      setIsSaved(backup.isSaved);
      setShowBackupDialog(false);
      console.log('✅ Backup restored successfully');
    }
  };
  
  const handleDiscardBackup = async () => {
    await clearBackup();
    setShowBackupDialog(false);
    console.log('🗑️ Backup discarded');
  };

  const handleLoadProject = (loadedData: {
    meetingInfo: MeetingInfo;
    notes: string;
    timestampMap: Map<number, number>;
    audioBlob: Blob;
    recordingStartTime: number;
  }) => {
    console.log('📂 App.handleLoadProject - Data received:', {
      meetingInfo: loadedData.meetingInfo,
      notesLength: loadedData.notes.length,
      timestampMapSize: loadedData.timestampMap.size,
      audioBlobSize: loadedData.audioBlob.size
    });
    
    setMeetingInfo(loadedData.meetingInfo);
    setNotes(loadedData.notes);
    setTimestampMap(loadedData.timestampMap);
    setAudioBlob(loadedData.audioBlob);
    setRecordingStartTime(loadedData.recordingStartTime);
    setIsSaved(true);
    setHasUnsavedChanges(false);
    setSavedNotesSnapshot(loadedData.notes);
    setIsLiveMode(false); // Switch to timestamp mode when loading project
  };

  return (
    <div className="app-container">
      {/* Backup Restoration Dialog */}
      {showBackupDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#1e1e1e',
            border: '2px solid #ffa500',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{ marginTop: 0, color: '#ffa500' }}>🔄 Khôi phục dữ liệu</h2>
            <p style={{ fontSize: '16px', lineHeight: '1.6' }}>
              Phát hiện dữ liệu tự động sao lưu từ <strong>{backupAge !== null ? `${backupAge} phút` : 'một lúc'}</strong> trước.
              <br/>
              Có thể trình duyệt đã bị đóng đột ngột hoặc bạn chưa lưu dữ liệu.
            </p>
            <p style={{ fontSize: '14px', color: '#888' }}>
              Bạn có muốn khôi phục dữ liệu này không?
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                onClick={handleRestoreBackup}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  backgroundColor: '#1890ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ✅ Khôi phục
              </button>
              <button
                onClick={handleDiscardBackup}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  backgroundColor: '#434343',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                🗑️ Bỏ qua
              </button>
            </div>
          </div>
        </div>
      )}
      
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
        onLoadProject={handleLoadProject}
        meetingInfo={meetingInfo}
        notes={notes}
        timestampMap={timestampMap}
        recordingStartTime={recordingStartTime}
        onRecordingStartTimeChange={setRecordingStartTime}
        audioBlob={audioBlob}
        isSaved={isSaved}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      <NotesEditor
        notes={notes}
        onNotesChange={setNotes}
        timestampMap={timestampMap}
        onTimestampMapChange={setTimestampMap}
        recordingStartTime={recordingStartTime}
        isLiveMode={isLiveMode}
      />

      <AudioPlayer audioBlob={audioBlob} />
    </div>
  );
};
