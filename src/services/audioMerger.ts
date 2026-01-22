/**
 * Audio Merger Service
 * Merges multiple audio segments with silence gaps into a single audio file
 */

export interface AudioSegment {
  blob: Blob;
  startTime: number; // absolute timestamp (Date.now())
  endTime: number;   // absolute timestamp (Date.now())
  duration: number;  // duration in ms
}

export class AudioMerger {
  /**
   * Merge multiple audio segments into one, inserting silence for gaps
   * @param segments - Array of audio segments sorted by startTime
   * @returns Promise<Blob> - Merged audio blob (WebM format)
   */
  static async mergeSegments(segments: AudioSegment[]): Promise<{
    mergedBlob: Blob;
    totalDuration: number;
    gapInfo: Array<{ startMs: number; endMs: number; durationMs: number }>;
  }> {
    if (segments.length === 0) {
      throw new Error('No segments to merge');
    }

    if (segments.length === 1) {
      // Only one segment, no merge needed
      return {
        mergedBlob: segments[0].blob,
        totalDuration: segments[0].duration,
        gapInfo: []
      };
    }

    // console.log('🔀 Merging audio segments:', {
    //   segmentCount: segments.length,
    //   segments: segments.map((s, i) => ({
    //     index: i,
    //     startTime: new Date(s.startTime).toISOString(),
    //     endTime: new Date(s.endTime).toISOString(),
    //     duration: `${(s.duration / 1000).toFixed(2)}s`
    //   }))
    // });

    try {
      // 1. Decode all audio segments to AudioBuffers
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffers: AudioBuffer[] = [];
      
      for (const segment of segments) {
        const arrayBuffer = await segment.blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBuffers.push(audioBuffer);
      }

      // 2. Calculate gaps and total duration
      const gapInfo: Array<{ startMs: number; endMs: number; durationMs: number }> = [];
      let currentTimelinePos = 0;
      
      for (let i = 0; i < segments.length - 1; i++) {
        const currentSegment = segments[i];
        const nextSegment = segments[i + 1];
        
        // Calculate gap between segments
        const gapMs = nextSegment.startTime - currentSegment.endTime;
        
        if (gapMs > 0) {
          const gapStartMs = currentTimelinePos + currentSegment.duration;
          gapInfo.push({
            startMs: gapStartMs,
            endMs: gapStartMs + gapMs,
            durationMs: gapMs
          });
          // console.log(`⏸️ Gap ${i}: ${(gapMs / 1000).toFixed(2)}s`);
        }
        
        currentTimelinePos += currentSegment.duration + Math.max(0, gapMs);
      }
      
      // Add last segment duration
      currentTimelinePos += segments[segments.length - 1].duration;
      const totalDuration = currentTimelinePos;

      // console.log('📊 Merge plan:', {
      //   totalDuration: `${(totalDuration / 1000).toFixed(2)}s`,
      //   gaps: gapInfo.length,
      //   totalGapDuration: `${(gapInfo.reduce((sum, g) => sum + g.durationMs, 0) / 1000).toFixed(2)}s`
      // });

      // 3. Create merged AudioBuffer
      const sampleRate = audioBuffers[0].sampleRate;
      const numberOfChannels = audioBuffers[0].numberOfChannels;
      const totalSamples = Math.ceil(totalDuration / 1000 * sampleRate);
      
      const mergedBuffer = audioContext.createBuffer(
        numberOfChannels,
        totalSamples,
        sampleRate
      );

      // 4. Copy audio data with gaps
      let currentSample = 0;
      
      for (let i = 0; i < segments.length; i++) {
        const audioBuffer = audioBuffers[i];
        
        // Copy audio data for this segment
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const sourceData = audioBuffer.getChannelData(channel);
          const destData = mergedBuffer.getChannelData(channel);
          
          for (let sample = 0; sample < sourceData.length; sample++) {
            if (currentSample + sample < totalSamples) {
              destData[currentSample + sample] = sourceData[sample];
            }
          }
        }
        
        currentSample += audioBuffer.length;
        
        // Add silence for gap (if not last segment)
        if (i < segments.length - 1) {
          const gapMs = segments[i + 1].startTime - segments[i].endTime;
          if (gapMs > 0) {
            const gapSamples = Math.ceil(gapMs / 1000 * sampleRate);
            // Silence is already zero in newly created buffer, just advance position
            currentSample += gapSamples;
          }
        }
      }

      // 5. Encode to WebM
      // console.log('🎵 Encoding merged audio to WebM...');
      const mergedBlob = await this.encodeToWebM(mergedBuffer, audioContext);
      
      // console.log('✅ Merge complete:', {
      //   outputSize: `${(mergedBlob.size / 1024 / 1024).toFixed(2)} MB`,
      //   duration: `${(totalDuration / 1000).toFixed(2)}s`
      // });

      // Close audio context
      await audioContext.close();

      return {
        mergedBlob,
        totalDuration,
        gapInfo
      };
    } catch (error) {
      console.error('❌ Audio merge failed:', error);
      throw new Error(`Failed to merge audio segments: ${error}`);
    }
  }

  /**
   * Encode AudioBuffer to WebM format using MediaRecorder
   */
  private static async encodeToWebM(
    audioBuffer: AudioBuffer,
    audioContext: AudioContext
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // Create a MediaStreamDestination to capture audio
      const destination = audioContext.createMediaStreamDestination();
      
      // Create buffer source
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(destination);
      
      // Setup MediaRecorder
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
          break;
        }
      }
      
      if (!selectedMimeType) {
        reject(new Error('No supported audio format found'));
        return;
      }
      
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000
      });
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: selectedMimeType });
        resolve(blob);
      };
      
      mediaRecorder.onerror = () => {
        reject(new Error('MediaRecorder error during encoding'));
      };
      
      // Start recording and play source
      mediaRecorder.start();
      source.start(0);
      
      // Stop recording when source ends
      source.onended = () => {
        setTimeout(() => {
          mediaRecorder.stop();
        }, 100); // Small delay to ensure all data is captured
      };
    });
  }

  /**
   * Calculate adjusted timestamps after merging
   * Note: Timestamps don't need adjustment since they are absolute times (Date.now()),
   * not relative to audio playback position. The audio is merged to match the timeline.
   * @param originalTimestamps - Original timestamp map (position → absoluteTime)
   * @returns Same timestamp map (no adjustment needed)
   */
  static adjustTimestampsForMerge(
    originalTimestamps: Map<number, number>
  ): Map<number, number> {
    // Timestamps don't need position adjustment since notes don't change
    // and timestamps are absolute times, not relative to audio duration
    const adjustedTimestamps = new Map<number, number>();
    
    originalTimestamps.forEach((absoluteTime, position) => {
      adjustedTimestamps.set(position, absoluteTime);
    });
    
    return adjustedTimestamps;
  }
}
