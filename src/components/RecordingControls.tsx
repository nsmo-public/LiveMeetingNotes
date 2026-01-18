import React, { useState, useEffect } from 'react';
import { Button, Space, message } from 'antd';
import {
  FolderOpenOutlined,
  AudioOutlined,
  StopOutlined,
  SaveOutlined
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
        await fileManager.saveAudioFile(audioBlob, audioFileName, projectName);

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
          projectName
        );
        await fileManager.saveMetadataFile(
          metadata.metadata,
          `${projectName}_metadata.json`,
          projectName
        );

        // Export Word document to same folder
        const wordBlob = await WordExporter.createWordBlob(meetingInfo, notes);
        await fileManager.saveWordFile(wordBlob, `${projectName}.docx`, projectName);

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

      const audioFileName = `${lastProjectName}.wav`;

      // Build updated metadata with current notes
      const metadata = MetadataBuilder.buildMetadata(
        meetingInfo,
        notes,
        timestampMap,
        lastRecordingDuration,
        audioFileName,
        recordingStartTime
      );

      // Save files - check if folder was selected via folderPath
      if (folderPath) {
        // Update metadata and Word files in the project folder
        await fileManager.saveMetadataFile(
          metadata.metadata,
          `${lastProjectName}_metadata.json`,
          lastProjectName
        );

        const wordBlob = await WordExporter.createWordBlob(meetingInfo, notes);
        await fileManager.saveWordFile(wordBlob, `${lastProjectName}.docx`, lastProjectName);

        message.success('Changes saved successfully!');
      } else {
        // Download updated files
        const downloader = new FileDownloadService();
        
        await downloader.downloadMetadataFile(
          metadata.metadata,
          `${lastProjectName}_metadata.json`
        );

        await WordExporter.exportToWord(
          meetingInfo,
          notes,
          `${lastProjectName}.docx`
        );

        message.info('Updated files downloaded.');
      }

      onSaveComplete(); // Notify parent that save is complete
    } catch (error: any) {
      message.error(`Failed to save changes: ${error.message}`);
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
