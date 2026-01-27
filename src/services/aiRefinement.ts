import type { TranscriptionResult } from '../types/types';

export interface RawTranscriptData {
  text: string;
  timestamp: string;
  audioTimeMs?: number;
  confidence: number;
  isFinal: boolean;
}

export interface RefinedSegment {
  text: string;
  timestamp: string;
  audioTimeMs?: number;
}

/**
 * AI Refinement Service for Gemini AI
 * Refines raw speech-to-text transcripts with AI
 */
export class AIRefinementService {
  private static readonly GEMINI_MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
  private static readonly GEMINI_API_VERSION = 'v1beta'; // Use v1beta as it's more stable

  /**
   * List available Gemini models for the given API key
   * Useful for debugging and verifying API key access
   */
  public static async listGeminiModels(apiKey: string): Promise<any> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API Key is required');
    }

    try {
      const response = await fetch(`${this.GEMINI_MODELS_ENDPOINT}?key=${apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Failed to list models (${response.status}): ${errorData.error?.message || response.statusText}\n` +
          `URL: ${this.GEMINI_MODELS_ENDPOINT}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Error listing Gemini models:', error);
      throw new Error(`Cannot list Gemini models: ${error.message}`);
    }
  }

  /**
   * Refine transcripts using Gemini AI
   * @param transcriptions - Primary data (user-edited, highest reliability)
   * @param rawData - Supplementary data (original Web Speech API output for reference)
   */
  public static async refineTranscripts(
    apiKey: string,
    transcriptions: TranscriptionResult[], // Primary data source
    rawData: RawTranscriptData[], // Optional: supplementary raw data
    modelName: string, // REQUIRED: specific Gemini model (e.g., "models/gemini-2.5-flash")
    onProgress?: (progress: number) => void
  ): Promise<RefinedSegment[]> {
    return this.refineWithGemini(apiKey, transcriptions, rawData, modelName, onProgress);
  }

  /**
   * Refine with Google Gemini API using user-selected model
   */
  private static async refineWithGemini(
    apiKey: string,
    transcriptions: TranscriptionResult[], // Primary data
    rawData: RawTranscriptData[], // Supplementary data
    modelName: string, // REQUIRED: specific model like "models/gemini-2.5-flash"
    onProgress?: (progress: number) => void
  ): Promise<RefinedSegment[]> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API Key is required for AI refinement');
    }

    if (transcriptions.length === 0) {
      throw new Error('No transcript data to refine');
    }

    // Validate model name
    if (!modelName || !modelName.trim() || !modelName.startsWith('models/')) {
      throw new Error(
        'Vui lòng chọn Gemini Model trong Settings.\n\n' +
        'Bước 1: Mở Settings → Nhập Gemini API Key\n' +
        'Bước 2: Chờ hệ thống tải danh sách models\n' +
        'Bước 3: Chọn model từ dropdown (ví dụ: Gemini 2.5 Flash)\n' +
        'Bước 4: Lưu và thử lại'
      );
    }

    try {
      // Prepare primary data from transcriptions (user-edited, highest reliability)
      const transcriptData = transcriptions.map((item, index) => ({
        index: index + 1,
        timestamp: item.startTime,
        audioTime: item.audioTimeMs !== undefined ? this.formatAudioTime(item.audioTimeMs) : undefined,
        text: item.text,
        confidence: item.confidence,
        type: item.isFinal ? 'final' : 'interim'
      }));

      // Prepare supplementary raw data (if available)
      const hasRawData = rawData && rawData.length > 0;
      const rawMetadata = hasRawData ? rawData.map((item, index) => ({
        index: index + 1,
        timestamp: item.timestamp,
        audioTime: item.audioTimeMs !== undefined ? this.formatAudioTime(item.audioTimeMs) : undefined,
        text: item.text,
        confidence: item.confidence,
        type: item.isFinal ? 'final' : 'interim'
      })) : null;

      // Create prompt
      const prompt = this.createRefinementPrompt(transcriptData, rawMetadata);

      if (onProgress) onProgress(10);

      // Build endpoint URL with selected model
      const endpoint = `https://generativelanguage.googleapis.com/${this.GEMINI_API_VERSION}/${modelName}:generateContent`;
      console.log(`🤖 Using Gemini model: ${modelName}`);
      console.log(`📡 Endpoint: ${endpoint}`);

      // Call Gemini API
      const response = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE"
            }
          ]
        })
      });

      if (onProgress) onProgress(70);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || response.statusText;
        
        // Provide helpful error messages
        if (response.status === 403) {
          if (errorMsg.includes('API has not been used') || errorMsg.includes('SERVICE_DISABLED')) {
            throw new Error(
              'API Key không hợp lệ hoặc chưa enable.\n\n' +
              '✅ Lấy API key miễn phí tại: https://aistudio.google.com/app/apikey\n' +
              'Sau đó paste vào Settings → Gemini API Key'
            );
          } else if (errorMsg.includes('API_KEY_INVALID')) {
            throw new Error('API Key không hợp lệ. Vui lòng kiểm tra lại trong Settings.');
          }
        } else if (response.status === 404) {
          throw new Error(
            `Model "${modelName}" không tồn tại hoặc không khả dụng.\n\n` +
            'Giải pháp:\n' +
            '1. Mở Settings → Click nút "Tải lại" bên cạnh Gemini Model\n' +
            '2. Chọn model khác từ danh sách (khuyên dùng: Gemini 2.5 Flash)\n' +
            '3. Lưu và thử lại\n\n' +
            `Chi tiết lỗi: ${errorMsg}`
          );
        }
        
        throw new Error(`Gemini API error (${response.status}): ${errorMsg}`);
      }

      const result = await response.json();
      
      if (onProgress) onProgress(90);

      // Parse AI response
      const refinedSegments = this.parseAIResponse(result);

      if (onProgress) onProgress(100);

      console.log(`✅ Successfully refined ${refinedSegments.length} segments`);
      return refinedSegments;

    } catch (error: any) {
      console.error('AI Refinement Error:', error);
      throw new Error(`Failed to refine transcripts: ${error.message}`);
    }
  }

  /**
   * Create refinement prompt for AI
   * @param transcriptData - Primary data from transcriptions (user-edited)
   * @param rawMetadata - Optional raw data for reference
   */
  private static createRefinementPrompt(transcriptData: any[], rawMetadata: any[] | null): string {
    const dataJson = JSON.stringify(transcriptData, null, 2);
    const hasRawData = rawMetadata && rawMetadata.length > 0;
    const rawDataJson = hasRawData ? JSON.stringify(rawMetadata, null, 2) : null;

    return `Vai trò: Bạn là một thư ký chuyên nghiệp chuyên soạn thảo biên bản cuộc họp.

Nhiệm vụ: Tôi sẽ cung cấp cho bạn văn bản đã chuyển từ giọng nói sang text (có thể có lỗi nhận diện, lặp từ, thiếu dấu câu). Hãy thực hiện:

1. Sửa lỗi nhận diện: Chỉnh lại các từ bị sai (ví dụ: 'thành viên hội đồng' thành 'Hội đồng thành viên').
2. Loại bỏ từ thừa: Xóa các từ đệm như 'à', 'ừm', 'thì', 'là', 'mà' hoặc các đoạn bị lặp lại do người nói ngập ngừng.
3. Thêm dấu câu & Viết hoa: Ngắt câu hợp lý, viết hoa các danh từ riêng và chức danh.
4. Giữ nguyên nội dung: Tuyệt đối không được thêm bớt ý kiến hoặc thay đổi sắc thái của người nói.
5. Gộp các đoạn liên quan: Các đoạn text liền nhau nếu cùng nội dung thì gộp lại thành một đoạn hoàn chỉnh.

Định dạng trả về: 
Trả về dưới dạng JSON array với format sau (chỉ JSON, không có markdown code block):
[
  {
    "timestamp": "2026-01-27T10:30:45.123Z",
    "audioTimeMs": 12345,
    "text": "Nội dung đã được làm sạch và chuẩn hóa."
  },
  ...
]

=== DỮ LIỆU CHÍNH (Độ tin cậy tuyệt đối - Có thể đã được người dùng chỉnh sửa) ===
${dataJson}
${hasRawData ? `\n=== DỮ LIỆU BỔ TRỢ (Raw output từ Google Web Speech API - Chỉ tham khảo) ===\n${rawDataJson}\n\nChú ý: Dữ liệu raw chỉ dùng để tham khảo thêm về confidence và metadata gốc. Ưu tiên sử dụng "Dữ liệu chính" vì có thể đã được người dùng edit trực tiếp.` : ''}

Lưu ý: 
- Sử dụng văn bản từ "Dữ liệu chính" làm nguồn chính
- Giữ nguyên timestamp và audioTimeMs từ dữ liệu gốc
- Gộp các segment có nội dung liên tiếp thành câu hoàn chỉnh
- Chỉ trả về JSON array, không thêm giải thích`;
  }

  /**
   * Parse AI response and create refined segments
   */
  private static parseAIResponse(apiResponse: any): RefinedSegment[] {
    try {
      // Extract text from Gemini response
      const candidates = apiResponse.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No response from AI');
      }

      const content = candidates[0].content;
      if (!content || !content.parts || content.parts.length === 0) {
        throw new Error('Invalid AI response format');
      }

      let responseText = content.parts[0].text.trim();

      // Remove markdown code blocks if present
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Parse JSON
      const refinedData = JSON.parse(responseText);

      if (!Array.isArray(refinedData)) {
        throw new Error('AI response is not an array');
      }

      // Validate and map to RefinedSegment
      const segments: RefinedSegment[] = refinedData
        .filter(item => item.text && item.text.trim().length > 0)
        .map(item => ({
          text: item.text.trim(),
          timestamp: item.timestamp || new Date().toISOString(),
          audioTimeMs: item.audioTimeMs
        }));

      return segments;

    } catch (error: any) {
      console.error('Failed to parse AI response:', error);
      console.log('Raw API response:', JSON.stringify(apiResponse, null, 2));
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  /**
   * Format audio time in milliseconds to mm:ss
   */
  private static formatAudioTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Convert refined segments back to TranscriptionResult format
   */
  public static convertToTranscriptionResults(
    refinedSegments: RefinedSegment[],
    speakerPrefix: string = 'Person1'
  ): TranscriptionResult[] {
    return refinedSegments.map((segment, index) => ({
      id: `refined-${Date.now()}-${index}`,
      text: segment.text,
      startTime: segment.timestamp,
      endTime: segment.timestamp, // Same as start for refined segments
      audioTimeMs: segment.audioTimeMs,
      confidence: 1.0, // AI-refined content has high confidence
      speaker: speakerPrefix,
      isFinal: true,
      isManuallyEdited: false,
      isAIRefined: true // Mark as AI-refined
    }));
  }

  /**
   * Transcribe audio file using Gemini Multimodal API
   * Gemini 1.5+ models can directly process audio files (mp3, wav, aac, webm, etc.)
   */
  public static async transcribeAudioWithGemini(
    apiKey: string,
    audioBlob: Blob,
    modelName: string, // e.g., "models/gemini-1.5-flash" or "models/gemini-2.0-flash-exp"
    onProgress?: (progress: number) => void
  ): Promise<TranscriptionResult[]> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('Gemini API Key is required');
    }

    if (!modelName || !modelName.startsWith('models/')) {
      throw new Error('Please select a Gemini model in Settings');
    }

    if (onProgress) onProgress(10);

    try {
      // Convert WebM to WAV if needed (Gemini requires WAV or MP3)
      let processedAudio = audioBlob;
      if (audioBlob.type === 'audio/webm' || audioBlob.type === 'video/webm') {
        if (onProgress) onProgress(15);
        processedAudio = await this.convertToWav(audioBlob);
        if (onProgress) onProgress(25);
      }

      // Convert audio blob to base64
      const base64Audio = await this.blobToBase64(processedAudio);
      if (onProgress) onProgress(30);

      // Get MIME type (use WAV if converted)
      const mimeType = processedAudio.type || 'audio/wav';

      // Prepare request
      const endpoint = `https://generativelanguage.googleapis.com/${this.GEMINI_API_VERSION}/${modelName}:generateContent?key=${apiKey}`;

      const requestBody = {
        contents: [{
          parts: [
            {
              text: `Hãy nghe file âm thanh cuộc họp này và chuyển thành văn bản. Yêu cầu bắt buộc:

1. Chia văn bản thành các đoạn hội thoại tự nhiên.
2. Gắn nhãn thời gian [mm:ss] vào đầu mỗi đoạn dựa trên thời điểm người nói bắt đầu trong file âm thanh.
3. Nếu có nhiều người nói, hãy phân biệt bằng cách ghi 'Người nói 1:', 'Người nói 2:'...
4. Làm sạch văn bản (loại bỏ từ đệm, sửa lỗi chính tả).
5. Định dạng: Trả về kết quả dưới dạng JSON với cấu trúc:
{
  "segments": [
    {
      "timestamp": "mm:ss",
      "speaker": "Người nói 1",
      "text": "nội dung"
    }
  ]
}`
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Audio
              }
            }
          ]
        }]
      };

      if (onProgress) onProgress(40);

      // Make API request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (onProgress) onProgress(70);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API error (${response.status}): ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      if (onProgress) onProgress(90);

      // Parse response
      const results = this.parseGeminiAudioTranscription(data);
      if (onProgress) onProgress(100);

      return results;

    } catch (error: any) {
      console.error('Gemini audio transcription error:', error);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  /**
   * Convert Blob to Base64 string
   */
  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1]; // Remove data:audio/...;base64, prefix
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert audio blob to WAV format
   * Gemini API requires WAV or MP3 format, not WebM
   */
  private static async convertToWav(audioBlob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Convert to WAV
          const wavBlob = this.audioBufferToWav(audioBuffer);
          resolve(wavBlob);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = reject;
      reader.readAsArrayBuffer(audioBlob);
    });
  }

  /**
   * Convert AudioBuffer to WAV Blob
   */
  private static audioBufferToWav(audioBuffer: AudioBuffer): Blob {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;

    const data = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      data.push(audioBuffer.getChannelData(i));
    }

    const interleaved = this.interleave(data);
    const dataLength = interleaved.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // Write WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write audio data
    this.floatTo16BitPCM(view, 44, interleaved);

    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Interleave multiple audio channels
   */
  private static interleave(channelData: Float32Array[]): Float32Array {
    const length = channelData[0].length;
    const numberOfChannels = channelData.length;
    const result = new Float32Array(length * numberOfChannels);

    let offset = 0;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        result[offset++] = channelData[channel][i];
      }
    }

    return result;
  }

  /**
   * Write string to DataView
   */
  private static writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Convert Float32 samples to 16-bit PCM
   */
  private static floatTo16BitPCM(view: DataView, offset: number, input: Float32Array): void {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }

  /**
   * Parse Gemini audio transcription response
   */
  private static parseGeminiAudioTranscription(apiResponse: any): TranscriptionResult[] {
    try {
      const candidates = apiResponse.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No response from Gemini API');
      }

      const content = candidates[0].content;
      if (!content || !content.parts || content.parts.length === 0) {
        throw new Error('Empty response from Gemini');
      }

      const textResponse = content.parts[0].text;
      if (!textResponse) {
        throw new Error('No text in Gemini response');
      }

      // Extract JSON from response (handle markdown code blocks)
      let jsonText = textResponse.trim();
      const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)```/) || jsonText.match(/```\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonText);

      if (!parsed.segments || !Array.isArray(parsed.segments)) {
        throw new Error('Invalid JSON structure: missing segments array');
      }

      // Convert to TranscriptionResult format
      return parsed.segments.map((segment: any, index: number) => {
        const timestamp = segment.timestamp || '0:00';
        const audioTimeMs = this.parseTimestampToMs(timestamp);

        return {
          id: `gemini-${Date.now()}-${index}`,
          text: segment.text || '',
          startTime: new Date().toLocaleString('vi-VN'),
          endTime: new Date().toLocaleString('vi-VN'),
          audioTimeMs,
          confidence: 1.0,
          speaker: segment.speaker || 'Unknown',
          isFinal: true,
          isManuallyEdited: false,
          isAIRefined: true
        };
      });

    } catch (error: any) {
      console.error('Failed to parse Gemini audio transcription:', error);
      console.log('Raw API response:', JSON.stringify(apiResponse, null, 2));
      throw new Error(`Failed to parse Gemini response: ${error.message}`);
    }
  }

  /**
   * Parse timestamp string (mm:ss or m:ss) to milliseconds
   */
  private static parseTimestampToMs(timestamp: string): number {
    try {
      const parts = timestamp.split(':').map(p => parseInt(p.trim(), 10));
      if (parts.length === 2) {
        const [minutes, seconds] = parts;
        return (minutes * 60 + seconds) * 1000;
      }
      return 0;
    } catch {
      return 0;
    }
  }
}
