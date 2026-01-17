// Type declarations for modules without official types
declare module 'recordrtc' {
  export default RecordRTC;

  class RecordRTC {
    constructor(stream: MediaStream, options: RecordRTCOptions);
    startRecording(): void;
    stopRecording(callback: () => void): void;
    getBlob(): Blob;
    static StereoAudioRecorder: any;
  }

  interface RecordRTCOptions {
    type: string;
    mimeType: string;
    recorderType?: any;
    numberOfAudioChannels?: number;
    desiredSampRate?: number;
    disableLogs?: boolean;
  }
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module 'quill' {
  export default Quill;

  class Quill {
    constructor(container: Element, options?: QuillOptions);
    on(eventName: string, handler: (...args: any[]) => void): void;
    getText(): string;
    getSelection(focus?: boolean): { index: number; length: number } | null;
    insertText(index: number, text: string, formats?: any): void;
    setSelection(index: number, length: number): void;
  }

  interface QuillOptions {
    theme?: string;
    modules?: any;
    placeholder?: string;
  }
}

declare module 'quill/dist/quill.snow.css';
