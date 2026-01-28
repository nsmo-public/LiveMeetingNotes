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

  // Gemini Free Tier Limits (per day)
  private static readonly FREE_TIER_LIMITS = {
    RPM: 15,           // Requests per minute
    TPM: 1000000,      // Tokens per minute (1M)
    RPD: 1500,         // Requests per day
    TPD: 250000        // Tokens per day (250K) - Main limit users hit
  };

  // Batch processing configuration
  private static readonly BATCH_SIZE = 30; // Reduced from 50 to 30 segments per batch (~5000 tokens)
  private static readonly BATCH_DELAY_MS = 6000; // Increased from 5000 to 6000ms (6 seconds) between batches to avoid rate limit

  /**
   * Estimate token count for transcripts
   * OPTIMIZED: Reduced prompt overhead after optimization (1000 -> 500 tokens)
   */
  private static estimateTokenCount(transcriptions: TranscriptionResult[]): number {
    // Rough estimation: 1 token ≈ 4 characters for English, ~2-3 for Vietnamese
    const totalChars = transcriptions.reduce((sum, t) => sum + t.text.length, 0);
    // Vietnamese: ~2.5 chars per token, English: ~4 chars per token
    // Use 3 as average + reduced overhead for optimized prompt
    const estimatedTokens = Math.ceil(totalChars / 3) + 500; // +500 for compact prompt overhead (reduced from 1000)
    return estimatedTokens;
  }

  /**
   * Check if processing would exceed quota
   */
  private static checkQuotaEstimate(transcriptions: TranscriptionResult[]): {
    estimatedTokens: number;
    withinLimit: boolean;
    message: string;
  } {
    const estimatedTokens = this.estimateTokenCount(transcriptions);
    const withinLimit = estimatedTokens < this.FREE_TIER_LIMITS.TPD;

    let message = '';
    if (!withinLimit) {
      message = `⚠️ Ước tính ${estimatedTokens.toLocaleString()} tokens - vượt hạn mức miễn phí (${this.FREE_TIER_LIMITS.TPD.toLocaleString()} tokens/ngày)`;
    } else {
      const percentUsed = Math.round((estimatedTokens / this.FREE_TIER_LIMITS.TPD) * 100);
      message = `✅ Ước tính ${estimatedTokens.toLocaleString()} tokens (~${percentUsed}% hạn mức miễn phí)`;
    }

    return { estimatedTokens, withinLimit, message };
  }

  /**
   * Split transcriptions into batches for processing
   */
  private static splitIntoBatches(transcriptions: TranscriptionResult[], batchSize: number): TranscriptionResult[][] {
    const batches: TranscriptionResult[][] = [];
    for (let i = 0; i < transcriptions.length; i += batchSize) {
      batches.push(transcriptions.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Check quota status by making a minimal test request
   * Returns usage info and recommendations
   */
  public static async checkQuotaStatus(apiKey: string, modelName: string): Promise<{
    status: 'available' | 'limited' | 'exceeded' | 'error';
    message: string;
    recommendations: string[];
  }> {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/${this.GEMINI_API_VERSION}/${modelName}:generateContent`;
      
      const response = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'test' }] }],
          generationConfig: { maxOutputTokens: 1 }
        })
      });
      
      if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || '';
        
        if (errorMsg.includes('quota') || errorMsg.includes('250000')) {
          return {
            status: 'exceeded',
            message: '🚫 Đã vượt hạn mức 250,000 tokens/ngày',
            recommendations: [
              '🕒 Đợi 24 giờ để quota reset',
              '💳 Nâng cấp Paid tier: ~$2/tháng, unlimited',
              '📊 Monitor: https://ai.dev/rate-limit'
            ]
          };
        } else {
          return {
            status: 'limited',
            message: '⏱️ Vượt 15 requests/phút',
            recommendations: [
              '⏰ Đợi 1-2 phút rồi thử lại',
              '🔄 App sẽ tự động delay giữa các batch'
            ]
          };
        }
      } else if (response.ok) {
        return {
          status: 'available',
          message: '✅ API Key hoạt động bình thường',
          recommendations: [
            '🎯 Free tier: 250,000 tokens/ngày',
            '📊 Mỗi 50 segments ~ 7,500 tokens',
            '🔍 Monitor: https://ai.dev/rate-limit'
          ]
        };
      } else {
        return {
          status: 'error',
          message: `❌ Lỗi API: ${response.status}`,
          recommendations: [
            'Kiểm tra API Key có hợp lệ',
            'Kiểm tra model đã chọn đúng'
          ]
        };
      }
    } catch (error: any) {
      return {
        status: 'error',
        message: 'Không thể kiểm tra quota',
        recommendations: [
          'Kiểm tra kết nối internet',
          'Thử lại sau vài phút'
        ]
      };
    }
  }

  /**
   * Get usage metadata and quota information from Gemini API
   * Note: Gemini API doesn't provide direct quota endpoint, but we can infer from rate limit headers
   */
  public static async checkQuotaInfo(apiKey: string, modelName: string): Promise<{
    estimatedUsage: string;
    quotaStatus: string;
    recommendations: string[];
  }> {
    try {
      // Make a minimal test request to check quota status
      const endpoint = `https://generativelanguage.googleapis.com/${this.GEMINI_API_VERSION}/${modelName}:generateContent`;
      
      const response = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'test' }]
          }],
          generationConfig: {
            maxOutputTokens: 1
          }
        })
      });

      // Check response headers for quota info (if available)
      // const remainingRequests = response.headers.get('x-ratelimit-remaining');
      // const resetTime = response.headers.get('x-ratelimit-reset');
      
      // Parse response to check for quota errors
      const recommendations: string[] = [];
      let quotaStatus = 'unknown';
      let estimatedUsage = 'Không có thông tin chi tiết';

      if (response.status === 429) {
        quotaStatus = 'exceeded';
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || '';
        
        if (errorMsg.includes('quota')) {
          estimatedUsage = 'Đã vượt hạn mức 250,000 tokens/ngày';
          recommendations.push('Đợi 24 giờ để quota reset');
          recommendations.push('Hoặc nâng cấp lên Paid tier (~$2/tháng)');
        } else {
          estimatedUsage = 'Đã vượt 15 requests/phút';
          recommendations.push('Đợi 1 phút rồi thử lại');
        }
      } else if (response.ok) {
        quotaStatus = 'available';
        estimatedUsage = 'API Key hoạt động bình thường';
        
        // Estimate based on typical usage
        recommendations.push('✅ Free tier: 250,000 tokens/ngày, 15 requests/phút');
        recommendations.push('💡 Mỗi 50 segments ~ 7,500 tokens');
        recommendations.push('📊 Monitor: https://ai.dev/rate-limit');
      }

      return {
        estimatedUsage,
        quotaStatus,
        recommendations
      };
    } catch (error: any) {
      return {
        estimatedUsage: 'Không thể kiểm tra quota',
        quotaStatus: 'error',
        recommendations: [
          'Kiểm tra API Key có hợp lệ',
          'Kiểm tra kết nối internet',
          'Thử lại sau vài phút'
        ]
      };
    }
  }

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
   * Refine transcripts using Gemini AI with automatic batching
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
    // Check quota estimate first
    const quotaCheck = this.checkQuotaEstimate(transcriptions);
    console.log('📊 Quota Check:', quotaCheck.message);

    // If estimated tokens exceed limit, use batch processing
    if (quotaCheck.estimatedTokens > this.FREE_TIER_LIMITS.TPD * 0.8) { // 80% threshold
      console.log('🔄 Using batch processing to avoid quota limits...');
      return this.refineTranscriptsInBatches(apiKey, transcriptions, rawData, modelName, onProgress);
    }

    // Otherwise, process normally
    return this.refineWithGemini(apiKey, transcriptions, rawData, modelName, onProgress);
  }

  /**
   * Refine transcripts in batches to avoid quota limits
   */
  private static async refineTranscriptsInBatches(
    apiKey: string,
    transcriptions: TranscriptionResult[],
    rawData: RawTranscriptData[],
    modelName: string,
    onProgress?: (progress: number) => void
  ): Promise<RefinedSegment[]> {
    const batches = this.splitIntoBatches(transcriptions, this.BATCH_SIZE);
    const allRefinedSegments: RefinedSegment[] = [];

    console.log(`📦 Processing ${transcriptions.length} segments in ${batches.length} batches...`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchProgress = (i / batches.length) * 100;

      console.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batch.length} segments)...`);

      try {
        // Find corresponding raw data for this batch
        const batchStartIndex = i * this.BATCH_SIZE;
        const batchRawData = rawData.slice(batchStartIndex, batchStartIndex + batch.length);

        // Process this batch
        const refinedBatch = await this.refineWithGemini(
          apiKey,
          batch,
          batchRawData,
          modelName,
          (subProgress) => {
            if (onProgress) {
              const totalProgress = batchProgress + (subProgress / batches.length);
              onProgress(Math.min(totalProgress, 99));
            }
          }
        );

        allRefinedSegments.push(...refinedBatch);

        // Add delay between batches to avoid rate limiting (except for last batch)
        if (i < batches.length - 1) {
          console.log(`⏳ Waiting ${this.BATCH_DELAY_MS / 1000} seconds before next batch to avoid rate limit...`);
          await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY_MS));
        }
      } catch (error: any) {
        // If quota exceeded, throw error with helpful message
        if (error.message.includes('429') || error.message.includes('quota')) {
          throw new Error(
            `Vượt hạn mức API tại batch ${i + 1}/${batches.length}.\n\n` +
            `✅ Đã xử lý: ${allRefinedSegments.length}/${transcriptions.length} segments\n\n` +
            `Nguyên nhân: ${error.message}\n\n` +
            `💡 Giải pháp:\n` +
            `• Đợi 24 giờ để quota reset (hạn mức: 250,000 tokens/ngày)\n` +
            `• Hoặc nâng cấp lên Gemini API trả phí tại console.cloud.google.com`
          );
        }
        throw error;
      }
    }

    if (onProgress) onProgress(100);
    console.log(`✅ Batch processing complete: ${allRefinedSegments.length} segments refined`);
    return allRefinedSegments;
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
      // OPTIMIZED: Only send essential fields to reduce token usage
      const transcriptData = transcriptions.map((item) => ({
        timestamp: item.startTime,
        audioTimeMs: item.audioTimeMs,
        text: item.text
      }));

      // Prepare supplementary raw data (if available)
      // OPTIMIZED: Only send essential fields to reduce token usage
      const hasRawData = rawData && rawData.length > 0;
      const rawMetadata = hasRawData ? rawData.map((item) => ({
        timestamp: item.timestamp,
        audioTimeMs: item.audioTimeMs,
        text: item.text
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
        
        // Handle quota/rate limit errors (429)
        if (response.status === 429) {
          // Extract retry time if available
          const retryMatch = errorMsg.match(/retry in ([\d.]+)s/);
          const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
          const retryMinutes = Math.ceil(retrySeconds / 60);

          // Check if it's daily quota or rate limit
          if (errorMsg.includes('quota') || errorMsg.includes('250000')) {
            throw new Error(
              `🚫 Đã vượt hạn mức miễn phí của Gemini API\n\n` +
              `📊 Hạn mức free tier: 250,000 tokens/ngày\n` +
              `⏰ Thời gian reset: Sau ${retrySeconds}s (~ ${retryMinutes} phút)\n\n` +
              `💡 Giải pháp:\n` +
              `1️⃣ Đợi ${retryMinutes} phút rồi thử lại\n` +
              `2️⃣ Xử lý ít segments hơn (chọn đoạn quan trọng để chuẩn hóa)\n` +
              `3️⃣ Nâng cấp lên Gemini API trả phí:\n` +
              `   • Truy cập: https://console.cloud.google.com\n` +
              `   • Enable billing để có quota cao hơn (60 requests/phút)\n\n` +
              `📈 Monitor usage: https://ai.dev/rate-limit\n\n` +
              `Chi tiết: ${errorMsg}`
            );
          } else {
            // Rate limit (RPM)
            throw new Error(
              `⏱️ Vượt giới hạn requests/phút\n\n` +
              `📊 Hạn mức: 15 requests/phút (free tier)\n` +
              `⏰ Thử lại sau: ${retrySeconds}s\n\n` +
              `💡 Giải pháp: Đợi ${Math.ceil(retrySeconds / 60)} phút rồi thử lại\n\n` +
              `Chi tiết: ${errorMsg}`
            );
          }
        }
        
        // Provide helpful error messages for other errors
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
    // OPTIMIZED: Use compact JSON format (no pretty-print) to save tokens
    const dataJson = JSON.stringify(transcriptData);
    const hasRawData = rawMetadata && rawMetadata.length > 0;
    const rawDataJson = hasRawData ? JSON.stringify(rawMetadata) : null;

    // OPTIMIZED: Shortened prompt to reduce token count while maintaining quality
    return `Vai trò: Thư ký chuyên nghiệp soạn biên bản họp.

Nhiệm vụ: Chuẩn hóa văn bản speech-to-text:
1. Sửa lỗi nhận diện từ
2. Xóa từ đệm (à, ừm, thì, là, mà)
3. Thêm dấu câu, viết hoa danh từ riêng
4. Gộp các đoạn liên tiếp thành câu hoàn chỉnh
5. Giữ nguyên nội dung, không thêm bớt ý

Output: CHỈ JSON array, KHÔNG markdown/giải thích
Format: [{"timestamp":"...","audioTimeMs":123,"text":"..."},...]

=== DỮ LIỆU CHÍNH ===
${dataJson}
${hasRawData ? `\n=== DỮ LIỆU BỔ TRỢ (tham khảo) ===\n${rawDataJson}` : ''}

Giữ timestamp/audioTimeMs gốc. Chỉ trả về JSON array.`;
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

      // Log raw response for debugging
      console.log('🔍 Raw AI response (first 500 chars):', responseText.substring(0, 500));

      // Try to extract JSON if there's additional text
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        responseText = jsonMatch[0];
        console.log('✂️ Extracted JSON array from response');
      }

      // Parse JSON with better error handling
      let refinedData;
      try {
        refinedData = JSON.parse(responseText);
      } catch (parseError: any) {
        console.error('❌ JSON Parse Error:', parseError.message);
        console.log('📄 Full response text:', responseText);
        
        // Try to fix common JSON issues
        let fixedText = responseText
          // Fix unescaped newlines in strings
          .replace(/"text"\s*:\s*"([^"]*?)"/g, (_match: string, text: string) => {
            const escaped = text
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t');
            return `"text": "${escaped}"`;
          });

        console.log('🔧 Attempting to fix JSON...');
        try {
          refinedData = JSON.parse(fixedText);
          console.log('✅ JSON fixed and parsed successfully');
        } catch (secondError) {
          console.error('❌ Still cannot parse after fixes');
          throw parseError; // Throw original error
        }
      }

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
  // private static formatAudioTime(ms: number): string {
  //   const totalSeconds = Math.floor(ms / 1000);
  //   const minutes = Math.floor(totalSeconds / 60);
  //   const seconds = totalSeconds % 60;
  //   return `${minutes}:${String(seconds).padStart(2, '0')}`;
  // }

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
   * Gemini API officially supports: WAV and MP3 only
   * Other formats (WebM, MP4, OGG, AAC, FLAC) must be converted to WAV first
   */
  public static async transcribeAudioWithGemini(
    apiKey: string,
    audioBlob: Blob,
    modelName: string, // e.g., "models/gemini-1.5-flash" or "models/gemini-2.0-flash-exp"
    onProgress?: (progress: number) => void,
    skipSizeCheck: boolean = false, // Skip size check when called from auto-split flow
    maxFileSizeMB: number = 20 // Maximum file size in MB (from config)
  ): Promise<TranscriptionResult[]> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('Gemini API Key is required');
    }

    if (!modelName || !modelName.startsWith('models/')) {
      throw new Error('Please select a Gemini model in Settings');
    }

    // Validate file size (limit from config)
    // Skip this check when called from transcribeEntireAudioWithGemini (already split into valid chunks)
    if (!skipSizeCheck) {
      const MAX_FILE_SIZE = maxFileSizeMB * 1024 * 1024;
      const fileSizeMB = audioBlob.size / (1024 * 1024);
      
      console.log(`📊 File size: ${fileSizeMB.toFixed(2)} MB (Limit: ${maxFileSizeMB} MB)`);
      
      if (audioBlob.size > MAX_FILE_SIZE) {
        // Return special error object with file size info
        const error: any = new Error('FILE_TOO_LARGE');
        error.fileSizeMB = fileSizeMB;
        error.maxSizeMB = maxFileSizeMB;
        throw error;
      }
    }

    if (onProgress) onProgress(10);

    try {
      // Convert to WAV if needed
      // Gemini API officially supports: WAV and MP3 only
      // All other formats need conversion to WAV
      let processedAudio = audioBlob;
      const audioType = audioBlob.type.toLowerCase();
      const isWavOrMp3 = audioType.includes('wav') || audioType.includes('mpeg') || audioType.includes('mp3');
      const needsConversion = !isWavOrMp3;
      
      if (needsConversion) {
        console.log(`🔄 Converting ${audioType} to WAV (Gemini requires WAV or MP3)...`);
        if (onProgress) onProgress(15);
        
        const originalSizeMB = audioBlob.size / (1024 * 1024);
        
        // Convert with lower sample rate if file is large
        const targetSampleRate = audioBlob.size > 10 * 1024 * 1024 ? 16000 : 44100;
        processedAudio = await this.convertToWav(audioBlob, targetSampleRate);
        
        const newSizeMB = processedAudio.size / (1024 * 1024);
        console.log(`✅ Converted: ${originalSizeMB.toFixed(2)}MB → ${newSizeMB.toFixed(2)}MB`);
        
        // Check again after conversion (only if not skipping size check)
        if (!skipSizeCheck) {
          const MAX_FILE_SIZE = maxFileSizeMB * 1024 * 1024;
          
          if (processedAudio.size > MAX_FILE_SIZE) {
            throw new Error(
              `❌ Sau chuyển đổi, file vẫn quá lớn: ${newSizeMB.toFixed(2)} MB\n\n` +
              `Vui lòng giảm thời lượng ghi âm hoặc giảm chất lượng.`
            );
          }
        }
        
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
   * Convert audio blob to WAV format with optional sample rate optimization
   * Gemini API officially supports WAV and MP3 only
   * @param targetSampleRate - Target sample rate (16000 for smaller files, 44100 for quality)
   */
  private static async convertToWav(audioBlob: Blob, targetSampleRate: number = 44100): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Resample if needed to reduce file size
          let finalBuffer = audioBuffer;
          if (audioBuffer.sampleRate !== targetSampleRate) {
            console.log(`🔊 Resampling: ${audioBuffer.sampleRate}Hz → ${targetSampleRate}Hz`);
            finalBuffer = await this.resampleAudioBuffer(audioBuffer, targetSampleRate);
          }

          // Convert to WAV
          const wavBlob = this.audioBufferToWav(finalBuffer);
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
   * Resample AudioBuffer to target sample rate (reduces file size)
   */
  private static async resampleAudioBuffer(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.duration * targetSampleRate,
      targetSampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    return await offlineContext.startRendering();
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
   * Split audio into chunks based on size AND duration limits
   * Each chunk must satisfy: size <= maxChunkSizeMB AND duration <= maxDurationMinutes
   * @param audioBlob - Audio blob to split (should be WAV format)
   * @param maxChunkSizeMB - Maximum size per chunk in MB (default: 20)
   * @param maxDurationMinutes - Maximum duration per chunk in minutes (default: 60)
   * @returns Array of chunks with blob, startTimeMs, endTimeMs
   */
  public static async splitAudioIntoChunks(
    audioBlob: Blob,
    maxChunkSizeMB: number = 20,
    maxDurationMinutes: number = 60
  ): Promise<{ blob: Blob; startTimeMs: number; endTimeMs: number }[]> {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          const totalDurationMs = audioBuffer.duration * 1000;
          const totalDurationMinutes = totalDurationMs / (60 * 1000);
          const totalSizeMB = audioBlob.size / (1024 * 1024);

          // Calculate number of chunks needed based on BOTH constraints
          // 1. Chunks needed based on size
          const chunksBySizeCount = Math.ceil(totalSizeMB / maxChunkSizeMB);
          
          // 2. Chunks needed based on duration
          const chunksByDurationCount = Math.ceil(totalDurationMinutes / maxDurationMinutes);
          
          // Take the MAXIMUM to satisfy BOTH constraints
          const numberOfChunks = Math.max(chunksBySizeCount, chunksByDurationCount);
          const chunkDurationMs = totalDurationMs / numberOfChunks;
          const chunkDurationMinutes = chunkDurationMs / (60 * 1000);

          console.log(`📏 Audio info: ${totalSizeMB.toFixed(2)}MB, ${totalDurationMinutes.toFixed(1)} minutes`);
          console.log(`📊 Constraints: maxSize=${maxChunkSizeMB}MB, maxDuration=${maxDurationMinutes} minutes`);
          console.log(`📦 Splitting into ${numberOfChunks} chunks (by size: ${chunksBySizeCount}, by duration: ${chunksByDurationCount})`);
          console.log(`⏱️ Each chunk: ~${chunkDurationMinutes.toFixed(1)} minutes, ~${(totalSizeMB / numberOfChunks).toFixed(2)}MB`);

          const chunks: { blob: Blob; startTimeMs: number; endTimeMs: number }[] = [];

          for (let i = 0; i < numberOfChunks; i++) {
            const startTimeMs = i * chunkDurationMs;
            const endTimeMs = Math.min((i + 1) * chunkDurationMs, totalDurationMs);

            console.log(`⏱️ Extracting chunk ${i + 1}/${numberOfChunks}: ${startTimeMs.toFixed(0)}ms - ${endTimeMs.toFixed(0)}ms`);

            const chunkBlob = await this.extractAudioSegment(audioBlob, startTimeMs, endTimeMs);

            chunks.push({
              blob: chunkBlob,
              startTimeMs,
              endTimeMs
            });
          }

          resolve(chunks);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = reject;
      reader.readAsArrayBuffer(audioBlob);
    });
  }

  /**
   * Extract a segment from audio blob based on time range
   * @param audioBlob - Original audio blob
   * @param startTimeMs - Start time in milliseconds
   * @param endTimeMs - End time in milliseconds
   * @returns Promise<Blob> - Audio segment blob
   */
  public static async extractAudioSegment(
    audioBlob: Blob,
    startTimeMs: number,
    endTimeMs: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Calculate start and end in samples
          const startSample = Math.floor((startTimeMs / 1000) * audioBuffer.sampleRate);
          const endSample = Math.floor((endTimeMs / 1000) * audioBuffer.sampleRate);
          const segmentLength = endSample - startSample;

          // Create new buffer for the segment
          const segmentBuffer = audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            segmentLength,
            audioBuffer.sampleRate
          );

          // Copy data for each channel
          for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            const segmentData = segmentBuffer.getChannelData(channel);
            for (let i = 0; i < segmentLength; i++) {
              segmentData[i] = channelData[startSample + i];
            }
          }

          // Convert to WAV
          const wavBlob = this.audioBufferToWav(segmentBuffer);
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
   * Process entire audio file by automatically splitting into chunks
   * Respects Gemini API limits: 15 req/min, 1500 req/day, configurable MB per file and duration
   * @param apiKey - Gemini API key
   * @param audioBlob - Original audio blob (can be > configurable limit)
   * @param modelName - Gemini model name
   * @param onProgress - Progress callback (progress: number, message: string)
   * @param maxFileSizeMB - Maximum file size in MB (from config, default: 20)
   * @param requestDelaySeconds - Delay between requests in seconds (from config, default: 5)
   * @param maxDurationMinutes - Maximum duration per chunk in minutes (from config, default: 60)
   * @returns Promise<TranscriptionResult[]> - All transcription results, sorted by timestamp
   */
  public static async transcribeEntireAudioWithGemini(
    apiKey: string,
    audioBlob: Blob,
    modelName: string,
    onProgress?: (progress: number, message: string) => void,
    maxFileSizeMB: number = 20,
    requestDelaySeconds: number = 5,
    maxDurationMinutes: number = 60
  ): Promise<TranscriptionResult[]> {
    const maxSizeMB = maxFileSizeMB;

    // CRITICAL: Convert to WAV first if needed, THEN split based on size
    // Gemini API officially supports: WAV and MP3 only
    // All other formats (WebM, MP4, OGG, AAC, FLAC) must be converted to WAV
    if (onProgress) onProgress(3, 'Đang kiểm tra định dạng audio...');
    
    let wavBlob = audioBlob;
    const audioType = audioBlob.type.toLowerCase();
    const isWavOrMp3 = audioType.includes('wav') || audioType.includes('mpeg') || audioType.includes('mp3');
    const needsConversion = !isWavOrMp3;
    
    if (needsConversion) {
      if (onProgress) onProgress(5, `Đang chuyển đổi ${audioType} sang WAV...`);
      // Convert with lower sample rate for smaller file size
      const targetSampleRate = 16000; // Lower sample rate = smaller file
      wavBlob = await this.convertToWav(audioBlob, targetSampleRate);
      
      const originalSizeMB = audioBlob.size / (1024 * 1024);
      const wavSizeMB = wavBlob.size / (1024 * 1024);
      console.log(`✅ Converted ${audioType}: ${originalSizeMB.toFixed(2)}MB → ${wavSizeMB.toFixed(2)}MB (WAV)`);
    } else {
      console.log(`✅ Audio format ${audioType} is supported by Gemini (WAV/MP3) - no conversion needed`);
    }

    // Now split the WAV file into chunks based on actual WAV size AND duration
    if (onProgress) onProgress(8, 'Đang phân tích và chia file WAV...');
    const chunks = await this.splitAudioIntoChunks(wavBlob, maxSizeMB, maxDurationMinutes);

    if (onProgress) onProgress(10, `Đã chia thành ${chunks.length} phần. Bắt đầu chuyển đổi...`);

    const allResults: TranscriptionResult[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkProgress = 10 + ((i / chunks.length) * 80);

      if (onProgress) {
        onProgress(
          chunkProgress,
          `Đang xử lý phần ${i + 1}/${chunks.length}...`
        );
      }

      try {
        // Transcribe this chunk (skip size check - already validated and split)
        const results = await this.transcribeAudioWithGemini(
          apiKey,
          chunk.blob,
          modelName,
          (subProgress) => {
            if (onProgress) {
              const totalProgress = chunkProgress + (subProgress / chunks.length) * 0.8;
              onProgress(totalProgress, `Phần ${i + 1}/${chunks.length}: ${subProgress.toFixed(0)}%`);
            }
          },
          true, // skipSizeCheck = true (chunks already validated)
          maxSizeMB // Pass maxFileSizeMB to child call
        );

        // Adjust timestamps for this chunk
        const adjustedResults = this.adjustTimestamps(results, chunk.startTimeMs);
        allResults.push(...adjustedResults);

        // Add delay between chunks to respect rate limits (15 req/min)
        if (i < chunks.length - 1) {
          if (onProgress) {
            onProgress(
              chunkProgress + 5,
              `Đợi ${requestDelaySeconds}s trước khi xử lý phần tiếp theo...`
            );
          }
          await new Promise(resolve => setTimeout(resolve, requestDelaySeconds * 1000));
        }
      } catch (error: any) {
        // Handle quota errors
        if (error.message.includes('429') || error.message.includes('quota')) {
          throw new Error(
            `Vượt hạn mức API tại phần ${i + 1}/${chunks.length}.\n\n` +
            `✅ Đã xử lý: ${i}/${chunks.length} phần\n` +
            `❌ Lỗi: ${error.message}\n\n` +
            `💡 Đợi 24 giờ hoặc nâng cấp Paid tier.`
          );
        }
        throw error;
      }
    }

    // Sort by timestamp
    allResults.sort((a, b) => (a.audioTimeMs || 0) - (b.audioTimeMs || 0));

    if (onProgress) onProgress(100, `Hoàn thành! ${allResults.length} segments`);

    console.log(`✅ Transcribed entire audio: ${allResults.length} segments from ${chunks.length} chunks`);
    return allResults;
  }

  /**
   * Adjust timestamps in transcription results based on segment start time
   * @param results - Transcription results from segment
   * @param offsetMs - Offset in milliseconds (segment start time)
   * @returns Adjusted transcription results
   */
  public static adjustTimestamps(
    results: TranscriptionResult[],
    offsetMs: number
  ): TranscriptionResult[] {
    return results.map(result => ({
      ...result,
      audioTimeMs: result.audioTimeMs ? result.audioTimeMs + offsetMs : undefined
    }));
  }

  /*
   * FUTURE ENHANCEMENT: optimizeAudioFormat() method
   * Could convert WAV to WebM/Opus to reduce file size by 70-90%
   * Reserved for future implementation
   */
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

        // For Gemini transcription, we don't have actual wall-clock time
        // Use current time as base, but mark it clearly
        const now = new Date();
        
        return {
          id: `gemini-${Date.now()}-${index}`,
          text: segment.text || '',
          startTime: now.toISOString(), // Use ISO format to avoid NaN display
          endTime: now.toISOString(),   // Same time since we don't have duration
          audioTimeMs, // This is the relative position in audio file (mm:ss)
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
