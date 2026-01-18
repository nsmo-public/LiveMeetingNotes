import type { FileSystemDirectoryHandle } from '../types/types';

// Helper function to add timestamp prefix to filename
function addTimestampPrefix(fileName: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const prefix = `${year}${month}${day}_${hours}${minutes}_`;
  return prefix + fileName;
}

export class FileManagerService {
  private dirHandle: FileSystemDirectoryHandle | null = null;

  async selectFolder(): Promise<string | null> {
    try {
      // Check if API is supported
      if (!('showDirectoryPicker' in window)) {
        throw new Error('File System Access API not supported. Please use Chrome or Edge.');
      }

      this.dirHandle = await window.showDirectoryPicker!({
        mode: 'readwrite'
      });

      return this.dirHandle.name;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return null; // User cancelled
      }
      throw error;
    }
  }

  async saveAudioFile(audioBlob: Blob, fileName: string): Promise<string> {
    if (!this.dirHandle) {
      throw new Error('No folder selected. Please select a folder first.');
    }

    const fileNameWithTimestamp = addTimestampPrefix(fileName);

    // Create file in selected directory
    const fileHandle = await this.dirHandle.getFileHandle(fileNameWithTimestamp, {
      create: true
    });

    const writable = await fileHandle.createWritable();
    await writable.write(audioBlob);
    await writable.close();

    return fileNameWithTimestamp;
  }

  async saveMetadataFile(data: any, fileName: string): Promise<void> {
    if (!this.dirHandle) {
      throw new Error('No folder selected');
    }

    const fileNameWithTimestamp = addTimestampPrefix(fileName);

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const fileHandle = await this.dirHandle.getFileHandle(fileNameWithTimestamp, {
      create: true
    });

    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  async saveWordFile(wordBlob: Blob, fileName: string): Promise<void> {
    if (!this.dirHandle) {
      throw new Error('No folder selected');
    }

    const fileNameWithTimestamp = addTimestampPrefix(fileName);

    const fileHandle = await this.dirHandle.getFileHandle(fileNameWithTimestamp, {
      create: true
    });

    const writable = await fileHandle.createWritable();
    await writable.write(wordBlob);
    await writable.close();
  }

  async createProjectDirectory(projectName: string): Promise<void> {
    if (!this.dirHandle) {
      throw new Error('No folder selected');
    }

    // Create subdirectory for project
    await this.dirHandle.getDirectoryHandle(projectName, {
      create: true
    });
  }

  // Check if File System Access API is supported
  static isSupported(): boolean {
    return 'showDirectoryPicker' in window;
  }
}

// Fallback for browsers without File System Access API
export class FileDownloadService {
  async downloadAudioFile(audioBlob: Blob, fileName: string): Promise<void> {
    const fileNameWithTimestamp = addTimestampPrefix(fileName);
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNameWithTimestamp;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async downloadMetadataFile(data: any, fileName: string): Promise<void> {
    const fileNameWithTimestamp = addTimestampPrefix(fileName);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNameWithTimestamp;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async downloadTextFile(content: string, fileName: string): Promise<void> {
    const fileNameWithTimestamp = addTimestampPrefix(fileName);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNameWithTimestamp;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
