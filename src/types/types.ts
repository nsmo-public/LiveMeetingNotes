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

// Google Cloud Speech-to-Text types
export interface SpeechToTextConfig {
  apiKey: string;
  apiEndpoint?: string;
  languageCode: string;
  enableSpeakerDiarization: boolean;
  enableAutomaticPunctuation: boolean;
}

export interface TranscriptionResult {
  id: string;
  text: string;
  startTime: string; // ISO format datetime
  endTime: string;   // ISO format datetime
  confidence: number;
  speaker?: string;  // Speaker identification (if enabled)
  isFinal: boolean;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
  words?: Array<{
    word: string;
    startTime: string;
    endTime: string;
    speakerTag?: number;
  }>;
}

export interface SpeechRecognitionResult {
  alternatives: SpeechRecognitionAlternative[];
  isFinal: boolean;
  resultEndTime: string;
  languageCode: string;
}

// Extend Window interface for File System Access API
declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite';
    }) => Promise<FileSystemDirectoryHandle>;
  }
}
