import type { SpeechToTextConfig, TranscriptionResult } from '../types/types';

export class SpeechToTextService {
  private config: SpeechToTextConfig | null = null;
  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isTranscribing: boolean = false;
  private onTranscriptionCallback: ((result: TranscriptionResult) => void) | null = null;
  private transcriptionIdCounter: number = 0;
  private lastInterimText: string = '';
  private lastUpdateTime: number = 0;
  private segmentCheckInterval: NodeJS.Timeout | null = null;
  private transcriptionStartTime: number = 0; // Track when transcription started
  private segmentStartTimeMs: number = 0; // Track when current segment started (for fixed audioTimeMs)

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
    return this.config !== null;
  }

  /**
   * Check if Google Cloud API is configured with valid API Key
   */
  public hasGoogleCloudAPI(): boolean {
    return this.config !== null && !!this.config.apiKey && this.config.apiKey.length > 0;
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
      throw new Error('Speech-to-Text service not configured. Please configure it first.');
    }

    // Check if speaker diarization is enabled but no API Key
    if (this.config?.enableSpeakerDiarization && !this.hasGoogleCloudAPI()) {
      throw new Error('Speaker diarization requires Google Cloud API Key. Please add API Key in configuration.');
    }

    if (this.isTranscribing) {
      console.warn('Transcription already in progress');
      return;
    }

    this.onTranscriptionCallback = onTranscription;
    this.isTranscribing = true;
    this.audioChunks = [];
    this.transcriptionStartTime = Date.now(); // Record start time

    // Check if speaker diarization is enabled
    // Web Speech API does NOT support speaker diarization
    // Must use Google Cloud API for this feature
    if (this.config?.enableSpeakerDiarization) {
      console.log('🎯 Speaker diarization enabled - Using Google Cloud Speech-to-Text API');
      this.startGoogleCloudTranscription(stream);
      return;
    }

    // Try using Web Speech API first (free, browser-based)
    if (this.tryWebSpeechAPI(stream, onTranscription)) {
      console.log('✅ Using Web Speech API for transcription (FREE)');
      return;
    }

    // Fallback to Google Cloud Speech-to-Text API (if API Key available)
    if (this.hasGoogleCloudAPI()) {
      console.log('🌐 Using Google Cloud Speech-to-Text API');
      this.startGoogleCloudTranscription(stream);
    } else {
      throw new Error('Web Speech API not available and no Google Cloud API Key configured.');
    }
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
      this.recognition.maxAlternatives = 1;

      // Reset tracking variables
      this.lastInterimText = '';
      this.lastUpdateTime = Date.now();
      this.segmentStartTimeMs = 0; // Will be set when first text arrives

      // Start interval to check for segment completion
      this.segmentCheckInterval = setInterval(() => {
        this.checkSegmentCompletion(onTranscription);
      }, 500); // Check every 500ms

      this.recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0;
          const isFinal = result.isFinal;

          const now = new Date();
          this.lastUpdateTime = Date.now();

          // Set segment start time when first text arrives in new segment
          if (!this.lastInterimText && transcript.trim()) {
            // Estimate audio start time by subtracting ~1 second (typical speech-to-text delay)
            this.segmentStartTimeMs = this.lastUpdateTime - this.transcriptionStartTime - 1000;
            if (this.segmentStartTimeMs < 0) this.segmentStartTimeMs = 0;
            console.log('🎬 New segment started at audio time:', this.segmentStartTimeMs, 'ms');
          }

          // Check if we should force segment completion
          const shouldForceSegment = this.shouldForceSegment(transcript, isFinal);

          if (shouldForceSegment && !isFinal) {
            // Force this interim result to become final
            const transcriptionResult: TranscriptionResult = {
              id: `transcription-${++this.transcriptionIdCounter}`,
              text: transcript.trim(),
              startTime: now.toISOString(),
              endTime: now.toISOString(),
              audioTimeMs: this.segmentStartTimeMs, // Fixed at segment start
              confidence: confidence,
              speaker: 'Person1', // Default speaker
              isFinal: true // Force as final
            };
            
            onTranscription(transcriptionResult);
            this.lastInterimText = ''; // Reset for next segment
            this.segmentStartTimeMs = 0; // Reset for next segment
          } else if (isFinal) {
            // Natural final result
            const transcriptionResult: TranscriptionResult = {
              id: `transcription-${++this.transcriptionIdCounter}`,
              text: transcript.trim(),
              startTime: now.toISOString(),
              endTime: now.toISOString(),
              audioTimeMs: this.segmentStartTimeMs, // Fixed at segment start
              confidence: confidence,
              speaker: 'Person1', // Default speaker
              isFinal: true
            };
            
            onTranscription(transcriptionResult);
            this.lastInterimText = '';
            this.segmentStartTimeMs = 0; // Reset for next segment
          } else {
            // Interim result - only send if text changed significantly
            if (transcript !== this.lastInterimText) {
              const transcriptionResult: TranscriptionResult = {
                id: `transcription-${this.transcriptionIdCounter + 1}`, // Use next ID but don't increment
                text: transcript,
                startTime: now.toISOString(),
                endTime: now.toISOString(),
                audioTimeMs: this.segmentStartTimeMs, // Use segment start time
                confidence: confidence,
                speaker: 'Person1', // Default speaker
                isFinal: false
              };
              
              onTranscription(transcriptionResult);
              this.lastInterimText = transcript;
            }
          }
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
   * Check if current segment should be forced to complete
   */
  private shouldForceSegment(transcript: string, isFinal: boolean): boolean {
    if (isFinal) return false; // Already final, no need to force

    const trimmedText = transcript.trim();
    
    // Force segment if text is too long (>150 characters)
    if (trimmedText.length > 150) {
      console.log('🔸 Force segment: Text too long (' + trimmedText.length + ' chars)');
      return true;
    }

    // Force segment if ends with sentence punctuation + space
    // This catches natural pauses after complete sentences
    if (/[.!?]\s+$/.test(transcript)) {
      console.log('🔸 Force segment: Sentence end with space detected');
      return true;
    }

    return false;
  }

  /**
   * Check if segment should complete due to silence timeout
   */
  private checkSegmentCompletion(onTranscription: (result: TranscriptionResult) => void): void {
    if (!this.isTranscribing) return;
    
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    
    // If we have interim text and haven't received update for 2 seconds, finalize it
    if (this.lastInterimText && timeSinceLastUpdate > 2000) {
      console.log('🔸 Force segment: Silence timeout (2s)');
      
      const transcriptionResult: TranscriptionResult = {
        id: `transcription-${++this.transcriptionIdCounter}`,
        text: this.lastInterimText.trim(),
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        audioTimeMs: this.segmentStartTimeMs, // Fixed at segment start
        confidence: 0.8, // Moderate confidence for timeout-forced segments
        speaker: 'Person1', // Default speaker
        isFinal: true
      };
      
      onTranscription(transcriptionResult);
      this.lastInterimText = '';
      this.segmentStartTimeMs = 0; // Reset for next segment
      this.lastUpdateTime = now;
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
          diarizationSpeakerCount: this.config.enableSpeakerDiarization ? 5 : undefined, // Support up to 5 speakers
          model: 'default',
          useEnhanced: true // Use enhanced model for better accuracy
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
            const speakerTags = new Set<number>();
            
            if (alternative.words && alternative.words.length > 0) {
              // Collect all speaker tags in this segment
              alternative.words.forEach((word: any) => {
                if (word.speakerTag !== undefined) {
                  speakerTags.add(word.speakerTag);
                }
              });
              
              // If multiple speakers in one segment, show all
              if (speakerTags.size > 0) {
                const speakers = Array.from(speakerTags).sort().map(tag => `Người ${tag + 1}`);
                speaker = speakers.join(', ');
              }
            }

            const transcriptionResult: TranscriptionResult = {
              id: `gcloud-${++this.transcriptionIdCounter}`,
              text: alternative.transcript,
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
              // Estimate audio time by subtracting processing delay (~2-3 seconds)
              audioTimeMs: Math.max(0, Date.now() - this.transcriptionStartTime - 2500),
              confidence: alternative.confidence || 0,
              speaker: speaker || 'Person1', // Default to Person1 if no speaker identified
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
   * Check if transcription is still processing
   */
  public isProcessing(): boolean {
    return this.isTranscribing;
  }

  /**
   * Wait for transcription to complete processing
   * Returns a promise that resolves when transcription is done
   */
  public async waitForCompletion(timeoutMs: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        
        // If not processing anymore, or timeout reached, resolve
        if (!this.isTranscribing || elapsed >= timeoutMs) {
          clearInterval(checkInterval);
          console.log(`✅ Transcription completion wait finished (${elapsed}ms)`);
          resolve();
        }
      }, 100); // Check every 100ms
    });
  }

  /**
   * Stop transcription
   */
  public stopTranscription(): void {
    this.isTranscribing = false;
    this.transcriptionStartTime = 0; // Reset start time

    // Clear segment check interval
    if (this.segmentCheckInterval) {
      clearInterval(this.segmentCheckInterval);
      this.segmentCheckInterval = null;
    }

    // Stop Web Speech API
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
      this.recognition = null;
    }

    // Reset tracking variables
    this.lastInterimText = '';
    this.lastUpdateTime = 0;

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
