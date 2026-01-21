import React, { useState, useEffect, useRef } from 'react';
import { MetadataPanel } from './components/MetadataPanel';
import { RecordingControls } from './components/RecordingControls';
import { NotesEditor } from './components/NotesEditor';
import { AudioPlayer, AudioPlayerRef } from './components/AudioPlayer';
import { HelpButton } from './components/HelpButton';
import { TranscriptionConfig } from './components/TranscriptionConfig';
import { TranscriptionPanel } from './components/TranscriptionPanel';
import { FileManagerService } from './services/fileManager';
import { saveBackup, loadBackup, clearBackup, hasBackup, getBackupAge } from './services/autoBackup';
import { speechToTextService, SpeechToTextService } from './services/speechToText';
import type { MeetingInfo, SpeechToTextConfig, TranscriptionResult } from './types/types';
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
  const [speakersMap, setSpeakersMap] = useState<Map<number, string>>(new Map());
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedNotesSnapshot, setSavedNotesSnapshot] = useState<string>('');
  const [isLiveMode, setIsLiveMode] = useState(true); // true = live recording, false = loaded project
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [backupAge, setBackupAge] = useState<number | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<AudioPlayerRef>(null);
  
  // Speech-to-Text states
  const [showTranscriptionConfig, setShowTranscriptionConfig] = useState(false);
  const [transcriptionConfig, setTranscriptionConfig] = useState<SpeechToTextConfig | null>(null);
  const [transcriptions, setTranscriptions] = useState<TranscriptionResult[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Check browser compatibility
  useEffect(() => {
    if (!FileManagerService.isSupported()) {
      console.warn(
        'File System Access API not supported. Files will be downloaded instead.'
      );
    }
  }, []);
  
  // Load Speech-to-Text config on mount
  useEffect(() => {
    const savedConfig = SpeechToTextService.loadConfig();
    if (savedConfig) {
      setTranscriptionConfig(savedConfig);
      speechToTextService.initialize(savedConfig);
      console.log('🎤 Speech-to-Text config loaded');
    }
  }, []);
  
  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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
    speakersMap: Map<number, string>;
    audioBlob: Blob | null;
    recordingStartTime: number;
  }) => {
    console.log('📂 App.handleLoadProject - Data received:', {
      meetingInfo: loadedData.meetingInfo,
      notesLength: loadedData.notes.length,
      timestampMapSize: loadedData.timestampMap.size,
      speakersMapSize: loadedData.speakersMap.size,
      audioBlobSize: loadedData.audioBlob?.size || 0,
      hasAudio: loadedData.audioBlob !== null
    });
    
    setMeetingInfo(loadedData.meetingInfo);
    setNotes(loadedData.notes);
    setTimestampMap(loadedData.timestampMap);
    setSpeakersMap(loadedData.speakersMap);
    setAudioBlob(loadedData.audioBlob);
    setRecordingStartTime(loadedData.recordingStartTime);
    setIsSaved(true);
    setHasUnsavedChanges(false);
    setSavedNotesSnapshot(loadedData.notes);
    setIsLiveMode(false); // Switch to timestamp mode when loading project
  };

  // Handle transcription config save
  const handleSaveTranscriptionConfig = (config: SpeechToTextConfig) => {
    setTranscriptionConfig(config);
    speechToTextService.initialize(config);
    console.log('✅ Transcription config updated');
  };

  // Handle new transcription result
  const handleNewTranscription = (result: TranscriptionResult) => {
    setTranscriptions(prev => {
      // Nếu là kết quả final
      if (result.isFinal) {
        // Loại bỏ kết quả tạm thời (nếu có)
        const finalResults = prev.filter(item => item.isFinal);
        
        // Kiểm tra xem kết quả mới có phải là phiên bản mở rộng của kết quả cũ không
        // Nếu kết quả cuối cùng chứa hầu hết text của kết quả mới hoặc ngược lại
        if (finalResults.length > 0) {
          const lastResult = finalResults[finalResults.length - 1];
          const newText = result.text.trim().toLowerCase();
          const lastText = lastResult.text.trim().toLowerCase();
          
          // Case 1: Kết quả mới là phiên bản mở rộng của kết quả cũ
          // VD: Cũ: "như vậy là", Mới: "như vậy là cái mẫu"
          if (newText.startsWith(lastText) && newText.length > lastText.length) {
            console.log('🔄 Replacing with extended version:', {
              old: lastText.substring(0, 50) + '...',
              new: newText.substring(0, 50) + '...'
            });
            // Thay thế kết quả cũ bằng kết quả mới
            finalResults[finalResults.length - 1] = result;
            return finalResults;
          }
          
          // Case 2: Kết quả cũ là phiên bản mở rộng của kết quả mới → bỏ qua kết quả mới
          // VD: Cũ: "như vậy là cái mẫu", Mới: "như vậy là"
          if (lastText.startsWith(newText)) {
            console.log('⏭️ Skipping shorter duplicate');
            return prev; // Giữ nguyên
          }
          
          // Case 3: Kiểm tra độ tương đồng cao (>80% giống nhau)
          const similarity = calculateSimilarity(newText, lastText);
          if (similarity > 0.8) {
            console.log('⏭️ Skipping similar result (similarity: ' + (similarity * 100).toFixed(0) + '%)');
            return prev;
          }
        }
        
        // Thêm kết quả mới
        return [...finalResults, result];
      } else {
        // Nếu là kết quả tạm thời, chỉ giữ 1 kết quả tạm thời mới nhất
        const finalResults = prev.filter(item => item.isFinal);
        return [...finalResults, result];
      }
    });
    
    if (result.isFinal) {
      console.log('✅ Final transcription:', result.text.substring(0, 50) + '...');
    }
  };

  // Calculate text similarity (Levenshtein-based)
  const calculateSimilarity = (text1: string, text2: string): number => {
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;
    
    if (longer.length === 0) return 1.0;
    
    // Quick check: if one contains the other
    if (longer.includes(shorter)) {
      return shorter.length / longer.length;
    }
    
    // Simple word-based similarity
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w)).length;
    
    return (2 * commonWords) / (words1.length + words2.length);
  };

  // Handle seek to audio time
  const handleSeekToAudio = (timeMs: number) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.seekTo(timeMs);
      console.log(`⏭️ Seeking to ${(timeMs / 1000).toFixed(2)}s`);
    }
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
          <HelpButton />
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
        speakersMap={speakersMap}
        recordingStartTime={recordingStartTime}
        onRecordingStartTimeChange={setRecordingStartTime}
        audioBlob={audioBlob}
        isSaved={isSaved}
        hasUnsavedChanges={hasUnsavedChanges}
        onShowTranscriptionConfig={() => setShowTranscriptionConfig(true)}
        transcriptionConfig={transcriptionConfig}
        onNewTranscription={handleNewTranscription}
        onClearTranscriptions={() => setTranscriptions([])}
        transcriptions={transcriptions}
      />

      <NotesEditor
        notes={notes}
        onNotesChange={setNotes}
        timestampMap={timestampMap}
        onTimestampMapChange={setTimestampMap}
        recordingStartTime={recordingStartTime}
        isLiveMode={isLiveMode}
        onSpeakersChange={setSpeakersMap}
        initialSpeakers={speakersMap}
      />

      {/* Transcription Panel - Only show when online and configured */}
      {isOnline && transcriptionConfig && (
        <TranscriptionPanel
          transcriptions={transcriptions}
          isTranscribing={isRecording}
          isOnline={isOnline}
          onSeekAudio={handleSeekToAudio}
        />
      )}

      <AudioPlayer ref={audioPlayerRef} audioBlob={audioBlob} />

      {/* Transcription Configuration Modal */}
      <TranscriptionConfig
        visible={showTranscriptionConfig}
        onClose={() => setShowTranscriptionConfig(false)}
        onSave={handleSaveTranscriptionConfig}
        currentConfig={transcriptionConfig}
      />
    </div>
  );
};
