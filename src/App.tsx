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
import { AIRefinementService, type RawTranscriptData } from './services/aiRefinement';
import type { MeetingInfo, SpeechToTextConfig, TranscriptionResult } from './types/types';
import { message, Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
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
  const [savedSpeakersSnapshot, setSavedSpeakersSnapshot] = useState<Map<number, string>>(new Map());
  const [isLiveMode, setIsLiveMode] = useState(true); // true = live recording, false = loaded project
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [backupAge, setBackupAge] = useState<number | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<AudioPlayerRef>(null);
  
  // Speech-to-Text states
  const [showTranscriptionConfig, setShowTranscriptionConfig] = useState(false);
  const [transcriptionConfig, setTranscriptionConfig] = useState<SpeechToTextConfig | null>(null);
  const [transcriptions, setTranscriptions] = useState<TranscriptionResult[]>([]);
  const [rawTranscripts, setRawTranscripts] = useState<RawTranscriptData[]>([]); // Raw data from Web Speech API
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
      // console.log('🎤 Speech-to-Text config loaded');
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
  
  // Handle transcribe-audio event from AudioPlayer
  useEffect(() => {
    const handleTranscribeAudio = async () => {
      if (!audioBlob) {
        alert('No audio file loaded');
        return;
      }

      if (!speechToTextService.isConfigured()) {
        alert('Please configure Speech-to-Text settings first');
        setShowTranscriptionConfig(true);
        return;
      }

      const confirmed = window.confirm(
        'This will transcribe the entire audio file and replace existing transcription results. Continue?'
      );
      
      if (!confirmed) return;

      // console.log('🎬 Starting audio file transcription...');
      
      // Clear existing transcriptions
      setTranscriptions([]);

      try {
        // Show progress notification
        const progressDiv = document.createElement('div');
        progressDiv.id = 'transcribe-progress';
        progressDiv.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 10000;
          min-width: 300px;
          text-align: center;
        `;
        progressDiv.innerHTML = `
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 12px;">🎤 Transcribing Audio...</div>
          <div id="progress-text" style="font-size: 14px; color: #666;">Starting...</div>
          <div style="width: 100%; height: 8px; background: #f0f0f0; border-radius: 4px; margin-top: 12px; overflow: hidden;">
            <div id="progress-bar" style="width: 0%; height: 100%; background: #1890ff; transition: width 0.3s;"></div>
          </div>
        `;
        document.body.appendChild(progressDiv);

        const updateProgress = (progress: number) => {
          const progressBar = document.getElementById('progress-bar');
          const progressText = document.getElementById('progress-text');
          if (progressBar) progressBar.style.width = `${progress}%`;
          if (progressText) progressText.textContent = `${Math.floor(progress)}% complete`;
        };

        await speechToTextService.transcribeAudioFile(
          audioBlob,
          handleNewTranscription,
          updateProgress,
          () => {
            progressDiv.remove();
            setHasUnsavedChanges(true); // Mark as unsaved
            alert('✅ Transcription complete! Click "Save Changes" to save the results.');
          }
        );
      } catch (error: any) {
        const progressDiv = document.getElementById('transcribe-progress');
        if (progressDiv) progressDiv.remove();
        alert(`Transcription failed: ${error.message}`);
        console.error('Transcription error:', error);
      }
    };

    window.addEventListener('transcribe-audio', handleTranscribeAudio);
    return () => {
      window.removeEventListener('transcribe-audio', handleTranscribeAudio);
    };
  }, [audioBlob, transcriptionConfig]);
  
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
    // Check if speakers have been modified
    const speakersModified = isSaved && !mapsAreEqual(savedSpeakersSnapshot, speakersMap);
    
    // Có dữ liệu chưa lưu nếu:
    // 1. Đang recording
    // 2. Có audio/notes nhưng chưa save lần đầu
    // 3. Đã save nhưng notes hoặc speakers bị sửa đổi
    const notesModified = isSaved && savedNotesSnapshot !== notes;
    const hasData = isRecording || (!isSaved && (audioBlob !== null || notes.trim().length > 0)) || notesModified || speakersModified;
    setHasUnsavedChanges(hasData);
  }, [isRecording, audioBlob, notes, speakersMap, isSaved, savedNotesSnapshot, savedSpeakersSnapshot]);
  
  // Helper function to compare two Maps
  function mapsAreEqual(map1: Map<number, string>, map2: Map<number, string>): boolean {
    if (map1.size !== map2.size) return false;
    for (const [key, value] of map1) {
      if (map2.get(key) !== value) return false;
    }
    return true;
  }
  
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
    // console.log('📝 App meetingInfo state updated:', meetingInfo);
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
    setSavedSpeakersSnapshot(new Map(speakersMap)); // Save speakers snapshot
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
      // console.log('✅ Backup restored successfully');
    }
  };
  
  const handleDiscardBackup = async () => {
    await clearBackup();
    setShowBackupDialog(false);
    // console.log('🗑️ Backup discarded');
  };

  const handleLoadProject = (loadedData: {
    meetingInfo: MeetingInfo;
    notes: string;
    timestampMap: Map<number, number>;
    speakersMap: Map<number, string>;
    audioBlob: Blob | null;
    recordingStartTime: number;
    transcriptions?: TranscriptionResult[]; // Add transcriptions array
    rawTranscripts?: RawTranscriptData[]; // Add raw transcripts for AI refinement
  }) => {
    // console.log('📂 App.handleLoadProject - Data received:', {
    //   meetingInfo: loadedData.meetingInfo,
    //   notesLength: loadedData.notes.length,
    //   timestampMapSize: loadedData.timestampMap.size,
    //   speakersMapSize: loadedData.speakersMap.size,
    //   audioBlobSize: loadedData.audioBlob?.size || 0,
    //   hasAudio: loadedData.audioBlob !== null,
    //   transcriptionsCount: loadedData.transcriptions?.length || 0
    // });
    
    setMeetingInfo(loadedData.meetingInfo);
    setNotes(loadedData.notes);
    setTimestampMap(loadedData.timestampMap);
    setSpeakersMap(loadedData.speakersMap);
    setAudioBlob(loadedData.audioBlob);
    setRecordingStartTime(loadedData.recordingStartTime);
    
    // Load transcriptions if available
    if (loadedData.transcriptions && loadedData.transcriptions.length > 0) {
      setTranscriptions(loadedData.transcriptions);
    } else {
      setTranscriptions([]); // Clear transcriptions if none
    }
    
    // Load raw transcripts if available
    if (loadedData.rawTranscripts && loadedData.rawTranscripts.length > 0) {
      setRawTranscripts(loadedData.rawTranscripts);
    } else {
      setRawTranscripts([]); // Clear raw transcripts if none
    }
    
    setIsSaved(true);
    setHasUnsavedChanges(false);
    setSavedNotesSnapshot(loadedData.notes);
    setSavedSpeakersSnapshot(new Map(loadedData.speakersMap)); // Save speakers snapshot
    setIsLiveMode(false); // Switch to timestamp mode when loading project
  };

  // Handle transcription config save
  const handleSaveTranscriptionConfig = (config: SpeechToTextConfig) => {
    setTranscriptionConfig(config);
    speechToTextService.initialize(config);
    // console.log('✅ Transcription config updated');
  };

  // Handle edit transcription
  const handleEditTranscription = (id: string, newText: string, newSpeaker: string, newStartTime?: string, newAudioTimeMs?: number) => {
    // Check if user deleted all text (wants to remove segment)
    if (!newText || newText.trim() === '') {
      const confirmed = window.confirm(
        '⚠️ Bạn đã xóa toàn bộ nội dung.\n\n' +
        'Bạn có muốn xóa segment này không?\n\n' +
        '• Đồng ý: Xóa segment này khỏi danh sách\n' +
        '• Hủy: Giữ nguyên segment (không lưu thay đổi)'
      );
      
      if (confirmed) {
        // Remove the segment
        setTranscriptions(prev => prev.filter(item => item.id !== id));
        setHasUnsavedChanges(true);
        message.success('Đã xóa segment');
        // console.log('🗑️ Transcription segment deleted:', id);
      }
      // If not confirmed, do nothing (keep original segment)
      return;
    }

    // Normal edit: update text and other fields
    setTranscriptions(prev => 
      prev.map(item => 
        item.id === id 
          ? { 
              ...item, 
              text: newText, 
              speaker: newSpeaker, 
              startTime: newStartTime !== undefined ? newStartTime : item.startTime,
              audioTimeMs: newAudioTimeMs !== undefined ? newAudioTimeMs : item.audioTimeMs,
              isManuallyEdited: true 
            }
          : item
      )
    );
    setHasUnsavedChanges(true);
    // console.log('✏️ Transcription edited:', { id, newText, newSpeaker, newStartTime, newAudioTimeMs });
  };

  // Handle new transcription result
  const handleNewTranscription = (result: TranscriptionResult) => {
    // Validate result has text
    if (!result || !result.text) {
      console.warn('⚠️ Received invalid transcription result:', result);
      return;
    }

    // Collect raw transcript data for AI refinement
    const rawData: RawTranscriptData = {
      text: result.text,
      timestamp: result.startTime,
      audioTimeMs: result.audioTimeMs,
      confidence: result.confidence,
      isFinal: result.isFinal
    };
    setRawTranscripts(prev => [...prev, rawData]);

    setTranscriptions(prev => {
      // Nếu là kết quả final
      if (result.isFinal) {
        // Loại bỏ kết quả tạm thời (nếu có)
        const finalResults = prev.filter(item => item.isFinal);
        
        // Kiểm tra xem kết quả mới có phải là phiên bản mở rộng của kết quả cũ không
        // Nếu kết quả cuối cùng chứa hầu hết text của kết quả mới hoặc ngược lại
        if (finalResults.length > 0) {
          const lastResult = finalResults[finalResults.length - 1];
          
          // Validate both texts exist
          if (!lastResult.text) {
            // If last result has no text, replace it with new result
            finalResults[finalResults.length - 1] = result;
            return finalResults;
          }
          
          const newText = result.text.trim().toLowerCase();
          const lastText = lastResult.text.trim().toLowerCase();
          
          // Case 1: Kết quả mới là phiên bản mở rộng của kết quả cũ
          // VD: Cũ: "như vậy là", Mới: "như vậy là cái mẫu"
          if (newText.startsWith(lastText) && newText.length > lastText.length) {
            // console.log('🔄 Replacing with extended version:', {
            //   old: lastText.substring(0, 50) + '...',
            //   new: newText.substring(0, 50) + '...'
            // });
            // Thay thế kết quả cũ bằng kết quả mới
            finalResults[finalResults.length - 1] = result;
            return finalResults;
          }
          
          // Case 2: Kết quả cũ là phiên bản mở rộng của kết quả mới → bỏ qua kết quả mới
          // VD: Cũ: "như vậy là cái mẫu", Mới: "như vậy là"
          if (lastText.startsWith(newText)) {
            // console.log('⏭️ Skipping shorter duplicate');
            return prev; // Giữ nguyên
          }
          
          // Case 3: Kiểm tra độ tương đồng cao (>80% giống nhau)
          const similarity = calculateSimilarity(newText, lastText);
          if (similarity > 0.8) {
            // console.log('⏭️ Skipping similar result (similarity: ' + (similarity * 100).toFixed(0) + '%)');
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
      // console.log('✅ Final transcription:', result.text.substring(0, 50) + '...');
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
      // console.log(`⏭️ Seeking to ${(timeMs / 1000).toFixed(2)}s`);
    }
  };

  // Handle AI refinement
  const handleAIRefine = async () => {
    if (!transcriptionConfig) {
      message.warning('Vui lòng cấu hình Speech-to-Text Settings trước');
      setShowTranscriptionConfig(true);
      return;
    }

    // Check for Gemini API key
    const apiKeyToUse = transcriptionConfig.geminiApiKey || transcriptionConfig.apiKey;
    if (!apiKeyToUse) {
      message.error({
        content: (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
              Cần Gemini API Key để sử dụng tính năng AI
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
              <strong>Cách lấy API Key miễn phí:</strong>
              <ol style={{ paddingLeft: '20px', margin: '8px 0' }}>
                <li>Truy cập: <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a></li>
                <li>Click "Create API Key"</li>
                <li>Copy API key và paste vào Settings → Gemini API Key</li>
                <li>Hệ thống sẽ tự động tải danh sách models</li>
                <li>Chọn model (khuyên dùng: Gemini 2.5 Flash)</li>
              </ol>
            </div>
          </div>
        ),
        duration: 10
      });
      setShowTranscriptionConfig(true);
      return;
    }

    // Check for model selection
    const selectedModel = transcriptionConfig.geminiModel;
    if (!selectedModel || !selectedModel.startsWith('models/')) {
      message.error({
        content: (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
              Vui lòng chọn Gemini Model trong Settings
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
              <strong>Các bước:</strong>
              <ol style={{ paddingLeft: '20px', margin: '8px 0' }}>
                <li>Mở Settings</li>
                <li>Nhập Gemini API Key (nếu chưa có)</li>
                <li>Đợi hệ thống tải danh sách models</li>
                <li>Chọn model từ dropdown (khuyên dùng: Gemini 2.5 Flash)</li>
                <li>Lưu và thử lại</li>
              </ol>
            </div>
          </div>
        ),
        duration: 10
      });
      setShowTranscriptionConfig(true);
      return;
    }

    if (transcriptions.length === 0) {
      message.warning('Không có dữ liệu chuyển đổi để chuẩn hóa');
      return;
    }

    // Show warning modal with better design
    Modal.confirm({
      title: (
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1890ff' }}>
          🤖 Chuẩn hóa văn bản bằng Gemini AI
        </div>
      ),
      icon: <ExclamationCircleOutlined style={{ color: '#1890ff' }} />,
      width: 680,
      content: (
        <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#52c41a' }}>
              ✨ AI sẽ thực hiện:
            </div>
            <ul style={{ paddingLeft: '20px', margin: '0' }}>
              <li>Sửa lỗi nhận diện từ Web Speech API</li>
              <li>Loại bỏ từ thừa, từ đệm (à, ừm, thì...)</li>
              <li>Thêm dấu câu và viết hoa đúng quy tắc</li>
              <li>Gộp các đoạn liên quan thành câu hoàn chỉnh</li>
            </ul>
          </div>

          <div style={{ 
            background: '#fff7e6', 
            border: '2px solid #ffa940',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '12px', 
              color: '#fa8c16',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              CẢNH BÁO QUAN TRỌNG VỀ BẢO MẬT
            </div>
            
            <div style={{ marginBottom: '12px', color: '#595959' }}>
              Dữ liệu của bạn sẽ được <strong>gửi đến Google Gemini API</strong> để xử lý.
            </div>

            <div style={{ 
              background: '#fff1f0',
              border: '1px solid #ffccc7',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '12px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#cf1322' }}>
                🚫 KHÔNG sử dụng với thông tin nhạy cảm
              </div>
              <ul style={{ paddingLeft: '20px', margin: '0', color: '#595959' }}>
                <li><strong>Tài chính:</strong> Mật khẩu, số tài khoản, số thẻ, giao dịch ngân hàng</li>
                <li><strong>Y tế:</strong> Bệnh án, đơn thuốc, kết quả xét nghiệm</li>
                <li><strong>Cá nhân:</strong> CCCD/CMND, địa chỉ, số điện thoại nhạy cảm</li>
                <li><strong>Doanh nghiệp:</strong> Bí mật thương mại, kế hoạch kinh doanh, các nội dung mật khác</li>
                <li><strong>Bảo mật:</strong> API keys, tokens, credentials</li>
              </ul>
            </div>

            <div style={{ 
              fontStyle: 'italic', 
              color: '#8c8c8c',
              fontSize: '13px'
            }}>
              💡 Khuyến nghị: Hãy xem lại nội dung transcript trước khi sử dụng chức năng này
            </div>
          </div>

          <div style={{ 
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '13px',
            color: '#595959'
          }}>
            <strong>ℹ️ Lưu ý:</strong> Quá trình này sẽ thay thế toàn bộ kết quả hiện tại. 
            Bạn có thể chỉnh sửa lại sau nếu cần.
          </div>
        </div>
      ),
      okText: 'Đồng ý, tiếp tục',
      cancelText: 'Hủy bỏ',
      okButtonProps: {
        danger: false,
        type: 'primary'
      },
      onOk: async () => {
        await performAIRefinement();
      }
    });
  };

  // Separate function to perform AI refinement
  const performAIRefinement = async () => {
    const apiKeyToUse = transcriptionConfig!.geminiApiKey || transcriptionConfig!.apiKey;
    const selectedModel = transcriptionConfig!.geminiModel;

    try {
      // Show progress dialog
      const progressDiv = document.createElement('div');
      progressDiv.id = 'ai-refine-progress';
      progressDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        min-width: 350px;
        text-align: center;
      `;
      progressDiv.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 12px;">🤖 AI đang chuẩn hóa văn bản...</div>
        <div id="ai-progress-text" style="font-size: 14px; color: #666;">Đang xử lý...</div>
        <div style="width: 100%; height: 8px; background: #f0f0f0; border-radius: 4px; margin-top: 12px; overflow: hidden;">
          <div id="ai-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); transition: width 0.3s;"></div>
        </div>
      `;
      document.body.appendChild(progressDiv);

      const updateProgress = (progress: number) => {
        const progressBar = document.getElementById('ai-progress-bar');
        const progressText = document.getElementById('ai-progress-text');
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (progressText) {
          if (progress < 20) progressText.textContent = 'Đang chuẩn bị dữ liệu...';
          else if (progress < 70) progressText.textContent = 'Đang gửi đến AI...';
          else if (progress < 90) progressText.textContent = 'Đang xử lý kết quả...';
          else progressText.textContent = 'Hoàn thành!';
        }
      };

      // Prepare raw data for supplementary reference
      let rawData: RawTranscriptData[] = [];
      if (rawTranscripts && rawTranscripts.length > 0) {
        // Use saved raw data (preserves original Web Speech API output)
        rawData = rawTranscripts;
        console.log('📦 Using saved raw transcripts as supplementary data:', rawData.length, 'items');
      } else {
        // No raw data available - AI will only use transcriptions
        console.log('ℹ️ No raw data available - using transcriptions only');
      }

      // Call AI refinement service with model selection
      // Primary data: transcriptions (user-edited, highest reliability)
      // Supplementary data: rawTranscripts (original Web Speech API output for reference)
      const refinedSegments = await AIRefinementService.refineTranscripts(
        apiKeyToUse,
        transcriptions, // Primary data
        rawData, // Supplementary data
        selectedModel, // Pass required model name
        updateProgress
      );

      // Convert to TranscriptionResult format
      const refinedResults = AIRefinementService.convertToTranscriptionResults(
        refinedSegments,
        'Person1'
      );

      // Update transcriptions
      setTranscriptions(refinedResults);
      setHasUnsavedChanges(true);

      // Remove progress dialog
      progressDiv.remove();

      message.success(`✅ Đã chuẩn hóa thành công ${refinedResults.length} đoạn văn bản!`);

    } catch (error: any) {
      const progressDiv = document.getElementById('ai-refine-progress');
      if (progressDiv) progressDiv.remove();

      console.error('AI Refinement Error:', error);
      message.error(`Lỗi khi chuẩn hóa bằng AI: ${error.message}`);
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
        shouldBlink={!transcriptionConfig} 
        onNewTranscription={handleNewTranscription}
        onClearTranscriptions={() => {
          setTranscriptions([]);
          setRawTranscripts([]); // Also clear raw transcripts
        }}
        transcriptions={transcriptions}
      />

      {/* Transcription Panel - Only show when online and configured */}
      {isOnline && transcriptionConfig && (
        <TranscriptionPanel
          transcriptions={transcriptions}
          isTranscribing={isRecording}
          isOnline={isOnline}
          onSeekAudio={handleSeekToAudio}
          onEditTranscription={handleEditTranscription}
          onAIRefine={handleAIRefine}
          canRefineWithAI={
            !isRecording && 
            transcriptions.length > 0 && 
            (!!transcriptionConfig.geminiApiKey || !!transcriptionConfig.apiKey) &&
            !!transcriptionConfig.geminiModel
          }
        />
      )}

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

      <AudioPlayer ref={audioPlayerRef} audioBlob={audioBlob} transcriptionConfig={transcriptionConfig} />

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
