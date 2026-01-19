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
  private parentDirHandle: FileSystemDirectoryHandle | null = null; // Parent of loaded project folder
  private projectDirHandle: FileSystemDirectoryHandle | null = null; // Loaded project folder itself (fallback)

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

  async saveAudioFile(audioBlob: Blob, fileName: string, subDir?: string, skipPrefix?: boolean): Promise<string> {
    if (!this.dirHandle) {
      throw new Error('No folder selected. Please select a folder first.');
    }

    const fileNameWithTimestamp = skipPrefix ? fileName : addTimestampPrefix(fileName);
    const targetDir = subDir ? await this.dirHandle.getDirectoryHandle(subDir, { create: true }) : this.dirHandle;

    // Create file in target directory
    const fileHandle = await targetDir.getFileHandle(fileNameWithTimestamp, {
      create: true
    });

    const writable = await fileHandle.createWritable();
    await writable.write(audioBlob);
    await writable.close();

    return fileNameWithTimestamp;
  }

  async saveMetadataFile(data: any, fileName: string, subDir?: string, skipPrefix?: boolean): Promise<void> {
    if (!this.dirHandle) {
      throw new Error('No folder selected');
    }

    const fileNameWithTimestamp = skipPrefix ? fileName : addTimestampPrefix(fileName);
    const targetDir = subDir ? await this.dirHandle.getDirectoryHandle(subDir, { create: true }) : this.dirHandle;

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const fileHandle = await targetDir.getFileHandle(fileNameWithTimestamp, {
      create: true
    });

    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  async saveWordFile(wordBlob: Blob, fileName: string, subDir?: string, skipPrefix?: boolean): Promise<void> {
    if (!this.dirHandle) {
      throw new Error('No folder selected');
    }

    const fileNameWithTimestamp = skipPrefix ? fileName : addTimestampPrefix(fileName);
    const targetDir = subDir ? await this.dirHandle.getDirectoryHandle(subDir, { create: true }) : this.dirHandle;

    const fileHandle = await targetDir.getFileHandle(fileNameWithTimestamp, {
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

  async loadProjectFromFolder(): Promise<{
    meetingInfo: any;
    metadata: any;
    audioBlob: Blob;
    projectName: string;
  } | null> {
    try {
      // Let user select a project folder
      const projectHandle = await window.showDirectoryPicker!({
        mode: 'readwrite' // Need write permission to save changes later
      });
      
      // Save project folder handle as fallback
      this.projectDirHandle = projectHandle;
      console.log('Saved project directory handle:', projectHandle.name);
      
      // Try to get parent directory handle for saving new versions (preferred location)
      try {
        // Method 1: Use getParent() if available (Chromium-based browsers)
        if ('getParent' in projectHandle) {
          this.parentDirHandle = await (projectHandle as any).getParent();
          console.log('✓ Got parent directory handle via getParent():', this.parentDirHandle?.name);
        }
        // Method 2: Alternative API (if exists in future)
        else if ('resolve' in projectHandle) {
          console.log('Trying resolve method...');
          // This is a potential future API, not currently available
        }
      } catch (err) {
        console.warn('⚠️ Could not get parent directory handle (will use project folder as fallback):', err);
        this.parentDirHandle = null;
      }

      const projectName = projectHandle.name;
      let meetingInfoData = null;
      let metadataData = null;
      let audioBlob = null;

      console.log('Loading project from folder:', projectName);

      // Read all files in the project directory
      for await (const [name, handle] of (projectHandle as any).entries()) {
        console.log('Found file:', name, 'kind:', handle.kind);
        
        if (handle.kind === 'file') {
          const file = await handle.getFile();
          
          // Load meeting_info.json
          if (name.includes('meeting_info.json')) {
            const text = await file.text();
            meetingInfoData = JSON.parse(text);
            console.log('Loaded meeting_info.json:', meetingInfoData);
          }
          
          // Load metadata.json (but not meeting_info.json)
          if (name.includes('metadata.json') && !name.includes('meeting_info')) {
            const text = await file.text();
            metadataData = JSON.parse(text);
            console.log('Loaded metadata.json:', metadataData);
          }
          
          // Load audio file (.wav)
          if (name.endsWith('.wav')) {
            audioBlob = file;
            console.log('Loaded audio file:', name, 'size:', audioBlob.size);
          }
        }
      }

      if (!meetingInfoData || !metadataData || !audioBlob) {
        throw new Error('Missing required files (meeting_info.json, metadata.json, or .wav file)');
      }

      console.log('Loaded project data:', {
        projectName,
        meetingInfo: meetingInfoData,
        metadata: metadataData,
        audioSize: audioBlob.size
      });

      return {
        meetingInfo: meetingInfoData,
        metadata: metadataData,
        audioBlob: audioBlob,
        projectName: projectName
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return null; // User cancelled
      }
      throw error;
    }
  }

  // Get parent directory handle (for saving changes to loaded project)
  getParentDirHandle(): FileSystemDirectoryHandle | null {
    return this.parentDirHandle;
  }
  
  // Get project directory handle (fallback for saving when parent not available)
  getProjectDirHandle(): FileSystemDirectoryHandle | null {
    return this.projectDirHandle;
  }
  
  // Set directory handle (use parent dir when saving changes)
  setDirHandle(handle: FileSystemDirectoryHandle) {
    this.dirHandle = handle;
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
