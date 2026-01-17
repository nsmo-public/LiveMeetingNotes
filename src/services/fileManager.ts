import type { FileSystemDirectoryHandle } from '../types/types';

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

    // Create file in selected directory
    const fileHandle = await this.dirHandle.getFileHandle(fileName, {
      create: true
    });

    const writable = await fileHandle.createWritable();
    await writable.write(audioBlob);
    await writable.close();

    return fileName;
  }

  async saveMetadataFile(data: any, fileName: string): Promise<void> {
    if (!this.dirHandle) {
      throw new Error('No folder selected');
    }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const fileHandle = await this.dirHandle.getFileHandle(fileName, {
      create: true
    });

    const writable = await fileHandle.createWritable();
    await writable.write(blob);
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
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async downloadMetadataFile(data: any, fileName: string): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async downloadTextFile(content: string, fileName: string): Promise<void> {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
