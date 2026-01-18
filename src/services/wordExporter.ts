import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import type { MeetingInfo } from '../types/types';

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

export class WordExporter {
  // Create Word blob without downloading
  static async createWordBlob(
    meetingInfo: MeetingInfo,
    notesText: string
  ): Promise<Blob> {
    // Text is already clean (no timestamps embedded)
    const paragraphs = this.parseTextToParagraphs(notesText);
    
    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // Title
            new Paragraph({
              text: 'BÁO CÁO CUỘC HỌP',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),
            
            // Meeting information
            new Paragraph({
              text: 'THÔNG TIN CUỘC HỌP',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: 'Tiêu đề: ', bold: true }),
                new TextRun({ text: meetingInfo.title })
              ],
              spacing: { after: 100 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: 'Ngày: ', bold: true }),
                new TextRun({ text: meetingInfo.date })
              ],
              spacing: { after: 100 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: 'Giờ: ', bold: true }),
                new TextRun({ text: meetingInfo.time })
              ],
              spacing: { after: 100 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: 'Địa điểm: ', bold: true }),
                new TextRun({ text: meetingInfo.location || 'N/A' })
              ],
              spacing: { after: 100 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: 'Chủ trì: ', bold: true }),
                new TextRun({ text: meetingInfo.host || 'N/A' })
              ],
              spacing: { after: 100 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: 'Thành phần tham dự: ', bold: true }),
                new TextRun({ text: meetingInfo.attendees || 'N/A' })
              ],
              spacing: { after: 300 }
            }),
            
            // Notes content
            new Paragraph({
              text: 'NỘI DUNG CUỘC HỌP',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 }
            }),
            
            ...paragraphs
          ]
        }
      ]
    });
    
    // Generate blob
    const { Packer } = await import('docx');
    return await Packer.toBlob(doc);
  }

  // Export with auto-download (for fallback browsers)
  static async exportToWord(
    meetingInfo: MeetingInfo,
    notesText: string,
    fileName: string
  ): Promise<void> {
    const fileNameWithTimestamp = addTimestampPrefix(fileName);
    const blob = await this.createWordBlob(meetingInfo, notesText);
    saveAs(blob, fileNameWithTimestamp);
  }
  
  private static parseTextToParagraphs(text: string): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    
    // Split by newlines
    const lines = text.split('\n');
    
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed) {
        paragraphs.push(
          new Paragraph({
            text: trimmed,
            spacing: { after: 100 }
          })
        );
      } else {
        // Empty line for spacing
        paragraphs.push(
          new Paragraph({
            text: '',
            spacing: { after: 50 }
          })
        );
      }
    });
    
    return paragraphs;
  }
}
