import type { SpeechToTextConfig, TranscriptionResult } from '../types/types';

export class SpeechToTextService {
  private config: SpeechToTextConfig | null = null;
  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
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
    // console.log('🎤 SpeechToTextService initialized with config:', {
    //   languageCode: config.languageCode,
    //   enableSpeakerDiarization: config.enableSpeakerDiarization,
    //   hasApiKey: !!config.apiKey
    // });
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

    // Nếu bật nhận diện người nói (speaker diarization) thì bắt buộc dùng Google Cloud API
  if (this.config?.enableSpeakerDiarization && this.hasGoogleCloudAPI()) {
    this.startGoogleCloudTranscription(stream);
    return;
  }

  // Luôn ưu tiên Web Speech API nếu có (miễn phí, realtime, tốt cho ghi âm)
  if (this.tryWebSpeechAPI(stream, onTranscription)) {
    return;
  }

  // Nếu không có Web Speech API, fallback sang Google Cloud API nếu có key
  if (this.hasGoogleCloudAPI()) {
    this.startGoogleCloudTranscription(stream);
  } else {
    throw new Error('Web Speech API not available and no Google Cloud API Key configured.');
  }
    if (this.isTranscribing) {
      console.warn('Transcription already in progress');
      return;
    }

    this.onTranscriptionCallback = onTranscription;
    this.isTranscribing = true;
    this.transcriptionStartTime = Date.now(); // Record start time

    // Check if speaker diarization is enabled
    // Web Speech API does NOT support speaker diarization
    // Must use Google Cloud API for this feature
    if (this.config?.enableSpeakerDiarization) {
      // console.log('🎯 Speaker diarization enabled - Using Google Cloud Speech-to-Text API');
      this.startGoogleCloudTranscription(stream);
      return;
    }

    // Try using Web Speech API first (free, browser-based)
    if (this.tryWebSpeechAPI(stream, onTranscription)) {
      // console.log('✅ Using Web Speech API for transcription (FREE)');
      return;
    }

    // Fallback to Google Cloud Speech-to-Text API (if API Key available)
    if (this.hasGoogleCloudAPI()) {
      // console.log('🌐 Using Google Cloud Speech-to-Text API');
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
            // console.log('🎬 New segment started at audio time:', this.segmentStartTimeMs, 'ms');
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
          // console.log('Network error, falling back to Google Cloud API');
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
      // console.log('🔸 Force segment: Text too long (' + trimmedText.length + ' chars)');
      return true;
    }

    // Force segment if ends with sentence punctuation + space
    // This catches natural pauses after complete sentences
    if (/[.!?]\s+$/.test(transcript)) {
      // console.log('🔸 Force segment: Sentence end with space detected');
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
      // console.log('🔸 Force segment: Silence timeout (2s)');
      
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
          // Don't accumulate chunks - send each chunk individually
          // Each chunk is ~5 seconds (safe for Google Cloud API limit)
          await this.sendToGoogleCloudAPI(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      // Request data every 10 seconds (longer chunks = better quality)
      this.mediaRecorder.start(10000);
      // console.log('📹 MediaRecorder started for Google Cloud transcription');
    } catch (error) {
      console.error('Failed to start Google Cloud transcription:', error);
      throw error;
    }
  }

