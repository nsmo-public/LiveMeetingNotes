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
    root: HTMLElement;
  }

  interface QuillOptions {
    theme?: string;
    modules?: any;
    placeholder?: string;
  }
}

declare module 'quill/dist/quill.snow.css';

declare module 'file-saver' {
  export function saveAs(blob: Blob, filename: string): void;
}

declare module 'docx' {
  export class Document {
    constructor(options: any);
  }
  export class Paragraph {
    constructor(options: any);
  }
  export class TextRun {
    constructor(options: any);
  }
  export const HeadingLevel: any;
  export const AlignmentType: any;
  export class Packer {
    static toBlob(doc: Document): Promise<Blob>;
  }
}

// Add type declarations for SpeechRecognition and webkitSpeechRecognition
declare interface Window {
  SpeechRecognition: typeof SpeechRecognition;
  webkitSpeechRecognition: typeof SpeechRecognition;
}

declare class SpeechRecognition {
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  // Add other properties and methods as needed
  abort(): void;
}
