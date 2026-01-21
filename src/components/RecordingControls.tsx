import React, { useState, useEffect } from 'react';
import { Button, Space, message, Switch, Tooltip } from 'antd';
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
    audioBlob: Blob | null;
    recordingStartTime: number;
  }) => void;
  meetingInfo: MeetingInfo;
  notes: string;
  timestampMap: Map<number, number>;
  recordingStartTime: number;
  onRecordingStartTimeChange: (time: number) => void;
  audioBlob: Blob | null;
  isSaved: boolean;
  hasUnsavedChanges: boolean;
  // Speech-to-Text props
  onShowTranscriptionConfig: () => void;
  transcriptionConfig: SpeechToTextConfig | null;
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
  const [duration, setDuration] = useState<number>(0);
  const [recorder] = useState(() => new AudioRecorderService());
  const [fileManager] = useState(() => new FileManagerService());
  const [lastProjectName, setLastProjectName] = useState<string>('');
  const [lastRecordingDuration, setLastRecordingDuration] = useState<number>(0);
  const [autoTranscribe, setAutoTranscribe] = useState<boolean>(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

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
      if (isRecording && autoTranscribe && transcriptionConfig && navigator.onLine) {
        try {
          // Get audio stream from navigator
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 48000
            }
          });
          
          setAudioStream(stream);
          
          // Start transcription
          await speechToTextService.startTranscription(stream, onNewTranscription);
          message.success('🎤 Bắt đầu chuyển đổi giọng nói sang văn bản');
        } catch (error: any) {
          console.error('Failed to start transcription:', error);
          message.error('Không thể bắt đầu chuyển đổi: ' + error.message);
        }
      } else if (!isRecording || !autoTranscribe) {
        // Stop transcription
        if (audioStream) {
          speechToTextService.stopTranscription();
          audioStream.getTracks().forEach(track => track.stop());
          setAudioStream(null);
        }
      }
    };

    startTranscription();

    // Cleanup on unmount
    return () => {
      if (audioStream) {
        speechToTextService.stopTranscription();
        audioStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isRecording, autoTranscribe, transcriptionConfig]);

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
      onRecordingChange(true);
      setDuration(0);
      message.success('Recording started');
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
    return sanitized || 'Meeting';
  };

  const handleStopRecording = async () => {
    try {
      const audioBlob = await recorder.stopRecording();
      const recordingDuration = recorder.getCurrentDuration();
      onRecordingChange(false);

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
      const audioFileName = `${projectName}.webm`;

      // Save files
      if (FileManagerService.isSupported() && folderPath) {
        // Create project subdirectory and save all files there
        await fileManager.createProjectDirectory(projectName);
        // Skip prefix for files in subfolder since folder name already has timestamp
        await fileManager.saveAudioFile(audioBlob, audioFileName, projectName, true);

        // Build and save metadata
        const metadata = MetadataBuilder.buildMetadata(
          meetingInfo,
          notes,
          timestampMap,
          recordingDuration,
          audioFileName,
          recordingStartTime
        );

        await fileManager.saveMetadataFile(
          metadata.meetingInfo,
          `${projectName}_meeting_info.json`,
          projectName,
          true
        );
        await fileManager.saveMetadataFile(
          metadata.metadata,
          `${projectName}_metadata.json`,
          projectName,
          true
        );

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
            projectName,
            true
          );
          console.log('💾 Transcription data saved:', transcriptionData.totalCount, 'items');
        }

        // Export Word document to same folder
        const wordBlob = await WordExporter.createWordBlob(meetingInfo, notes);
        await fileManager.saveWordFile(wordBlob, `${projectName}.docx`, projectName, true);

        message.success(`Recording saved to folder: ${projectName}`);
        setLastProjectName(projectName);
        setLastRecordingDuration(recordingDuration);
        onSaveComplete(); // Notify parent that save is complete
      } else {
        // Fallback: download files
        const downloader = new FileDownloadService();
        await downloader.downloadAudioFile(audioBlob, audioFileName);

        const metadata = MetadataBuilder.buildMetadata(
          meetingInfo,
          notes,
          timestampMap,
          recordingDuration,
          audioFileName,
          recordingStartTime
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
        }

        // Export Word document
        await WordExporter.exportToWord(
          meetingInfo,
          notes,
          `${projectName}.docx`
        );

        message.info('Files downloaded. Please save them to your meeting notes folder.');
        setLastProjectName(projectName);
        setLastRecordingDuration(recordingDuration);
        onSaveComplete(); // Notify parent that save is complete
      }

      // Set audio for playback
      onAudioBlobChange(audioBlob);
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
        await WordExporter.exportToWord(
          meetingInfo,
          notes,
          `${projectName}.docx`
        );
        
        message.info('Files downloaded. Please save them to your meeting notes folder.');
        setLastProjectName(projectName);
        onSaveComplete();
        return;
      }
      
      // Check if folder is selected
      if (!folderPath && !fileManager.getParentDirHandle() && !fileManager.getProjectDirHandle()) {
        // No folder selected, prompt user
        const folder = await fileManager.selectFolder();
        if (!folder) {
          message.info('Please select a folder to save your notes.');
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
      
      // Create project subdirectory
      await fileManager.createProjectDirectory(projectName);
      
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
        projectName,
        true
      );
      
      // Create minimal metadata for notes-only project
      const notesMetadata = {
        ProjectName: projectName,
        Model: 'Notes Only',
        Language: 'vi',
        OriginalFileName: '',
        AudioFileName: '',
        Duration: '00:00:00.0000000',
        RecordingStartTime: new Date().toISOString(),
        Timestamps: notes ? [{
          Index: 0,
          Text: notes,
          DateTime: new Date().toISOString(),
          StartTime: '00:00:00.0000000',
          EndTime: '00:00:00.0000000',
          Highlight: false
        }] : []
      };
      
      await fileManager.saveMetadataFile(
        notesMetadata,
        `${projectName}_metadata.json`,
        projectName,
        true
      );
      
      // Export Word document
      const wordBlob = await WordExporter.createWordBlob(meetingInfo, notes);
      await fileManager.saveWordFile(wordBlob, `${projectName}.docx`, projectName, true);
      
      message.success(`Notes saved to folder: ${projectName}`);
      setLastProjectName(projectName);
      onSaveComplete();
    } catch (error: any) {
      message.error(`Failed to save notes: ${error.message}`);
    }
  };

  const handleSaveChanges = async () => {
    try {
      if (!lastProjectName) {
        message.error('No project to update');
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
        // Notes-only project metadata (convert to PascalCase format)
        metadata = {
          meetingInfo: {
            MeetingTitle: meetingInfo.title,
            MeetingDate: meetingInfo.date,
            MeetingTime: meetingInfo.time,
            Location: meetingInfo.location,
            Host: meetingInfo.host,
            Attendees: meetingInfo.attendees,
          },
          metadata: {
            ProjectName: newProjectName,
            Model: 'Notes Only',
            Language: 'vi',
            OriginalFileName: '',
            AudioFileName: '',
            Duration: '00:00:00.0000000',
            RecordingStartTime: recordingStartTime ? new Date(recordingStartTime).toISOString() : new Date().toISOString(),
            Timestamps: notes ? [{
              Index: 0,
              Text: notes,
              DateTime: new Date().toISOString(),
              StartTime: '00:00:00.0000000',
              EndTime: '00:00:00.0000000',
              Highlight: false
            }] : []
          }
        };
      } else {
        // Recording project with audio
        const audioFileName = `${newProjectName}.webm`;
        metadata = MetadataBuilder.buildMetadata(
          meetingInfo,
          notes,
          timestampMap,
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
          if (saveHandle) {
            fileManager.setDirHandle(saveHandle);
          }
          
          // Create new project subdirectory
          await fileManager.createProjectDirectory(newProjectName);
          
          // Save audio file only if it exists (recording project)
          if (audioBlob) {
            const audioFileName = `${newProjectName}.webm`;
            await fileManager.saveAudioFile(audioBlob, audioFileName, newProjectName, true);
          }

          // Save metadata files
          await fileManager.saveMetadataFile(
            metadata.meetingInfo,
            `${newProjectName}_meeting_info.json`,
            newProjectName,
            true
          );
          await fileManager.saveMetadataFile(
            metadata.metadata,
            `${newProjectName}_metadata.json`,
            newProjectName,
            true
          );

          // Export Word document
          const wordBlob = await WordExporter.createWordBlob(meetingInfo, notes);
          await fileManager.saveWordFile(wordBlob, `${newProjectName}.docx`, newProjectName, true);

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

        
        await WordExporter.exportToWord(
          meetingInfo,
          notes,
          `${newProjectName}.docx`
        );

        message.info('Updated files downloaded as new version.');
        setLastProjectName(newProjectName);
      }

      onSaveComplete(); // Notify parent that save is complete
    } catch (error: any) {
      message.error(`Failed to save changes: ${error.message}`);
    }
  };

  const handleLoadProject = async () => {
    console.log('handleLoadProject called');
    
    try {
      if (!FileManagerService.isSupported()) {
        console.error('Browser not supported');
        message.error('Your browser does not support loading projects. Please use Chrome or Edge.');
        return;
      }

      console.log('Checking unsaved changes...');
      if (hasUnsavedChanges) {
        const confirmed = window.confirm(
          'Bạn có dữ liệu chưa lưu. Tải project mới sẽ mất dữ liệu hiện tại. Tiếp tục?'
        );
        if (!confirmed) {
          console.log('User cancelled due to unsaved changes');
          return;
        }
      }

      console.log('Calling fileManager.loadProjectFromFolder...');
      const projectData = await fileManager.loadProjectFromFolder();
      
      console.log('fileManager returned:', projectData);
      
      if (!projectData) {
        console.log('User cancelled folder selection');
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

      console.log('📋 Mapping meetingInfo from file:', {
        rawData: projectData.meetingInfo,
        mapped: loadedMeetingInfo
      });
      
      console.log('🔍 Individual field mapping:', {
        'MeetingTitle → title': `"${projectData.meetingInfo.MeetingTitle}" → "${loadedMeetingInfo.title}"`,
        'MeetingDate → date': `"${projectData.meetingInfo.MeetingDate}" → "${loadedMeetingInfo.date}"`,
        'MeetingTime → time': `"${projectData.meetingInfo.MeetingTime}" → "${loadedMeetingInfo.time}"`,
        'Location → location': `"${projectData.meetingInfo.Location}" → "${loadedMeetingInfo.location}"`,
        'Host → host': `"${projectData.meetingInfo.Host}" → "${loadedMeetingInfo.host}"`,
        'Attendees → attendees': `"${projectData.meetingInfo.Attendees}" → "${loadedMeetingInfo.attendees}"`
      });

      // Parse metadata to reconstruct timestampMap and notes
      const timestampMapData = new Map<number, number>();
      let notesText = '';
      
      // Get recording start time - prefer from metadata, fallback to calculation
      let recordingStart = Date.now();
      
      if (projectData.metadata.RecordingStartTime) {
        // Use saved RecordingStartTime from metadata (chuẩn nhất)
        recordingStart = new Date(projectData.metadata.RecordingStartTime).getTime();
        
        console.log('🕐 Using RecordingStartTime from metadata:', {
          raw: projectData.metadata.RecordingStartTime,
          parsed: new Date(recordingStart).toISOString(),
          timestamp: recordingStart
        });
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
          
          console.log('🕐 Calculated RecordingStartTime from first block:', {
            raw: firstTimestamp.StartTime,
            fractionalPart,
            parsedMs: ms,
            totalOffsetMs: offsetMs,
            firstDatetime: new Date(firstDatetime).toISOString(),
            calculatedRecordingStart: new Date(recordingStart).toISOString()
          });
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
          
          // Add text to notes
          notesText += ts.Text || '';
        });
        
        console.log('🕐 Timestamp reconstruction:', {
          recordingStart,
          firstTimestamp: sortedTimestamps[0]?.DateTime,
          firstStartTime: sortedTimestamps[0]?.StartTime,
          timestampCount: timestampMapData.size,
          sampleTimestamps: Array.from(timestampMapData.entries()).slice(0, 3).map(([pos, time]) => ({
            position: pos,
            datetime: new Date(time).toISOString(),
            relativeMs: time - recordingStart,
            relativeFormatted: `${String(Math.floor((time - recordingStart) / 3600000)).padStart(2, '0')}:${String(Math.floor(((time - recordingStart) % 3600000) / 60000)).padStart(2, '0')}:${String(Math.floor(((time - recordingStart) % 60000) / 1000)).padStart(2, '0')}`
          }))
        });
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
        audioBlob: projectData.audioBlob,
        recordingStartTime: recordingStart
      });

      // Load transcription data if available
      if (projectData.transcriptionData) {
        console.log('📝 Loading transcription data:', projectData.transcriptionData);
        onClearTranscriptions(); // Clear existing first
        
        // Load each transcription result
        if (projectData.transcriptionData.transcriptions && Array.isArray(projectData.transcriptionData.transcriptions)) {
          projectData.transcriptionData.transcriptions.forEach((t: TranscriptionResult) => {
            onNewTranscription(t);
          });
          message.success(`Loaded ${projectData.transcriptionData.transcriptions.length} transcription results`);
        }
      }

      console.log('Load complete:', {
        meetingInfo: loadedMeetingInfo,
        notesLength: notesText.length,
        timestampCount: timestampMapData.size,
        timestampMap: Array.from(timestampMapData.entries()),
        recordingStart
      });

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
      <Space size="middle" wrap>
        <Button
          icon={<FolderOpenOutlined />}
          onClick={handleSelectFolder}
          disabled={isRecording}
          size="large"
        >
          Select Folder
        </Button>

        <Button
          icon={<FolderAddOutlined />}
          onClick={() => {
            console.log('Load Project button clicked');
            console.log('isRecording:', isRecording);
            console.log('isSupported:', FileManagerService.isSupported());
            handleLoadProject();
          }}
          disabled={isRecording || !FileManagerService.isSupported()}
          size="large"
          type="default"
        >
          Load Project
        </Button>

        {!isRecording ? (
          <Button
            type="primary"
            danger
            icon={<AudioOutlined />}
            onClick={handleStartRecording}
            size="large"
          >
            Record
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<StopOutlined />}
            onClick={handleStopRecording}
            size="large"
          >
            Stop
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
            Save Notes
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
            Save Changes
          </Button>
        )}

        <span className="duration-display">⏱ {formatDuration(duration)}</span>
        
        {isRecording && (
          <span className="recording-indicator">🔴 Recording...</span>
        )}
      </Space>

      {/* Speech-to-Text Controls - Only show when online */}
      {navigator.onLine && (
        <Space size="middle" wrap style={{ marginTop: '12px' }}>
          <Button
            icon={<SettingOutlined />}
            onClick={onShowTranscriptionConfig}
            disabled={isRecording}
            size="large"
          >
            Cấu hình Speech-to-Text
          </Button>

          {transcriptionConfig && (
            <>
              <Tooltip title={isRecording ? 'Bật/tắt chuyển đổi giọng nói sang văn bản tự động' : 'Chỉ khả dụng khi đang ghi âm'}>
                <Space>
                  <SoundOutlined style={{ fontSize: '18px', color: autoTranscribe ? '#52c41a' : '#999' }} />
                  <span style={{ fontSize: '14px' }}>Auto Transcribe:</span>
                  <Switch
                    checked={autoTranscribe}
                    onChange={(checked) => {
                      setAutoTranscribe(checked);
                      if (!checked) {
                        onClearTranscriptions();
                      }
                    }}
                    disabled={!isRecording}
                    checkedChildren="ON"
                    unCheckedChildren="OFF"
                  />
                </Space>
              </Tooltip>
            </>
          )}

          {!transcriptionConfig && (
            <span style={{ fontSize: '13px', color: '#999', fontStyle: 'italic' }}>
              ℹ️ Cấu hình Speech-to-Text để sử dụng chức năng chuyển đổi tự động
            </span>
          )}
        </Space>
      )}

      {folderPath && (
        <div className="folder-info">
          📁 Current Folder: <strong>{folderPath}</strong>
        </div>
      )}

      {!FileManagerService.isSupported() && (
        <div className="browser-warning">
          ⚠️ Your browser doesn't support direct folder access. Files will be downloaded.
        </div>
      )}
    </div>
  );
};
