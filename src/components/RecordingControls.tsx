import React, { useState, useEffect } from 'react';
import { Button, Space, Switch, Tooltip, App } from 'antd';
import {
  FolderOpenOutlined,
  AudioOutlined,
  StopOutlined,
  SaveOutlined,
  FolderAddOutlined,
  SettingOutlined,
  SoundOutlined
} from '@ant-design/icons';
import { AudioRecorderService } from '../services/audioRecorder';
import { FileManagerService, FileDownloadService } from '../services/fileManager';
import { MetadataBuilder } from '../services/metadataBuilder';
import { WordExporter } from '../services/wordExporter';
import { speechToTextService } from '../services/speechToText';
import { AudioMerger, AudioSegment } from '../services/audioMerger';
import type { MeetingInfo, SpeechToTextConfig, TranscriptionResult } from '../types/types';

interface Props {
  folderPath: string;
  onFolderSelect: (path: string) => void;
  isRecording: boolean;
  onRecordingChange: (recording: boolean) => void;
  onAudioBlobChange: (blob: Blob | null) => void;
  onSaveComplete: () => void;
  onLoadProject: (loadedData: {
    meetingInfo: MeetingInfo;
    notes: string;
    timestampMap: Map<number, number>;
    speakersMap: Map<number, string>;
    audioBlob: Blob | null;
    recordingStartTime: number;
  }) => void;
  meetingInfo: MeetingInfo;
  notes: string;
  timestampMap: Map<number, number>;
  speakersMap: Map<number, string>;
  recordingStartTime: number;
  onRecordingStartTimeChange: (time: number) => void;
  audioBlob: Blob | null;
  isSaved: boolean;
  hasUnsavedChanges: boolean;
  // Speech-to-Text props
  onShowTranscriptionConfig: () => void;
  transcriptionConfig: SpeechToTextConfig | null;
  shouldBlink?: boolean;
  onNewTranscription: (result: TranscriptionResult) => void;
  onClearTranscriptions: () => void;
  transcriptions: TranscriptionResult[];
}

