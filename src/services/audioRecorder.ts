export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private audioChunks: Blob[] = [];
  private currentChunkSize = 0;

  async startRecording(): Promise<void> {
    try {
      // Request microphone permission
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
          channelCount: 1 // Mono
        }
      });

      // Try to use WebM with Opus codec (much better compression than WAV)
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav'
      ];
      
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          // console.log(`Using audio format: ${mimeType}`);
          break;
        }
      }

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: selectedMimeType || undefined,
        audioBitsPerSecond: 128000 // 128kbps - good quality, small size
      });

      this.audioChunks = [];
      this.currentChunkSize = 0;

      // Collect audio data in chunks to prevent memory overflow
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.currentChunkSize += event.data.size;
          
          // Log progress for long recordings
          // if (this.audioChunks.length % 10 === 0) {
          //   const sizeMB = (this.currentChunkSize / (1024 * 1024)).toFixed(2);
          //   console.log(`Recording progress: ${this.audioChunks.length} chunks, ${sizeMB} MB`);
          // }
        }
      };

      this.mediaRecorder.onerror = (event: Event) => {
        console.error('MediaRecorder error:', event);
      };

      // Request data every 5 seconds to prevent single huge chunk
      this.mediaRecorder.start(5000);
      this.startTime = Date.now();
      
      // console.log('Recording started with MediaRecorder');
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone permission denied. Please allow access in browser settings.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No microphone found. Please connect a microphone and try again.');
      } else {
        throw new Error(`Recording failed: ${error.message}`);
      }
    }
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }

      const recorder = this.mediaRecorder;
      
      recorder.onstop = () => {
        // console.log(`Recording stopped. Total chunks: ${this.audioChunks.length}, Total size: ${(this.currentChunkSize / (1024 * 1024)).toFixed(2)} MB`);
        
        // Combine all chunks into single blob
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        
        // Stop all tracks
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
        }

        this.mediaRecorder = null;
        this.stream = null;
        this.audioChunks = [];
        this.currentChunkSize = 0;
        
        resolve(blob);
      };

      recorder.stop();
    });
  }

  getCurrentDuration(): number {
    return Date.now() - this.startTime;
  }

  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  // Format duration to HH:MM:SS
  static formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
