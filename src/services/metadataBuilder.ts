import type {
  MeetingInfo,
  MeetingMetadata
} from '../types/types';

export class MetadataBuilder {
  static buildMetadata(
    meetingInfo: MeetingInfo,
    notes: string,
    timestampMap: Map<number, number>,
    duration: number,
    audioFileName: string
  ) {
    console.log('Building metadata with notes:', notes);
    console.log('Timestamp map entries:', Array.from(timestampMap.entries()));
    
    // Extract timestamps from notes with proper text content
    const timestamps = this.extractTimestamps(notes, timestampMap, duration);
    
    console.log('Extracted timestamps:', timestamps);

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

    // Metadata JSON with new structure
    const metadataJson = {
      ProjectName: audioFileName.replace('.wav', ''),
      Model: 'Live Recording',
      Language: 'vi',
      OriginalFileName: audioFileName,
      AudioFileName: audioFileName,
      Duration: this.formatDurationWithMs(duration),
      Timestamps: timestamps
    };

    return {
      meetingInfo: meetingInfoJson,
      metadata: metadataJson
    };
  }

  private static extractTimestamps(
    notes: string,
    timestampMap: Map<number, number>,
    totalDuration: number
  ): Array<{ Index: number; Text: string; StartTime: string; EndTime: string; Highlight: boolean }> {
    const timestamps: Array<{ Index: number; Text: string; StartTime: string; EndTime: string; Highlight: boolean }> = [];
    
    // Sort timestamps by time (not position)
    const sortedTimestamps = Array.from(timestampMap.entries())
      .sort((a, b) => a[1] - b[1]);

    for (let i = 0; i < sortedTimestamps.length; i++) {
      const [position, startTime] = sortedTimestamps[i];
      
      // Find next timestamp or use total duration
      const endTime =
        i < sortedTimestamps.length - 1
          ? sortedTimestamps[i + 1][1]
          : Math.min(startTime + 3000, totalDuration); // Default 3 seconds or end

      // Extract text after this timestamp
      const text = this.extractTextAfterTimestamp(notes, position);

      if (text.trim()) {
        timestamps.push({
          Index: i,
          Text: text.trim(),
          StartTime: this.formatDurationWithMs(startTime),
          EndTime: this.formatDurationWithMs(endTime),
          Highlight: false
        });
      }
    }

    return timestamps;
  }

  private static extractTextAfterTimestamp(text: string, position: number): string {
    // Split text into lines
    const lines = text.split('\n');
    let charCount = 0;
    
    // Find the line containing this position
    for (const line of lines) {
      if (charCount <= position && position < charCount + line.length) {
        // Found the line with timestamp
        // Extract text after the timestamp pattern [HH:MM:SS]
        const timestampRegex = /\[\d{2}:\d{2}:\d{2}\]\s*/;
        const textAfterTimestamp = line.replace(timestampRegex, '').trim();
        return textAfterTimestamp;
      }
      charCount += line.length + 1; // +1 for newline
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

  // Format with milliseconds (HH:MM:SS.mmmmmmm)
  static formatDurationWithMs(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}0000`;
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