  /**
   * Send audio data to Google Cloud Speech-to-Text API
   */
  private async sendToGoogleCloudAPI(audioBlob: Blob): Promise<void> {
    if (!this.config) return;

    try {
      // Skip if audio is too small (< 0.5 seconds worth)
      if (audioBlob.size < 1000) {
        console.warn('⚠️ Audio chunk too small, skipping:', audioBlob.size, 'bytes');
        return;
      }

      // Convert to base64
      const base64Audio = await this.blobToBase64(audioBlob);

      // Prepare request
      const endpoint = this.config.apiEndpoint || 'https://speech.googleapis.com/v1/speech:recognize';
      const url = `${endpoint}?key=${this.config.apiKey}`;

      const requestBody: any = {
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: this.config.languageCode,
          enableAutomaticPunctuation: this.config.enableAutomaticPunctuation,
          model: 'default',
          useEnhanced: true // Use enhanced model for better accuracy
        },
        audio: {
          content: base64Audio.split(',')[1] // Remove data:audio/webm;base64, prefix
        }
      };

      // Add speaker diarization config if enabled
      if (this.config.enableSpeakerDiarization) {
        requestBody.config.diarizationConfig = {
          enableSpeakerDiarization: true,
          minSpeakerCount: 2,
          maxSpeakerCount: 6
        };
      }

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
        console.error('Error message:', errorData.error?.message);
        console.error('Request details:', {
          audioSize: audioBlob.size,
          encoding: requestBody.config.encoding,
          sampleRate: requestBody.config.sampleRateHertz,
          languageCode: requestBody.config.languageCode,
          diarizationEnabled: this.config.enableSpeakerDiarization
        });
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
          // console.log(`✅ Transcription completion wait finished (${elapsed}ms)`);
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

    this.onTranscriptionCallback = null;
    // console.log('🛑 Transcription stopped');
  }

