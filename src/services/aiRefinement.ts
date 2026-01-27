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
   */
  public static async refineTranscripts(
    apiKey: string,
    rawData: RawTranscriptData[],
    modelName: string, // REQUIRED: specific Gemini model (e.g., "models/gemini-2.5-flash")
    onProgress?: (progress: number) => void
  ): Promise<RefinedSegment[]> {
    return this.refineWithGemini(apiKey, rawData, modelName, onProgress);
  }

  /**
   * Refine with Google Gemini API using user-selected model
   */
  private static async refineWithGemini(
    apiKey: string,
    rawData: RawTranscriptData[],
    modelName: string, // REQUIRED: specific model like "models/gemini-2.5-flash"
    onProgress?: (progress: number) => void
  ): Promise<RefinedSegment[]> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API Key is required for AI refinement');
    }

    if (rawData.length === 0) {
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
      // Prepare data for AI
      const transcriptData = rawData.map((item, index) => ({
        index: index + 1,
        timestamp: item.timestamp,
        audioTime: item.audioTimeMs !== undefined ? this.formatAudioTime(item.audioTimeMs) : undefined,
        text: item.text,
        confidence: item.confidence,
        type: item.isFinal ? 'final' : 'interim'
      }));

      // Create prompt
      const prompt = this.createRefinementPrompt(transcriptData);

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
   */
  private static createRefinementPrompt(transcriptData: any[]): string {
    const dataJson = JSON.stringify(transcriptData, null, 2);

    return `Vai trò: Bạn là một thư ký chuyên nghiệp chuyên soạn thảo biên bản cuộc họp.

Nhiệm vụ: Tôi sẽ cung cấp cho bạn một đoạn văn bản thô (raw transcript) được chuyển từ giọng nói sang text (có thể có lỗi nhận diện, lặp từ, thiếu dấu câu). Hãy thực hiện:

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

Dữ liệu transcript thô:
${dataJson}

Lưu ý: 
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
}
