import type {
  MeetingInfo,
  MeetingMetadata,
  TranscriptionProject
} from '../types/types';

export class MetadataBuilder {
  static buildMetadata(
    meetingInfo: MeetingInfo,
    notes: string,
    timestampMap: Map<number, number>,
    duration: number,
    audioFileName: string
  ) {
    // Extract segments from notes
    const segments = this.extractSegments(notes, timestampMap, duration);

    // Meeting info JSON (compatible with C# SaveMeetingMetadataToJson)
    const meetingInfoJson: MeetingMetadata = {
      MeetingTitle: meetingInfo.title,
      MeetingDate: meetingInfo.date,
      MeetingTime: meetingInfo.time,
      Location: meetingInfo.location,
      Host: meetingInfo.host,
      Attendees: meetingInfo.attendees,
      CreatedAt: new Date().toISOString()
    };

    // Transcription JSON (compatible with C# TranscriptionProject.SaveProject)
    const transcriptionJson: TranscriptionProject = {
      ProjectName: audioFileName.replace('.wav', ''),
      AudioPath: audioFileName,
      ModelName: 'Live Recording',
      Language: 'vi',
      Duration: this.formatDuration(duration),
      Segments: segments.map((seg, index) => ({
        Index: index,
        Start: this.formatDuration(seg.start),
        End: this.formatDuration(seg.end),
        Text: seg.text,
        Highlight: false
      }))
    };

    return {
      meetingInfo: meetingInfoJson,
      transcription: transcriptionJson
    };
  }

  private static extractSegments(
    notes: string,
    timestampMap: Map<number, number>,
    totalDuration: number
  ): Array<{ start: number; end: number; text: string }> {
    const segments: Array<{ start: number; end: number; text: string }> = [];
    
    // Sort timestamps by position
    const sortedTimestamps = Array.from(timestampMap.entries())
      .sort((a, b) => a[0] - b[0]);

    for (let i = 0; i < sortedTimestamps.length; i++) {
      const [position, start] = sortedTimestamps[i];
      
      // Find next timestamp or use total duration
      const end =
        i < sortedTimestamps.length - 1
          ? sortedTimestamps[i + 1][1]
          : totalDuration;

      // Extract text between this timestamp and next
      const text = this.extractTextAtPosition(notes, position);

      if (text.trim()) {
        segments.push({ start, end, text: text.trim() });
      }
    }

    return segments;
  }

  private static extractTextAtPosition(text: string, position: number): string {
    // Find the line containing the timestamp
    const lines = text.split('\n');
    let currentPos = 0;

    for (const line of lines) {
      if (currentPos <= position && position < currentPos + line.length) {
        // Extract text after timestamp
        const match = line.match(/\[\d{2}:\d{2}:\d{2}\]\s*(.+)/);
        return match ? match[1] : '';
      }
      currentPos += line.length + 1; // +1 for newline
    }

    return '';
  }

  static formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Parse timestamp string to milliseconds
  static parseTimestamp(timeStr: string): number {
    const parts = timeStr.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (!parts) return 0;

    const hours = parseInt(parts[1], 10);
    const minutes = parseInt(parts[2], 10);
    const seconds = parseInt(parts[3], 10);

    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }
}
