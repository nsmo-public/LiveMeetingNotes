import React, { useState, useEffect } from 'react';
import { Button, Space, message } from 'antd';
import {
  FolderOpenOutlined,
  AudioOutlined,
  StopOutlined,
  SaveOutlined,
  FolderAddOutlined
} from '@ant-design/icons';
import { AudioRecorderService } from '../services/audioRecorder';
import { FileManagerService, FileDownloadService } from '../services/fileManager';
import { MetadataBuilder } from '../services/metadataBuilder';
import { WordExporter } from '../services/wordExporter';
import type { MeetingInfo } from '../types/types';

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
    audioBlob: Blob;
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
  hasUnsavedChanges
}) => {
  const [duration, setDuration] = useState<number>(0);
  const [recorder] = useState(() => new AudioRecorderService());
  const [fileManager] = useState(() => new FileManagerService());
  const [lastProjectName, setLastProjectName] = useState<string>('');
  const [lastRecordingDuration, setLastRecordingDuration] = useState<number>(0);

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setDuration(recorder.getCurrentDuration());
    }, 100);

    return () => clearInterval(interval);
  }, [isRecording, recorder]);

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
      const audioFileName = `${projectName}.wav`;

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

  const handleSaveChanges = async () => {
    try {
      if (!audioBlob || !lastProjectName) {
        message.error('No recording to update');
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
      const audioFileName = `${newProjectName}.wav`;

      // Build updated metadata with current notes
      const metadata = MetadataBuilder.buildMetadata(
        meetingInfo,
        notes,
        timestampMap,
        lastRecordingDuration,
        audioFileName,
        recordingStartTime
      );

      if (FileManagerService.isSupported()) {
        // Use parent directory from loaded project (same level as original project folder)
        const parentDirHandle = fileManager.getParentDirHandle();
        
        if (parentDirHandle) {
          // Save to parent directory (same location as loaded project)
          fileManager.setDirHandle(parentDirHandle);
          
          // Create new project subdirectory
          await fileManager.createProjectDirectory(newProjectName);
          
          // Save audio file with original audio blob to new folder
          await fileManager.saveAudioFile(audioBlob, audioFileName, newProjectName, true);

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

          message.success(`Changes saved to new folder: ${newProjectName}`);
          setLastProjectName(newProjectName);
        } else if (folderPath) {
          // Fallback to selected folder if no parent handle (old workflow)
          await fileManager.createProjectDirectory(newProjectName);
          await fileManager.saveAudioFile(audioBlob, audioFileName, newProjectName, true);
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
          const wordBlob = await WordExporter.createWordBlob(meetingInfo, notes);
          await fileManager.saveWordFile(wordBlob, `${newProjectName}.docx`, newProjectName, true);
          
          message.success(`Changes saved to new folder: ${newProjectName}`);
          setLastProjectName(newProjectName);
        } else {
          message.error('No save location available. Please use "Select Folder" first.');
        }
      } else {
        // Download updated files (fallback for unsupported browsers)
        const downloader = new FileDownloadService();
        
        await downloader.downloadAudioFile(audioBlob, audioFileName);
        
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
      
      // Calculate recording start time first (needed for timestamp calculation)
      let recordingStart = Date.now();
      if (projectData.metadata.Timestamps && projectData.metadata.Timestamps.length > 0) {
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
          
          console.log('🕐 Parse StartTime:', {
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
          
          // Use DateTime as the timestamp value
          // This will be converted to relative time in formatTimestamp() using recordingStartTime
          const datetime = new Date(ts.DateTime).getTime();
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

        {/* Show Save Changes button when has unsaved changes after first save */}
        {!isRecording && isSaved && audioBlob && hasUnsavedChanges && (
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