export const RecordingControls: React.FC<Props> = ({
  folderPath,
  onFolderSelect,
  isRecording,
  onRecordingChange,
  onAudioBlobChange,
  onSaveComplete,
  onLoadProject,
  meetingInfo,
  notes,
  timestampMap,
  speakersMap,
  recordingStartTime,
  onRecordingStartTimeChange,
  audioBlob,
  isSaved,
  hasUnsavedChanges,
  onShowTranscriptionConfig,
  transcriptionConfig,
  onNewTranscription,
  onClearTranscriptions,
  transcriptions
}) => {
  const { message } = App.useApp();
  const [duration, setDuration] = useState<number>(0);
  const [recorder] = useState(() => new AudioRecorderService());
  const [fileManager] = useState(() => new FileManagerService());
  const [lastProjectName, setLastProjectName] = useState<string>('');
  const [lastRecordingDuration, setLastRecordingDuration] = useState<number>(0);
  const [autoTranscribe, setAutoTranscribe] = useState<boolean>(true);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  
  // Recording segments tracking for multi-part recording
  const [recordingSegments, setRecordingSegments] = useState<Array<{
    blob: Blob;
    startTime: number; // absolute timestamp (Date.now())
    endTime: number;   // absolute timestamp (Date.now())
    duration: number;  // duration in ms
  }>>([]);

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setDuration(recorder.getCurrentDuration());
    }, 100);

    return () => clearInterval(interval);
  }, [isRecording, recorder]);

  // Start/stop transcription when recording state or autoTranscribe changes
  useEffect(() => {
    const startTranscription = async () => {
      if (isRecording && autoTranscribe && transcriptionConfig && navigator.onLine && audioStream) {
        try {
          // Use the shared audio stream from recorder
          await speechToTextService.startTranscription(audioStream, onNewTranscription);
          message.success('🎤 Bắt đầu chuyển đổi giọng nói sang văn bản');
        } catch (error: any) {
          console.error('Failed to start transcription:', error);
          message.error('Không thể bắt đầu chuyển đổi: ' + error.message);
        }
      } else if (!isRecording || !autoTranscribe) {
        // Stop transcription (but don't stop the stream - recorder owns it)
        speechToTextService.stopTranscription();
      }
    };

    startTranscription();
  }, [isRecording, autoTranscribe, transcriptionConfig, audioStream]);

  const handleSelectFolder = async () => {
    try {
      const folder = await fileManager.selectFolder();
      if (folder) {
        onFolderSelect(folder);
        message.success(`Folder selected: ${folder}`);
      }
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleStartRecording = async () => {
    try {
      await recorder.startRecording();
      const startTime = Date.now();
      onRecordingStartTimeChange(startTime);
      
      // Get the audio stream from recorder to share with transcription
      const stream = recorder.getStream();
      if (stream) {
        setAudioStream(stream);
      }
      
      onRecordingChange(true);
      setDuration(0);
      setRecordingSegments([]); // Clear segments for new recording
      message.success('Bắt đầu ghi âm');
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleContinueRecording = async () => {
    try {
      await recorder.startRecording();
      
      // Get the audio stream from recorder to share with transcription
      const stream = recorder.getStream();
      if (stream) {
        setAudioStream(stream);
      }
      
      onRecordingChange(true);
      message.success('Tiếp tục ghi âm');
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const sanitizeMeetingTitle = (title: string): string => {
    // Remove invalid characters for file/folder names: < > : " / \ | ? *
    let sanitized = title.replace(/[<>:"/\\|?*]/g, '_');
    // Replace multiple spaces/underscores with single underscore
    sanitized = sanitized.replace(/[\s_]+/g, '_');
    // Trim leading/trailing underscores
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    // Limit length to 50 characters
    if (sanitized.length > 50) {
      sanitized = sanitized.substring(0, 50);
    }
    // Fallback if empty after sanitization
    return sanitized || 'Cuộc họp';
  };

  const handleStopRecording = async () => {
    try {
      const audioBlob = await recorder.stopRecording();
      const recordingDuration = recorder.getCurrentDuration();
      const segmentEndTime = Date.now();
      onRecordingChange(false);

      // If auto-transcription is active, wait for it to complete
      if (autoTranscribe && speechToTextService.isProcessing()) {
        message.loading({ content: '⏳ Đang chờ chuyển đổi giọng nói hoàn tất...', key: 'waitTranscription' });
        await speechToTextService.waitForCompletion(3000); // Wait up to 3 seconds
        message.success({ content: '✅ Chuyển đổi giọng nói hoàn tất', key: 'waitTranscription', duration: 2 });
      }

      // Note: audioStream is already stopped by recorder.stopRecording()
      setAudioStream(null);

      // Add current recording as a segment
      const currentSegment: AudioSegment = {
        blob: audioBlob,
        startTime: recordingStartTime,
        endTime: segmentEndTime,
        duration: recordingDuration
      };
      
      const allSegments = [...recordingSegments, currentSegment];
      setRecordingSegments(allSegments);

      // Check if we need to merge multiple segments
      let finalAudioBlob: Blob = audioBlob;
      let finalDuration = recordingDuration;
      let totalRecordingStartTime = recordingStartTime;

      if (allSegments.length > 1) {
        message.loading({ content: '🔀 Merging audio segments...', key: 'mergeAudio' });
        
        try {
          // Merge all segments
          const mergeResult = await AudioMerger.mergeSegments(allSegments);
          finalAudioBlob = mergeResult.mergedBlob;
          finalDuration = mergeResult.totalDuration;
          totalRecordingStartTime = allSegments[0].startTime; // Use first segment's start time
          
          message.success({ 
            content: `✅ Merged ${allSegments.length} segments (${(mergeResult.totalDuration / 1000).toFixed(1)}s total)`, 
            key: 'mergeAudio',
            duration: 3
          });

          // console.log('📊 Merge info:', {
          //   segments: allSegments.length,
          //   totalDuration: `${(finalDuration / 1000).toFixed(2)}s`,
          //   gaps: mergeResult.gapInfo.length,
          //   gapDetails: mergeResult.gapInfo.map(g => `${(g.durationMs / 1000).toFixed(2)}s`)
          // });
        } catch (error: any) {
          message.error({ content: `Failed to merge: ${error.message}`, key: 'mergeAudio' });
          // Continue with last segment only if merge fails
          console.error('Merge error:', error);
        }
      }

      // Generate folder and file names with timestamp prefix and meeting title
      const now = new Date(totalRecordingStartTime);
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timePrefix = `${year}${month}${day}_${hours}${minutes}`;
      
      const sanitizedTitle = sanitizeMeetingTitle(meetingInfo.title || 'Meeting');
      const projectName = `${timePrefix}_${sanitizedTitle}`;
      const audioFileName = `${projectName}.webm`;

      // Save files
      if (FileManagerService.isSupported() && folderPath) {
        // Create project subdirectory and get its handle
        const originalHandle = fileManager.getDirHandle(); // Save original handle
        const projectDirHandle = await fileManager.createProjectDirectory(projectName);
        // console.log('✓ Created project directory:', projectName);
        
        // If multi-part recording, backup original segments
        if (allSegments.length > 1) {
          try {
            // Create backup subdirectory inside project directory
            fileManager.setDirHandle(projectDirHandle);
            const backupDirHandle = await fileManager.createProjectDirectory('backup');
            fileManager.setDirHandle(backupDirHandle);
            
            // Save individual segments to backup folder
            for (let i = 0; i < allSegments.length; i++) {
              const segmentFileName = `${projectName}_part${i + 1}.webm`;
              await fileManager.saveAudioFile(
                allSegments[i].blob, 
                segmentFileName, 
                undefined,
                false // Don't add time prefix since parent folder already has it
              );
            }
            
            // console.log(`📦 Backed up ${allSegments.length} segments to backup folder`);
          } catch (error) {
            console.error('Failed to backup segments:', error);
            // Don't fail the entire save if backup fails
          }
        }
        
        // Set dirHandle to project directory for main files
        fileManager.setDirHandle(projectDirHandle);
        
        // Save merged/final audio file
        await fileManager.saveAudioFile(finalAudioBlob, audioFileName, undefined, true);
        // console.log('✓ Saved audio file:', audioFileName);

        // Build and save metadata
        const metadata = MetadataBuilder.buildMetadata(
          meetingInfo,
          notes,
          timestampMap,
          speakersMap,
          finalDuration,
          audioFileName,
          totalRecordingStartTime
        );

        await fileManager.saveMetadataFile(
          metadata.meetingInfo,
          `${projectName}_meeting_info.json`,
          undefined,
          true
        );
        // console.log('✓ Saved meeting_info.json');
        
        await fileManager.saveMetadataFile(
          metadata.metadata,
          `${projectName}_metadata.json`,
          undefined,
          true
        );
        // console.log('✓ Saved metadata.json');

        // Save transcription data if available
        if (transcriptions && transcriptions.length > 0) {
          const transcriptionData = {
            transcriptions: transcriptions.filter(t => t.isFinal), // Only save final results
            totalCount: transcriptions.filter(t => t.isFinal).length,
            savedAt: new Date().toISOString()
          };
          await fileManager.saveMetadataFile(
            transcriptionData,
            `${projectName}_transcription.json`,
            undefined,
            true
          );
          // console.log('💾 Transcription data saved:', transcriptionData.totalCount, 'items');
        }

        // Export Word document to same folder
        const finalTranscriptions = transcriptions?.filter(t => t.isFinal) || [];
        const wordBlob = await WordExporter.createWordBlob(meetingInfo, notes, finalTranscriptions);
        await fileManager.saveWordFile(wordBlob, `${projectName}.docx`, undefined, true);
        // console.log('✓ Saved Word document');
        
        // Restore original handle
        if (originalHandle) {
          fileManager.setDirHandle(originalHandle);
        }

        message.success(`Recording saved to folder: ${projectName}`);
        setLastProjectName(projectName);
        setLastRecordingDuration(finalDuration);
        onSaveComplete(); // Notify parent that save is complete
      } else {
        // Fallback: download files
        const downloader = new FileDownloadService();
        await downloader.downloadAudioFile(finalAudioBlob, audioFileName);

        const metadata = MetadataBuilder.buildMetadata(
          meetingInfo,
          notes,
          timestampMap,
          speakersMap,
          finalDuration,
          audioFileName,
          totalRecordingStartTime
        );

        await downloader.downloadMetadataFile(
          metadata.meetingInfo,
          `${projectName}_meeting_info.json`
        );
        await downloader.downloadMetadataFile(
          metadata.metadata,
          `${projectName}_metadata.json`
        );

        // Save transcription data if available
        if (transcriptions && transcriptions.length > 0) {
          const transcriptionData = {
            transcriptions: transcriptions.filter(t => t.isFinal),
            totalCount: transcriptions.filter(t => t.isFinal).length,
            savedAt: new Date().toISOString()
          };
          await downloader.downloadMetadataFile(
            transcriptionData,
            `${projectName}_transcription.json`
          );
          // console.log('💾 Transcription data saved:', transcriptionData.totalCount, 'items');
        }

        // Export Word document
        const finalTranscriptions = transcriptions?.filter(t => t.isFinal) || [];
        await WordExporter.exportToWord(
          meetingInfo,
          notes,
          `${projectName}.docx`,
          finalTranscriptions
        );

        message.info('Files downloaded. Please save them to your meeting notes folder.');
        setLastProjectName(projectName);
        setLastRecordingDuration(finalDuration);
        onSaveComplete(); // Notify parent that save is complete
      }

      // Set audio for playback and clear segments
      onAudioBlobChange(finalAudioBlob);
      setRecordingSegments([]); // Clear segments after successful save
    } catch (error: any) {
      message.error(`Failed to stop recording: ${error.message}`);
    }
  };

  const handleSaveNotes = async () => {
    try {
      // Check if folder is selected, if not, prompt user to select
      if (!FileManagerService.isSupported()) {
        // Fallback: download files
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timePrefix = `${year}${month}${day}_${hours}${minutes}`;
        
        const sanitizedTitle = sanitizeMeetingTitle(meetingInfo.title || 'Meeting');
        const projectName = `${timePrefix}_${sanitizedTitle}`;
        
        const downloader = new FileDownloadService();
        
        await downloader.downloadMetadataFile(
          meetingInfo,
          `${projectName}_meeting_info.json`
        );
        
        // Export Word document
        const finalTranscriptions = transcriptions?.filter(t => t.isFinal) || [];
        await WordExporter.exportToWord(
          meetingInfo,
          notes,
          `${projectName}.docx`,
          finalTranscriptions
        );
        
        message.info('Tệp đã được tải xuống. Vui lòng lưu vào thư mục ghi chú cuộc họp của bạn.');
        setLastProjectName(projectName);
        onSaveComplete();
        return;
      }
      
      // Check if folder is selected
      if (!folderPath && !fileManager.getParentDirHandle() && !fileManager.getProjectDirHandle()) {
        // No folder selected, prompt user
        const folder = await fileManager.selectFolder();
        if (!folder) {
          message.info('Vui lòng chọn thư mục để lưu ghi chú.');
          return; // User cancelled
        }
        onFolderSelect(folder);
      }
      
      // Generate folder and file names with timestamp prefix and meeting title
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timePrefix = `${year}${month}${day}_${hours}${minutes}`;
      
      const sanitizedTitle = sanitizeMeetingTitle(meetingInfo.title || 'Meeting');
      const projectName = `${timePrefix}_${sanitizedTitle}`;
      
      // Create project subdirectory and get its handle
      const originalHandle = fileManager.getDirHandle(); // Save original handle
      const projectDirHandle = await fileManager.createProjectDirectory(projectName);
      // console.log('✓ Created project directory:', projectName);
      
      // Temporarily set dirHandle to the project directory for saving files
      fileManager.setDirHandle(projectDirHandle);
      
      // Save metadata files (convert to PascalCase format)
      const meetingInfoJson = {
        MeetingTitle: meetingInfo.title,
        MeetingDate: meetingInfo.date,
        MeetingTime: meetingInfo.time,
        Location: meetingInfo.location,
        Host: meetingInfo.host,
        Attendees: meetingInfo.attendees,
      };
      
      await fileManager.saveMetadataFile(
        meetingInfoJson,
        `${projectName}_meeting_info.json`,
        undefined,
        true
      );
      // console.log('✓ Saved meeting_info.json');
      
      // Create metadata using MetadataBuilder (same as recording mode)
      const metadata = MetadataBuilder.buildMetadata(
        meetingInfo,
        notes,
        timestampMap,
        speakersMap,
        0, // No audio duration for notes-only
        '', // No audio file
        recordingStartTime || Date.now() // Use recording start time if available, otherwise current time
      );
      
      // Override fields for notes-only mode
      metadata.metadata.Model = 'Notes Only';
      metadata.metadata.OriginalFileName = '';
      metadata.metadata.AudioFileName = '';
      metadata.metadata.Duration = '00:00:00.0000000';
      
      await fileManager.saveMetadataFile(
        metadata.metadata,
        `${projectName}_metadata.json`,
        undefined,
        true
      );
      // console.log('✓ Saved metadata.json');
      
      // Export Word document
      const finalTranscriptions = transcriptions?.filter(t => t.isFinal) || [];
      const wordBlob = await WordExporter.createWordBlob(meetingInfo, notes, finalTranscriptions);
      await fileManager.saveWordFile(wordBlob, `${projectName}.docx`, undefined, true);
      // console.log('✓ Saved Word document');
      
      // Restore original handle
      if (originalHandle) {
        fileManager.setDirHandle(originalHandle);
      }
      
      message.success(`Notes saved to folder: ${projectName}`);
      setLastProjectName(projectName);
      onSaveComplete();
    } catch (error: any) {
      console.error('Save Notes Error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      message.error(`Failed to save notes: ${error.message}`);
    }
  };

  const handleSaveChanges = async () => {
    try {
      if (!lastProjectName) {
        message.error('Không có dự án để cập nhật');
        return;
      }

      // Generate new folder and file names with new timestamp
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timePrefix = `${year}${month}${day}_${hours}${minutes}`;
      
      const sanitizedTitle = sanitizeMeetingTitle(meetingInfo.title || 'Meeting');
      const newProjectName = `${timePrefix}_${sanitizedTitle}`;

      // Build updated metadata with current notes
      // Check if this is a notes-only project or recording project
      const isNotesOnly = !audioBlob;
      
      let metadata;
      if (isNotesOnly) {
        // Notes-only project - use MetadataBuilder to properly handle timestamps and speakers
        metadata = MetadataBuilder.buildMetadata(
          meetingInfo,
          notes,
          timestampMap,
          speakersMap,
          0, // No audio duration for notes-only
          '', // No audio file
          recordingStartTime || Date.now()
        );
        
        // Override fields for notes-only mode
        metadata.metadata.Model = 'Notes Only';
        metadata.metadata.OriginalFileName = '';
        metadata.metadata.AudioFileName = '';
        metadata.metadata.Duration = '00:00:00.0000000';
      } else {
        // Recording project with audio
        const audioFileName = `${newProjectName}.webm`;
        metadata = MetadataBuilder.buildMetadata(
          meetingInfo,
          notes,
          timestampMap,
          speakersMap,
          lastRecordingDuration,
          audioFileName,
          recordingStartTime
        );
      }

      if (FileManagerService.isSupported()) {
        // Try multiple save locations in order of preference:
        // 1. User-selected folder via "Select Folder" button (highest priority if user chose new location)
        // 2. Parent directory of loaded project (same level as original)
        // 3. Inside loaded project folder itself (fallback - creates subfolder)
        const parentDirHandle = fileManager.getParentDirHandle();
        const projectDirHandle = fileManager.getProjectDirHandle();
        
        let saveHandle: FileSystemDirectoryHandle | null = null;
        let saveLocation = '';
        
        // Check if user has manually selected a folder (prioritize user's explicit choice)
        const hasManualSelection = folderPath && !folderPath.includes('(parent of loaded project)') && !folderPath.includes('(loaded project folder)');
        
        if (hasManualSelection) {
          // User explicitly chose a folder via "Select Folder" - use it
          saveLocation = 'selected folder';
          // dirHandle is already set from selectFolder()
        } else if (parentDirHandle) {
          saveHandle = parentDirHandle;
          saveLocation = 'parent directory (same level as loaded project)';
        } else if (projectDirHandle) {
          saveHandle = projectDirHandle;
          saveLocation = 'inside loaded project folder';
        }
        
        if (saveHandle || folderPath) {
          // Set directory handle if we got one from loaded project
          const originalHandle = fileManager.getDirHandle(); // Save original handle
          if (saveHandle) {
            fileManager.setDirHandle(saveHandle);
          }
          
          // Create new project subdirectory and get its handle
          const projectDirHandle = await fileManager.createProjectDirectory(newProjectName);
          // console.log('✓ Created project directory:', newProjectName);
          
          // Temporarily set dirHandle to the project directory for saving files
          fileManager.setDirHandle(projectDirHandle);
          
          // Save audio file only if it exists (recording project)
          // Now save files directly to current directory (no subDir needed)
          if (audioBlob) {
            const audioFileName = `${newProjectName}.webm`;
            await fileManager.saveAudioFile(audioBlob, audioFileName, undefined, true);
            // console.log('✓ Saved audio file:', audioFileName);
          }

          // Save metadata files directly to project directory
          await fileManager.saveMetadataFile(
            metadata.meetingInfo,
            `${newProjectName}_meeting_info.json`,
            undefined,
            true
          );
          // console.log('✓ Saved meeting_info.json');
          
          await fileManager.saveMetadataFile(
            metadata.metadata,
            `${newProjectName}_metadata.json`,
            undefined,
            true
          );
          // console.log('✓ Saved metadata.json');

          // Save transcription data if available
          if (transcriptions && transcriptions.length > 0) {
            const transcriptionData = {
              transcriptions: transcriptions.filter(t => t.isFinal), // Only save final results
              totalCount: transcriptions.filter(t => t.isFinal).length,
              savedAt: new Date().toISOString()
            };
            await fileManager.saveMetadataFile(
              transcriptionData,
              `${newProjectName}_transcription.json`,
              undefined,
              true
            );
            // console.log('💾 Transcription data saved in Save Changes:', transcriptionData.totalCount, 'items');
          }

          // Export Word document
          const finalTranscriptions = transcriptions?.filter(t => t.isFinal) || []; // Lọc các kết quả isFinal
          const wordBlob = await WordExporter.createWordBlob(meetingInfo, notes, finalTranscriptions);
          await fileManager.saveWordFile(wordBlob, `${newProjectName}.docx`, undefined, true);
          // console.log('✓ Saved Word document');
          
          // Restore original handle
          if (originalHandle) {
            fileManager.setDirHandle(originalHandle);
          }

          message.success(`Changes saved to ${saveLocation}: ${newProjectName}`);
          setLastProjectName(newProjectName);
        } else {
          message.error('No save location available. Please use "Select Folder" first or load a project.');
        }
      } else {
        // Download updated files (fallback for unsupported browsers)
        const downloader = new FileDownloadService();
        
        // Download audio only if it exists
        if (audioBlob) {
          const audioFileName = `${newProjectName}.webm`;
          await downloader.downloadAudioFile(audioBlob, audioFileName);
        }
        
        await downloader.downloadMetadataFile(
          metadata.meetingInfo,
          `${newProjectName}_meeting_info.json`
        );
        
        await downloader.downloadMetadataFile(
          metadata.metadata,
          `${newProjectName}_metadata.json`
        );

        // Save transcription data if available
        if (transcriptions && transcriptions.length > 0) {
          const transcriptionData = {
            transcriptions: transcriptions.filter(t => t.isFinal),
            totalCount: transcriptions.filter(t => t.isFinal).length,
            savedAt: new Date().toISOString()
          };
          await downloader.downloadMetadataFile(
            transcriptionData,
            `${newProjectName}_transcription.json`
          );
          // console.log('💾 Transcription data downloaded in Save Changes:', transcriptionData.totalCount, 'items');
        }

        
        const finalTranscriptions = transcriptions?.filter(t => t.isFinal) || [];
        await WordExporter.exportToWord(
          meetingInfo,
          notes,
          `${newProjectName}.docx`,
          finalTranscriptions
        );

        message.info('Updated files downloaded as new version.');
        setLastProjectName(newProjectName);
      }

      onSaveComplete(); // Notify parent that save is complete
    } catch (error: any) {
      console.error('Save Changes Error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      message.error(`Failed to save changes: ${error.message}`);
    }
  };

  const handleLoadProject = async () => {
    // console.log('handleLoadProject called');
    
    try {
      if (!FileManagerService.isSupported()) {
        // console.error('Browser not supported');
        message.error('Your browser does not support loading projects. Please use Chrome or Edge.');
        return;
      }

      // console.log('Checking unsaved changes...');
      if (hasUnsavedChanges) {
        const confirmed = window.confirm(
          'Bạn có dữ liệu chưa lưu. Tải project mới sẽ mất dữ liệu hiện tại. Tiếp tục?'
        );
        if (!confirmed) {
          // console.log('User cancelled due to unsaved changes');
          return;
        }
      }

      // console.log('Calling fileManager.loadProjectFromFolder...');
      const projectData = await fileManager.loadProjectFromFolder();
      
      // console.log('fileManager returned:', projectData);
      
      if (!projectData) {
        // console.log('User cancelled folder selection');
        return; // User cancelled
      }

      // Map PascalCase from saved files to camelCase for MeetingInfo
      const loadedMeetingInfo = {
        title: projectData.meetingInfo.MeetingTitle || '',
        date: projectData.meetingInfo.MeetingDate || '',
        time: projectData.meetingInfo.MeetingTime || '',
        location: projectData.meetingInfo.Location || '',
        host: projectData.meetingInfo.Host || '',
        attendees: projectData.meetingInfo.Attendees || ''
      };

      // console.log('📋 Mapping meetingInfo from file:', {
      //   rawData: projectData.meetingInfo,
      //   mapped: loadedMeetingInfo
      // });
      
      // console.log('🔍 Individual field mapping:', {
      //   'MeetingTitle → title': `"${projectData.meetingInfo.MeetingTitle}" → "${loadedMeetingInfo.title}"`,
      //   'MeetingDate → date': `"${projectData.meetingInfo.MeetingDate}" → "${loadedMeetingInfo.date}"`,
      //   'MeetingTime → time': `"${projectData.meetingInfo.MeetingTime}" → "${loadedMeetingInfo.time}"`,
      //   'Location → location': `"${projectData.meetingInfo.Location}" → "${loadedMeetingInfo.location}"`,
      //   'Host → host': `"${projectData.meetingInfo.Host}" → "${loadedMeetingInfo.host}"`,
      //   'Attendees → attendees': `"${projectData.meetingInfo.Attendees}" → "${loadedMeetingInfo.attendees}"`
      // });

      // Parse metadata to reconstruct timestampMap, speakersMap and notes
      const timestampMapData = new Map<number, number>();
      const speakersMapData = new Map<number, string>();
      let notesText = '';
      
      // Get recording start time - prefer from metadata, fallback to calculation
      let recordingStart = Date.now();
      
      if (projectData.metadata.RecordingStartTime) {
        // Use saved RecordingStartTime from metadata (chuẩn nhất)
        recordingStart = new Date(projectData.metadata.RecordingStartTime).getTime();
        
        // console.log('🕐 Using RecordingStartTime from metadata:', {
        //   raw: projectData.metadata.RecordingStartTime,
        //   parsed: new Date(recordingStart).toISOString(),
        //   timestamp: recordingStart
        // });
      } else if (projectData.metadata.Timestamps && projectData.metadata.Timestamps.length > 0) {
        // Fallback: Calculate from first timestamp (old projects without RecordingStartTime)
        const firstTimestamp = projectData.metadata.Timestamps[0];
        const firstDatetime = new Date(firstTimestamp.DateTime).getTime();
        // Parse StartTime to get offset (format: HH:MM:SS.NNNNNNN with 7 decimal digits)
        const startTimeMatch = firstTimestamp.StartTime.match(/(\d+):(\d+):(\d+)\.(\d+)/);
        if (startTimeMatch) {
          const fractionalPart = startTimeMatch[4];
          // Convert to milliseconds: if 7 digits (e.g., 9900000), divide by 10000
          const ms = fractionalPart.length === 7 ? parseInt(fractionalPart) / 10000 : parseInt(fractionalPart);
          const offsetMs = parseInt(startTimeMatch[1]) * 3600000 + 
                          parseInt(startTimeMatch[2]) * 60000 + 
                          parseInt(startTimeMatch[3]) * 1000 + 
                          ms;
          recordingStart = firstDatetime - offsetMs;
          
          // console.log('🕐 Calculated RecordingStartTime from first block:', {
          //   raw: firstTimestamp.StartTime,
          //   fractionalPart,
          //   parsedMs: ms,
          //   totalOffsetMs: offsetMs,
          //   firstDatetime: new Date(firstDatetime).toISOString(),
          //   calculatedRecordingStart: new Date(recordingStart).toISOString()
          // });
        }
      }
      
      if (projectData.metadata.Timestamps && Array.isArray(projectData.metadata.Timestamps)) {
        // Reconstruct notes from Timestamps array
        const BLOCK_SEPARATOR = '§§§';
        const sortedTimestamps = projectData.metadata.Timestamps.sort((a: any, b: any) => a.Index - b.Index);
        
        sortedTimestamps.forEach((ts: any, index: number) => {
          // Add BLOCK_SEPARATOR before text (except for first line)
          if (index > 0) {
            notesText += BLOCK_SEPARATOR;
          }
          
          // Calculate position at start of this block (after separator if not first)
          const position = notesText.length;
          
          // Parse StartTime (relative time) from metadata and convert to absolute datetime
          // StartTime format: HH:MM:SS.NNNNNNN (7 decimal digits)
          let startTimeMs = 0;
          const startTimeMatch = ts.StartTime.match(/(\d+):(\d+):(\d+)\.(\d+)/);
          if (startTimeMatch) {
            const hours = parseInt(startTimeMatch[1]);
            const minutes = parseInt(startTimeMatch[2]);
            const seconds = parseInt(startTimeMatch[3]);
            const fractionalPart = startTimeMatch[4];
            // Convert to milliseconds: if 7 digits, divide by 10000
            const ms = fractionalPart.length === 7 ? parseInt(fractionalPart) / 10000 : parseInt(fractionalPart);
            startTimeMs = hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
          }
          
          // Convert relative time to absolute datetime using RecordingStartTime
          const datetime = recordingStart + startTimeMs;
          timestampMapData.set(position, datetime);
          
          // Store speaker name using lineIndex (which equals index in sorted array)
          // Each timestamp entry corresponds to one line in the reconstructed notes
          if (ts.Speaker) {
            speakersMapData.set(index, ts.Speaker);
            // console.log(`📢 Loading speaker for line ${index}:`, ts.Speaker);
          }
          
          // Add text to notes
          notesText += ts.Text || '';
        });
        
        // console.log('🕐 Timestamp reconstruction:', {
        //   recordingStart,
        //   firstTimestamp: sortedTimestamps[0]?.DateTime,
        //   firstStartTime: sortedTimestamps[0]?.StartTime,
        //   timestampCount: timestampMapData.size,
        //   speakerCount: speakersMapData.size,
        //   speakers: Array.from(speakersMapData.entries()),
        //   sampleTimestamps: Array.from(timestampMapData.entries()).slice(0, 3).map(([pos, time]) => ({
        //     position: pos,
        //     datetime: new Date(time).toISOString(),
        //     relativeMs: time - recordingStart,
        //     relativeFormatted: `${String(Math.floor((time - recordingStart) / 3600000)).padStart(2, '0')}:${String(Math.floor(((time - recordingStart) % 3600000) / 60000)).padStart(2, '0')}:${String(Math.floor(((time - recordingStart) % 60000) / 1000)).padStart(2, '0')}`
        //   }))
        // });
      }

      // Parse duration string to milliseconds (format: HH:MM:SS.NNNNNNN with 7 decimal digits)
      let durationMs = 0;
      if (projectData.metadata.Duration) {
        const durationStr = projectData.metadata.Duration;
        const match = durationStr.match(/(\d+):(\d+):(\d+)\.(\d+)/);
        if (match) {
          const hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          const seconds = parseInt(match[3]);
          const fractionalPart = match[4];
          // Convert to milliseconds: if 7 digits, divide by 10000
          const ms = fractionalPart.length === 7 ? parseInt(fractionalPart) / 10000 : parseInt(fractionalPart);
          durationMs = hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
        }
      }

      // Call parent handler to update all state (recordingStart already calculated above)
      onLoadProject({
        meetingInfo: loadedMeetingInfo,
        notes: notesText,
        timestampMap: timestampMapData,
        speakersMap: speakersMapData,
        audioBlob: projectData.audioBlob,
        recordingStartTime: recordingStart
      });

      // Load transcription data if available
      if (projectData.transcriptionData) {
        // console.log('📝 Loading transcription data:', projectData.transcriptionData);
        onClearTranscriptions(); // Clear existing first
        
        // Load each transcription result
        if (projectData.transcriptionData.transcriptions && Array.isArray(projectData.transcriptionData.transcriptions)) {
          projectData.transcriptionData.transcriptions.forEach((t: TranscriptionResult) => {
            onNewTranscription(t);
          });
          message.success(`Loaded ${projectData.transcriptionData.transcriptions.length} transcription results`);
        }
      }

      // console.log('Load complete:', {
      //   meetingInfo: loadedMeetingInfo,
      //   notesLength: notesText.length,
      //   timestampCount: timestampMapData.size,
      //   timestampMap: Array.from(timestampMapData.entries()),
      //   recordingStart
      // });

      // Update local state
      setLastProjectName(projectData.projectName);
      setLastRecordingDuration(durationMs);

      // Update folder path display to show where files will be saved
      // Priority: Parent folder > Project folder
      const parentHandle = fileManager.getParentDirHandle();
      const projectHandle = fileManager.getProjectDirHandle();
      
      if (parentHandle) {
        onFolderSelect(parentHandle.name + ' (parent of loaded project)');
      } else if (projectHandle) {
        onFolderSelect(projectHandle.name + ' (loaded project folder)');
      }

      message.success(`Project loaded: ${projectData.projectName}`);
    } catch (error: any) {
      console.error('Load project error:', error);
      message.error(`Failed to load project: ${error.message}`);
    }
  };

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="recording-controls">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        {/* Left side: Main controls */}
        <Space size="middle" wrap>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={handleSelectFolder}
            disabled={isRecording}
            size="large"
          >
            Chọn thư mục
          </Button>

          <Button
            icon={<FolderAddOutlined />}
            onClick={() => {
              handleLoadProject();
            }}
            disabled={isRecording || !FileManagerService.isSupported()}
            size="large"
            type="default"
          >
            Tải dự án đã lưu
          </Button>

          {!isRecording ? (
            <>
              <Button
                type="primary"
                danger
                icon={<AudioOutlined />}
                onClick={handleStartRecording}
                size="large"
              >
                Ghi âm
              </Button>
              
              {/* Show Continue Recording button if there are segments */}
              {recordingSegments.length > 0 && (
                <Button
                  type="primary"
                  icon={<AudioOutlined />}
                  onClick={handleContinueRecording}
                  size="large"
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                >
                  Tiếp tục ghi âm
                </Button>
              )}
            </>
          ) : (
            <Button
              type="primary"
              icon={<StopOutlined />}
              onClick={handleStopRecording}
              size="large"
            >
              Dừng
            </Button>
          )}

          {/* Show Save Notes button when has unsaved data but not saved yet */}
          {!isRecording && !isSaved && hasUnsavedChanges && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveNotes}
              size="large"
            >
              Lưu ghi chú
            </Button>
          )}

          {/* Show Save Changes button when has unsaved changes after first save */}
          {!isRecording && isSaved && hasUnsavedChanges && (
            <Button
              type="default"
              icon={<SaveOutlined />}
              onClick={handleSaveChanges}
              size="large"
              style={{ backgroundColor: '#52c41a', color: 'white', borderColor: '#52c41a' }}
            >
              Lưu thay đổi
            </Button>
          )}

          <span className="duration-display">⏱ {formatDuration(duration)}</span>
          
          {isRecording && (
            <span className="recording-indicator">🔴 Recording...</span>
          )}
        </Space>

        {/* Right side: Speech-to-Text Controls - Only show when online */}
        {navigator.onLine && (
          <Space size="middle" wrap style={{ marginLeft: 'auto' }}>
            <Button
              icon={<SettingOutlined />}
              onClick={onShowTranscriptionConfig}
              disabled={isRecording}
              size="large"
              className={!transcriptionConfig ? 'blink-btn' : ''}
            >
              Cấu hình Speech-to-Text
            </Button>

            {transcriptionConfig && (
              <Tooltip title={isRecording ? 'Bật/tắt chuyển đổi giọng nói sang văn bản tự động' : 'Chỉ khả dụng khi đang ghi âm'}>
                <Space>
                  <SoundOutlined style={{ fontSize: '18px', color: autoTranscribe ? '#52c41a' : '#999' }} />
                  <span style={{ fontSize: '14px' }}>Tự động chuyển giọng nói thành văn bản:</span>
                  <Switch
                    checked={autoTranscribe}
                    onChange={(checked) => {
                      setAutoTranscribe(checked);
                      if (!checked) {
                        onClearTranscriptions();
                      }
                    }}
                    disabled={isRecording}
                    checkedChildren="ON"
                    unCheckedChildren="OFF"
                  />
                </Space>
              </Tooltip>
            )}

            {!transcriptionConfig && (
              <span style={{ fontSize: '13px', color: '#999', fontStyle: 'italic' }}>
                ℹ️ Cấu hình để sử dụng
              </span>
            )}
          </Space>
        )}
      </div>

      {folderPath && (
        <div className="folder-info">
          📁 Thư mục hiện tại: <strong>{folderPath}</strong>
        </div>
      )}

      {!FileManagerService.isSupported() && (
        <div className="browser-warning">
          ⚠️ Trình duyệt của bạn không hỗ trợ truy cập thư mục trực tiếp. Các file sẽ được tải về.
        </div>
      )}
    </div>
  );
};
