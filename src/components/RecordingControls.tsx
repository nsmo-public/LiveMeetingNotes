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

      // Save files - create new version like when stopping recording
      if (FileManagerService.isSupported() && folderPath) {
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
        // Update last project name for potential future saves
        setLastProjectName(newProjectName);
      } else {
        // Download updated files
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
    try {
      if (!FileManagerService.isSupported()) {
        message.error('Your browser does not support loading projects. Please use Chrome or Edge.');
        return;
      }

      if (hasUnsavedChanges) {
        const confirmed = window.confirm(
          'Bạn có dữ liệu chưa lưu. Tải project mới sẽ mất dữ liệu hiện tại. Tiếp tục?'
        );
        if (!confirmed) return;
      }

      const projectData = await fileManager.loadProjectFromFolder();
      
      if (!projectData) {
        return; // User cancelled
      }

      // Parse metadata to reconstruct timestampMap
      const timestampMapData = new Map<number, number>();
      if (projectData.metadata.timestamps) {
        projectData.metadata.timestamps.forEach((ts: { position: number; time: number }) => {
          timestampMapData.set(ts.position, ts.time);
        });
      }

      // Call parent handler to update all state
      onLoadProject({
        meetingInfo: projectData.meetingInfo,
        notes: projectData.metadata.notes || '',
        timestampMap: timestampMapData,
        audioBlob: projectData.audioBlob,
        recordingStartTime: projectData.metadata.recordingStartTime || Date.now()
      });

      // Update local state
      setLastProjectName(projectData.projectName);
      setLastRecordingDuration(projectData.metadata.duration || 0);

      message.success(`Project loaded: ${projectData.projectName}`);
    } catch (error: any) {
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
          onClick={handleLoadProject}
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
