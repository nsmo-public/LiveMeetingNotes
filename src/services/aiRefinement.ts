import type { TranscriptionResult, AIProvider } from '../types/types';

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
 * AI Refinement Service supporting multiple AI providers
 * Refines raw speech-to-text transcripts with AI
 */
export class AIRefinementService {
  // Try multiple Gemini endpoints with fallback mechanism
  private static readonly GEMINI_ENDPOINTS = [
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
    'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent',
  ];
  private static readonly GEMINI_MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
  private static readonly OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

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
   * Refine transcripts using selected AI provider
   */
  public static async refineTranscripts(
    apiKey: string,
    rawData: RawTranscriptData[],
    provider: AIProvider = 'gemini',
    onProgress?: (progress: number) => void
  ): Promise<RefinedSegment[]> {
    if (provider === 'openai') {
      return this.refineWithOpenAI(apiKey, rawData, onProgress);
    } else {
      return this.refineWithGemini(apiKey, rawData, onProgress);
    }
  }

  /**
   * Refine with Google Gemini API with fallback mechanism
   */
  private static async refineWithGemini(
    apiKey: string,
    rawData: RawTranscriptData[],
    onProgress?: (progress: number) => void
  ): Promise<RefinedSegment[]> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API Key is required for AI refinement');
    }

    if (rawData.length === 0) {
      throw new Error('No transcript data to refine');
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

      // Try multiple endpoints with fallback
      let lastError: any = null;
      for (let i = 0; i < this.GEMINI_ENDPOINTS.length; i++) {
        const endpoint = this.GEMINI_ENDPOINTS[i];
        const modelName = endpoint.split('/models/')[1].split(':')[0];
        
        console.log(`Trying Gemini endpoint ${i + 1}/${this.GEMINI_ENDPOINTS.length}: ${modelName}`);
        
        try {
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

          if (response.ok) {
            // Success! Parse and return
            if (onProgress) onProgress(70);
            const result = await response.json();
            if (onProgress) onProgress(90);
            const refinedSegments = this.parseAIResponse(result);
            if (onProgress) onProgress(100);
            
            console.log(`✅ Success with ${modelName}`);
            return refinedSegments;
          }

          // Non-OK response, try to get error details
          const errorData = await response.json().catch(() => ({}));
          
          // Check for specific error types that should stop trying
          if (response.status === 403) {
            const errorMsg = errorData.error?.message || '';
            if (errorMsg.includes('API has not been used') || errorMsg.includes('SERVICE_DISABLED')) {
              throw new Error(
                'API Key không hợp lệ hoặc chưa enable Gemini API.\n\n' +
                '✅ GIẢI PHÁP NHANH NHẤT:\n' +
                '1. Lấy API key miễn phí tại: https://aistudio.google.com/app/apikey\n' +
                '2. Copy key vào field "Gemini API Key" trong Settings\n\n' +
                '📝 Hoặc nếu dùng Google Cloud API Key:\n' +
                '- Enable "Generative Language API" trong Google Cloud Console\n' +
                '- Link: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com'
              );
            } else if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('INVALID_ARGUMENT')) {
              throw new Error('API Key không hợp lệ. Vui lòng kiểm tra lại API key trong Settings.');
            }
          }
          
          // For 404, just continue to next endpoint
          if (response.status === 404) {
            console.log(`❌ Model ${modelName} not found (404), trying next...`);
            lastError = `${modelName}: ${errorData.error?.message || 'Not found'}`;
            continue;
          }
          
          // Other errors - save and try next
          lastError = `${modelName} (${response.status}): ${errorData.error?.message || response.statusText}`;
          console.log(`❌ ${lastError}, trying next...`);
          
        } catch (error: any) {
          // Network or parsing error
          lastError = `${modelName}: ${error.message}`;
          console.log(`❌ ${lastError}, trying next...`);
          continue;
        }
      }

      // All endpoints failed
      throw new Error(
        'Tất cả Gemini models đều không khả dụng.\n\n' +
        `Chi tiết lỗi cuối: ${lastError}\n\n` +
        '💡 GIẢI PHÁP:\n' +
        '1. Thử chuyển sang OpenAI ChatGPT trong Settings (AI Provider = OpenAI)\n' +
        '2. Hoặc kiểm tra API key Gemini của bạn tại: https://aistudio.google.com/app/apikey\n' +
        '3. Hoặc xem danh sách models khả dụng bằng Developer Console:\n' +
        '   const models = await AIRefinementService.listGeminiModels("YOUR_API_KEY")'
      );

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
   * Refine with OpenAI ChatGPT API
   */
  private static async refineWithOpenAI(
    apiKey: string,
    rawData: RawTranscriptData[],
    onProgress?: (progress: number) => void
  ): Promise<RefinedSegment[]> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('OpenAI API Key is required');
    }

    if (rawData.length === 0) {
      throw new Error('No transcript data to refine');
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

      const dataJson = JSON.stringify(transcriptData, null, 2);

      // Create system and user messages
      const systemMessage = `Bạn là một thư ký chuyên nghiệp chuyên soạn thảo biên bản cuộc họp. Nhiệm vụ của bạn là làm sạch và chuẩn hóa văn bản chuyển đổi từ giọng nói sang text.`;

      const userMessage = `Tôi có một đoạn văn bản thô (raw transcript) được chuyển từ giọng nói sang text. Hãy thực hiện:

1. Sửa lỗi nhận diện: Chỉnh lại các từ bị sai
2. Loại bỏ từ thừa: Xóa các từ đệm như 'à', 'ừm', 'thì', 'là', 'mà' hoặc các đoạn bị lặp lại
3. Thêm dấu câu & Viết hoa: Ngắt câu hợp lý, viết hoa các danh từ riêng và chức danh
4. Giữ nguyên nội dung: Tuyệt đối không được thêm bớt ý kiến hoặc thay đổi sắc thái
5. Gộp các đoạn liên quan: Các đoạn text liền nhau nếu cùng nội dung thì gộp lại

Định dạng trả về: Chỉ trả về JSON array với format sau (KHÔNG có markdown code block):
[
  {
    "timestamp": "2026-01-27T10:30:45.123Z",
    "audioTimeMs": 12345,
    "text": "Nội dung đã được làm sạch."
  }
]

Dữ liệu transcript thô:
${dataJson}`;

      if (onProgress) onProgress(10);

      // Call OpenAI API
      const response = await fetch(this.OPENAI_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.2,
          max_tokens: 4000
        })
      });

      if (onProgress) onProgress(70);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
          throw new Error('OpenAI API Key không hợp lệ. Vui lòng kiểm tra lại API key.');
        } else if (response.status === 429) {
          throw new Error('Đã vượt quá giới hạn rate limit của OpenAI. Vui lòng thử lại sau.');
        } else if (response.status === 402) {
          throw new Error('Tài khoản OpenAI hết credit. Vui lòng nạp thêm credit.');
        }
        
        throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      
      if (onProgress) onProgress(90);

      // Parse OpenAI response
      const refinedSegments = this.parseOpenAIResponse(result);

      if (onProgress) onProgress(100);

      return refinedSegments;

    } catch (error: any) {
      console.error('OpenAI Refinement Error:', error);
      throw new Error(`Failed to refine with OpenAI: ${error.message}`);
    }
  }

  /**
   * Parse OpenAI response
   */
  private static parseOpenAIResponse(apiResponse: any): RefinedSegment[] {
    try {
      const content = apiResponse.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      let responseText = content.trim();

      // Remove markdown code blocks if present
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Parse JSON
      const refinedData = JSON.parse(responseText);

      if (!Array.isArray(refinedData)) {
        throw new Error('OpenAI response is not an array');
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
      console.error('Failed to parse OpenAI response:', error);
      console.log('Raw API response:', JSON.stringify(apiResponse, null, 2));
      throw new Error(`Failed to parse OpenAI response: ${error.message}`);
    }
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
