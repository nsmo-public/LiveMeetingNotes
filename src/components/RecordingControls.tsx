import React, { useState, useEffect } from 'react';
import { Button, Space, message } from 'antd';
import {
  FolderOpenOutlined,
  AudioOutlined,
  StopOutlined
} from '@ant-design/icons';
import { AudioRecorderService } from '../services/audioRecorder';
import { FileManagerService, FileDownloadService } from '../services/fileManager';
import { MetadataBuilder } from '../services/metadataBuilder';
import type { MeetingInfo } from '../types/types';

interface Props {
  folderPath: string;
  onFolderSelect: (path: string) => void;
  isRecording: boolean;
  onRecordingChange: (recording: boolean) => void;
  onAudioBlobChange: (blob: Blob | null) => void;
  meetingInfo: MeetingInfo;
  notes: string;
  timestampMap: Map<number, number>;
}

export const RecordingControls: React.FC<Props> = ({
  folderPath,
  onFolderSelect,
  isRecording,
  onRecordingChange,
  onAudioBlobChange,
  meetingInfo,
  notes,
  timestampMap
}) => {
  const [duration, setDuration] = useState<number>(0);
  const [recorder] = useState(() => new AudioRecorderService());
  const [fileManager] = useState(() => new FileManagerService());

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
      onRecordingChange(true);
      setDuration(0);
      message.success('Recording started');
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleStopRecording = async () => {
    try {
      const audioBlob = await recorder.stopRecording();
      const recordingDuration = recorder.getCurrentDuration();
      onRecordingChange(false);

      // Generate file names
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
      const projectName = `Meeting_${timestamp}`;
      const audioFileName = `${projectName}.wav`;

      // Save files
      if (FileManagerService.isSupported() && folderPath) {
        // Save to user-selected folder
        await fileManager.saveAudioFile(audioBlob, audioFileName);

        // Build and save metadata
        const metadata = MetadataBuilder.buildMetadata(
          meetingInfo,
          notes,
          timestampMap,
          recordingDuration,
          audioFileName
        );

        await fileManager.saveMetadataFile(
          metadata.meetingInfo,
          `${projectName}_meeting_info.json`
        );
        await fileManager.saveMetadataFile(
          metadata.metadata,
          'metadata.json'
        );

        message.success('Recording saved successfully!');
      } else {
        // Fallback: download files
        const downloader = new FileDownloadService();
        await downloader.downloadAudioFile(audioBlob, audioFileName);

        const metadata = MetadataBuilder.buildMetadata(
          meetingInfo,
          notes,
          timestampMap,
          recordingDuration,
          audioFileName
        );

        await downloader.downloadMetadataFile(
          metadata.meetingInfo,
          `${projectName}_meeting_info.json`
        );
        await downloader.downloadMetadataFile(
          metadata.metadata,
          'metadata.json'
        );

        message.info('Files downloaded. Please save them to your meeting notes folder.');
      }

      // Set audio for playback
      onAudioBlobChange(audioBlob);
    } catch (error: any) {
      message.error(`Failed to stop recording: ${error.message}`);
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

        <span className="duration-display">⏱ {formatDuration(duration)}</span>
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

      {isRecording && (
        <div className="recording-status">
          <span className="recording-indicator">🔴 Recording...</span>
        </div>
      )}
    </div>
  );
};
