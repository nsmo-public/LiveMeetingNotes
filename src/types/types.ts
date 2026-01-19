// TypeScript interfaces and types for the application

export interface MeetingInfo {
  title: string;
  date: string;
  time: string;
  location: string;
  host: string;
  attendees: string;
}

export interface TranscriptionSegment {
  Index: number;
  Start: string;
  End: string;
  Text: string;
  Highlight: boolean;
}

export interface TranscriptionProject {
  ProjectName: string;
  AudioPath: string;
  ModelName: string;
  Language: string;
  Duration: string;
  Segments: TranscriptionSegment[];
}

export interface MeetingMetadata {
  MeetingTitle: string;
  MeetingDate: string;
  MeetingTime: string;
  Location: string;
  Host: string;
  Attendees: string;
  CreatedAt: string;
}

export interface TimestampEntry {
  position: number;
  timeMs: number;
  text: string;
}

export interface AudioRecorderState {
  isRecording: boolean;
  duration: number;
  error: string | null;
}

export interface FileSystemSupport {
  hasFileSystemAccess: boolean;
  hasFallback: boolean;
}

// Extend Window interface for File System Access API
declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite';
    }) => Promise<FileSystemDirectoryHandle>;
  }
}
