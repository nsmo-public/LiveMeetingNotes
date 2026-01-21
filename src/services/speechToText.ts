import type { SpeechToTextConfig, TranscriptionResult } from '../types/types';

export class SpeechToTextService {
  private config: SpeechToTextConfig | null = null;
  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isTranscribing: boolean = false;
  private onTranscriptionCallback: ((result: TranscriptionResult) => void) | null = null;
  private transcriptionIdCounter: number = 0;

  /**
   * Initialize the service with configuration
   */
  public initialize(config: SpeechToTextConfig): void {
    this.config = config;
    console.log('🎤 SpeechToTextService initialized with config:', {
      languageCode: config.languageCode,
      enableSpeakerDiarization: config.enableSpeakerDiarization,
      hasApiKey: !!config.apiKey
    });
  }

  /**
   * Check if service is configured
   */
  public isConfigured(): boolean {
    return this.config !== null && !!this.config.apiKey;
  }

  /**
   * Get current configuration
   */
  public getConfig(): SpeechToTextConfig | null {
    return this.config;
  }

  /**
   * Start transcription with the given audio stream
   */
  public async startTranscription(
    stream: MediaStream,
    onTranscription: (result: TranscriptionResult) => void
  ): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Speech-to-Text service not configured. Please set API key first.');
    }

    if (this.isTranscribing) {
      console.warn('Transcription already in progress');
      return;
    }

    this.onTranscriptionCallback = onTranscription;
    this.isTranscribing = true;
    this.audioChunks = [];

    // Try using Web Speech API first (free, browser-based)
    if (this.tryWebSpeechAPI(stream, onTranscription)) {
      console.log('✅ Using Web Speech API for transcription');
      return;
    }

    // Fallback to Google Cloud Speech-to-Text API
    console.log('🌐 Using Google Cloud Speech-to-Text API');
    this.startGoogleCloudTranscription(stream);
  }

  /**
   * Try to use browser's Web Speech API (if available)
   */
  private tryWebSpeechAPI(
    stream: MediaStream,
    onTranscription: (result: TranscriptionResult) => void
  ): boolean {
    // Check if Web Speech API is available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      return false;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.config?.languageCode || 'vi-VN';

      this.recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0;
          const isFinal = result.isFinal;

          const now = new Date();
          const transcriptionResult: TranscriptionResult = {
            id: `transcription-${++this.transcriptionIdCounter}`,
            text: transcript,
            startTime: now.toISOString(),
            endTime: now.toISOString(),
            confidence: confidence,
            isFinal: isFinal
          };

          onTranscription(transcriptionResult);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'network') {
          console.log('Network error, falling back to Google Cloud API');
          this.startGoogleCloudTranscription(stream);
        }
      };

      this.recognition.onend = () => {
        // Restart if still transcribing
        if (this.isTranscribing) {
          try {
            this.recognition.start();
          } catch (e) {
            console.error('Failed to restart recognition:', e);
          }
        }
      };

      this.recognition.start();
      return true;
    } catch (error) {
      console.error('Failed to initialize Web Speech API:', error);
      return false;
    }
  }

  /**
   * Start Google Cloud Speech-to-Text transcription
   */
  private async startGoogleCloudTranscription(stream: MediaStream): Promise<void> {
    if (!this.config) return;

    try {
      // Create MediaRecorder to capture audio chunks
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 16000 // Google Cloud prefers 16kHz
      });

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && this.isTranscribing) {
          this.audioChunks.push(event.data);
          
          // Send to Google Cloud API every 5 seconds
          if (this.audioChunks.length >= 1) {
            await this.sendToGoogleCloudAPI();
          }
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      // Request data every 5 seconds
      this.mediaRecorder.start(5000);
      console.log('📹 MediaRecorder started for Google Cloud transcription');
    } catch (error) {
      console.error('Failed to start Google Cloud transcription:', error);
      throw error;
    }
  }

  /**
   * Send audio data to Google Cloud Speech-to-Text API
   */
  private async sendToGoogleCloudAPI(): Promise<void> {
    if (!this.config || this.audioChunks.length === 0) return;

    try {
      // Combine audio chunks
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      this.audioChunks = [];

      // Convert to base64
      const base64Audio = await this.blobToBase64(audioBlob);

      // Prepare request
      const endpoint = this.config.apiEndpoint || 'https://speech.googleapis.com/v1/speech:recognize';
      const url = `${endpoint}?key=${this.config.apiKey}`;

      const requestBody = {
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: this.config.languageCode,
          enableAutomaticPunctuation: this.config.enableAutomaticPunctuation,
          enableSpeakerDiarization: this.config.enableSpeakerDiarization,
          diarizationSpeakerCount: this.config.enableSpeakerDiarization ? 2 : undefined,
          model: 'default'
        },
        audio: {
          content: base64Audio.split(',')[1] // Remove data:audio/webm;base64, prefix
        }
      };

      // Send request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Google Cloud API error:', errorData);
        return;
      }

      const data = await response.json();
      
      // Process results
      if (data.results && data.results.length > 0) {
        data.results.forEach((result: any) => {
          if (result.alternatives && result.alternatives.length > 0) {
            const alternative = result.alternatives[0];
            
            // Extract speaker information if available
            let speaker: string | undefined;
            if (alternative.words && alternative.words.length > 0) {
              const speakerTag = alternative.words[0].speakerTag;
              if (speakerTag !== undefined) {
                speaker = `Speaker ${speakerTag}`;
              }
            }

            const transcriptionResult: TranscriptionResult = {
              id: `gcloud-${++this.transcriptionIdCounter}`,
              text: alternative.transcript,
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
              confidence: alternative.confidence || 0,
              speaker: speaker,
              isFinal: true
            };

            if (this.onTranscriptionCallback) {
              this.onTranscriptionCallback(transcriptionResult);
            }
          }
        });
      }
    } catch (error) {
      console.error('Failed to send audio to Google Cloud API:', error);
    }
  }

  /**
   * Convert Blob to Base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Stop transcription
   */
  public stopTranscription(): void {
    this.isTranscribing = false;

    // Stop Web Speech API
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
      this.recognition = null;
    }

    // Stop MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.error('Error stopping MediaRecorder:', e);
      }
      this.mediaRecorder = null;
    }

    this.audioChunks = [];
    this.onTranscriptionCallback = null;
    console.log('🛑 Transcription stopped');
  }

  /**
   * Save configuration to localStorage
   */
  public static saveConfig(config: SpeechToTextConfig): void {
    try {
      localStorage.setItem('speechToTextConfig', JSON.stringify(config));
      console.log('💾 Speech-to-Text config saved');
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  /**
   * Load configuration from localStorage
   */
  public static loadConfig(): SpeechToTextConfig | null {
    try {
      const saved = localStorage.getItem('speechToTextConfig');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
    return null;
  }

  /**
   * Clear configuration
   */
  public static clearConfig(): void {
    try {
      localStorage.removeItem('speechToTextConfig');
      console.log('🗑️ Speech-to-Text config cleared');
    } catch (error) {
      console.error('Failed to clear config:', error);
    }
  }
}

// Singleton instance
export const speechToTextService = new SpeechToTextService();