  /**
   * Transcribe entire audio file (for loaded projects)
   */
  public async transcribeAudioFile(
    audioBlob: Blob,
    onTranscription: (result: TranscriptionResult) => void,
    onProgress?: (progress: number) => void,
    onComplete?: () => void
  ): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Speech-to-Text service not configured. Please configure it first.');
    }

    // console.log('🎬 Starting audio file transcription:', {
    //   size: audioBlob.size,
    //   type: audioBlob.type,
    //   config: this.config
    // });

    // Reset tracking variables
    this.transcriptionIdCounter = 0;
    this.transcriptionStartTime = 0;
    this.segmentStartTimeMs = 0;

    try {
      // Use Google Cloud API if available and speaker diarization is enabled
      if (this.config?.enableSpeakerDiarization && this.hasGoogleCloudAPI()) {
        // console.log('🎯 Using Google Cloud API with speaker diarization');
        await this.transcribeAudioFileWithGoogleCloud(audioBlob, onTranscription, onProgress, onComplete);
        return;
      }

      // Use Web Speech API if available (requires creating audio context and playing silently)
      if (this.hasWebSpeechAPI()) {
        // console.log('✅ Using Web Speech API');
        await this.transcribeAudioFileWithWebSpeech(audioBlob, onTranscription, onProgress, onComplete);
        return;
      }

      // Fallback to Google Cloud API if available
      if (this.hasGoogleCloudAPI()) {
        // console.log('🌐 Using Google Cloud API');
        await this.transcribeAudioFileWithGoogleCloud(audioBlob, onTranscription, onProgress, onComplete);
        return;
      }

      throw new Error('No transcription service available. Please configure Speech-to-Text settings.');
    } catch (error) {
      console.error('Audio file transcription error:', error);
      throw error;
    }
  }

  /**
   * Check if Web Speech API is available
   */
  private hasWebSpeechAPI(): boolean {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return !!SpeechRecognition;
  }

  /**
   * Transcribe audio file using Web Speech API
   */
  private async transcribeAudioFileWithWebSpeech(
    audioBlob: Blob,
    onTranscription: (result: TranscriptionResult) => void,
    onProgress?: (progress: number) => void,
    onComplete?: () => void
  ): Promise<void> {
    // Create audio element to play the file
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    // Get audio duration
    await new Promise<void>((resolve) => {
      audio.addEventListener('loadedmetadata', () => resolve(), { once: true });
    });
    
    const duration = audio.duration;
    // console.log('Audio duration:', duration, 'seconds');

    // Create audio context and stream
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamDestination();
    const mediaElementSource = audioContext.createMediaElementSource(audio);
    mediaElementSource.connect(source);
    mediaElementSource.connect(audioContext.destination); // Also play to speakers (silently)

    // Setup Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false; // Only final results for file transcription
    recognition.lang = this.config?.languageCode || 'vi-VN';
    recognition.maxAlternatives = 1;

    let lastResultTime = 0;

    recognition.onresult = (event: any) => {
      const currentTime = audio.currentTime * 1000; // Convert to ms
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0;

          const transcriptionResult: TranscriptionResult = {
            id: `file-${Date.now()}-${this.transcriptionIdCounter++}`,
            text: transcript,
            startTime: new Date(Date.now()).toISOString(),
            endTime: new Date(Date.now()).toISOString(),
            audioTimeMs: Math.floor(lastResultTime),
            confidence: confidence,
            speaker: 'Person1', // Web Speech API doesn't support speaker diarization
            isFinal: true,
            isManuallyEdited: false
          };

          onTranscription(transcriptionResult);
          lastResultTime = currentTime;
        }
      }

      // Update progress
      if (onProgress && duration > 0) {
        const progress = Math.min((audio.currentTime / duration) * 100, 100);
        onProgress(progress);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
      // console.log('Recognition ended');
    };

    // Start recognition and play audio
    recognition.start();
    audio.volume = 0.01; // Play almost silently
    await audio.play();

    // Wait for audio to finish
    await new Promise<void>((resolve) => {
      audio.addEventListener('ended', () => {
        recognition.stop();
        audioContext.close();
        URL.revokeObjectURL(audioUrl);
        resolve();
      }, { once: true });
    });

    if (onProgress) onProgress(100);
    if (onComplete) onComplete();
    
    // console.log('✅ Web Speech API transcription complete');
  }

  /**
   * Transcribe audio file using Google Cloud API
   */
  private async transcribeAudioFileWithGoogleCloud(
    audioBlob: Blob,
    onTranscription: (result: TranscriptionResult) => void,
    onProgress?: (progress: number) => void,
    onComplete?: () => void
  ): Promise<void> {
    // Get audio duration first
    const audioDuration = await this.getAudioDuration(audioBlob);
    console.log(`🎵 Audio duration: ${audioDuration.toFixed(1)}s`);

    // Google Cloud API limit: 60 seconds for sync recognize
    const MAX_DURATION_SECONDS = 58; // Use 58s to be safe

    if (audioDuration > MAX_DURATION_SECONDS) {
      // For long audio, split into chunks
      console.log(`⚠️ Audio is ${audioDuration.toFixed(1)}s, splitting into chunks...`);
      await this.transcribeLongAudioWithGoogleCloud(audioBlob, audioDuration, onTranscription, onProgress, onComplete);
      return;
    }

    // For short audio (< 60s), use normal sync API
    console.log(`✅ Audio is ${audioDuration.toFixed(1)}s, using sync API`);
    
    // Convert audio blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Prepare request
    const apiKey = this.config?.apiKey;
    const languageCode = this.config?.languageCode || 'vi-VN';
    const enableSpeakerDiarization = this.config?.enableSpeakerDiarization || false;

    const requestBody: any = {
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: languageCode,
        enableAutomaticPunctuation: true,
        model: 'default',
        useEnhanced: true
      },
      audio: {
        content: base64Audio
      }
    };

    // Add speaker diarization if enabled
    if (enableSpeakerDiarization) {
      requestBody.config.diarizationConfig = {
        enableSpeakerDiarization: true,
        minSpeakerCount: 2,
        maxSpeakerCount: 6
      };
    }

    if (onProgress) onProgress(10);

    try {
      const response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (onProgress) onProgress(50);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Cloud API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (onProgress) onProgress(80);

      // Process results
      if (data.results && Array.isArray(data.results)) {
        let audioTimeMs = 0;
        
        data.results.forEach((result: any) => {
          if (result.alternatives && result.alternatives.length > 0) {
            const alternative = result.alternatives[0];
            let speaker = 'Person1';

            // Extract speaker information if available
            if (alternative.words && alternative.words.length > 0) {
              const firstWord = alternative.words[0];
              if (firstWord.speakerTag !== undefined) {
                speaker = `Person ${firstWord.speakerTag}`;
              }

              // Get start time from first word
              if (firstWord.startTime) {
                const seconds = parseFloat(firstWord.startTime.replace('s', ''));
                audioTimeMs = Math.floor(seconds * 1000);
              }
            }

            const transcriptionResult: TranscriptionResult = {
              id: `file-${Date.now()}-${this.transcriptionIdCounter++}`,
              text: alternative.transcript,
              startTime: new Date(Date.now()).toISOString(),
              endTime: new Date(Date.now()).toISOString(),
              audioTimeMs: audioTimeMs,
              confidence: alternative.confidence || 0,
              speaker: speaker,
              isFinal: true,
              isManuallyEdited: false
            };

            onTranscription(transcriptionResult);
          }
        });
      }

      if (onProgress) onProgress(100);
      if (onComplete) onComplete();

      // console.log('✅ Google Cloud API transcription complete');
    } catch (error) {
      console.error('Google Cloud API transcription error:', error);
      throw error;
    }
  }

  /**
   * Get audio duration from blob
   */
  private async getAudioDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src);
        resolve(audio.duration);
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(audio.src);
        reject(new Error('Failed to load audio metadata'));
      };
      
      audio.src = URL.createObjectURL(audioBlob);
    });
  }

  /**
   * Transcribe long audio by splitting into chunks
   */
  private async transcribeLongAudioWithGoogleCloud(
    audioBlob: Blob,
    totalDuration: number,
    onTranscription: (result: TranscriptionResult) => void,
    onProgress?: (progress: number) => void,
    onComplete?: () => void
  ): Promise<void> {
    const CHUNK_DURATION = 55; // 55 seconds per chunk (safe margin)
    const numChunks = Math.ceil(totalDuration / CHUNK_DURATION);
    
    console.log(`📦 Splitting into ${numChunks} chunks (${CHUNK_DURATION}s each)`);
    
    try {
      // Load audio into AudioContext
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const sampleRate = audioBuffer.sampleRate;
      const channelData = audioBuffer.getChannelData(0); // Get first channel
      
      // Process each chunk
      for (let i = 0; i < numChunks; i++) {
        const startTime = i * CHUNK_DURATION;
        const endTime = Math.min((i + 1) * CHUNK_DURATION, totalDuration);
        
        console.log(`🔄 Processing chunk ${i + 1}/${numChunks}: ${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s`);
        
        // Calculate progress
        const baseProgress = 10 + (i / numChunks) * 80;
        if (onProgress) onProgress(Math.round(baseProgress));
        
        // Extract chunk samples
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const chunkSamples = channelData.slice(startSample, endSample);
        
        // Create new AudioBuffer for this chunk
        const chunkBuffer = audioContext.createBuffer(1, chunkSamples.length, sampleRate);
        chunkBuffer.copyToChannel(chunkSamples, 0);
        
        // Convert to WAV blob
        const chunkBlob = await this.audioBufferToWavBlob(chunkBuffer);
        
        // Transcribe this chunk
        await this.transcribeSingleChunk(chunkBlob, i, startTime, onTranscription);
      }
      
      if (onProgress) onProgress(100);
      if (onComplete) onComplete();
      
      console.log(`✅ All ${numChunks} chunks transcribed successfully`);
      
    } catch (error) {
      console.error('Error transcribing long audio:', error);
      throw error;
    }
  }

  /**
   * Transcribe a single audio chunk
   */
  private async transcribeSingleChunk(
    chunkBlob: Blob,
    chunkIndex: number,
    chunkStartTime: number,
    onTranscription: (result: TranscriptionResult) => void
  ): Promise<void> {
    // Convert to base64
    const arrayBuffer = await chunkBlob.arrayBuffer();
    const base64Audio = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const apiKey = this.config?.apiKey;
    const languageCode = this.config?.languageCode || 'vi-VN';
    const enableSpeakerDiarization = this.config?.enableSpeakerDiarization || false;

    const requestBody: any = {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: languageCode,
        enableAutomaticPunctuation: true,
        model: 'default',
        useEnhanced: true
      },
      audio: {
        content: base64Audio
      }
    };

    if (enableSpeakerDiarization) {
      requestBody.config.diarizationConfig = {
        enableSpeakerDiarization: true,
        minSpeakerCount: 2,
        maxSpeakerCount: 6
      };
    }

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chunk ${chunkIndex} failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Process results
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach((result: any) => {
        if (result.alternatives && result.alternatives.length > 0) {
          const alternative = result.alternatives[0];
          let speaker = 'Person1';
          let wordStartTime = 0;

          if (alternative.words && alternative.words.length > 0) {
            const firstWord = alternative.words[0];
            if (firstWord.speakerTag !== undefined) {
              speaker = `Person ${firstWord.speakerTag}`;
            }
            if (firstWord.startTime) {
              const seconds = parseFloat(firstWord.startTime.replace('s', ''));
              wordStartTime = seconds;
            }
          }

          // Calculate absolute time by adding chunk start time
          const audioTimeMs = Math.floor((chunkStartTime + wordStartTime) * 1000);

          const transcriptionResult: TranscriptionResult = {
            id: `chunk-${chunkIndex}-${Date.now()}-${this.transcriptionIdCounter++}`,
            text: alternative.transcript,
            startTime: new Date(Date.now()).toISOString(),
            endTime: new Date(Date.now()).toISOString(),
            audioTimeMs: audioTimeMs,
            confidence: alternative.confidence || 0,
            speaker: speaker,
            isFinal: true,
            isManuallyEdited: false
          };

          onTranscription(transcriptionResult);
        }
      });
    }
  }

  /**
   * Convert AudioBuffer to WAV Blob
   */
  private async audioBufferToWavBlob(audioBuffer: AudioBuffer): Promise<Blob> {
    const numberOfChannels = 1;
    const sampleRate = 16000; // Downsample to 16kHz for API
    const format = 1; // PCM
    const bitDepth = 16;

    const channelData = audioBuffer.getChannelData(0);
    
    // Resample to 16kHz
    const resampledData = this.resampleAudio(channelData, audioBuffer.sampleRate, sampleRate);
    
    // Convert to 16-bit PCM
    const pcmData = new Int16Array(resampledData.length);
    for (let i = 0; i < resampledData.length; i++) {
      const s = Math.max(-1, Math.min(1, resampledData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Create WAV header
    const dataLength = pcmData.length * 2;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * bitDepth / 8, true); // ByteRate
    view.setUint16(32, numberOfChannels * bitDepth / 8, true); // BlockAlign
    view.setUint16(34, bitDepth, true);

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write PCM samples
    const offset = 44;
    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(offset + i * 2, pcmData[i], true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Simple audio resampling
   */
  private resampleAudio(buffer: Float32Array, fromSampleRate: number, toSampleRate: number): Float32Array {
    if (fromSampleRate === toSampleRate) {
      return buffer;
    }

    const ratio = fromSampleRate / toSampleRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, buffer.length - 1);
      const t = srcIndex - srcIndexFloor;

      // Linear interpolation
      result[i] = buffer[srcIndexFloor] * (1 - t) + buffer[srcIndexCeil] * t;
    }

    return result;
  }

  /**
   * Write string to DataView
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Save configuration to localStorage
   */
  public static saveConfig(config: SpeechToTextConfig): void {
    try {
      localStorage.setItem('speechToTextConfig', JSON.stringify(config));
      // console.log('💾 Speech-to-Text config saved');
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
      // console.log('🗑️ Speech-to-Text config cleared');
    } catch (error) {
      console.error('Failed to clear config:', error);
    }
  }
}

// Singleton instance
export const speechToTextService = new SpeechToTextService();
