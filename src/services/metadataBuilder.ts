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
    // Extract timestamps from notes with proper text content
    const timestamps = this.extractTimestamps(notes, timestampMap, duration);

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
    _timestampMap: Map<number, number>,
    totalDuration: number
  ): Array<{ Index: number; Text: string; StartTime: string; EndTime: string; Highlight: boolean }> {
    const timestamps: Array<{ Index: number; Text: string; StartTime: string; EndTime: string; Highlight: boolean }> = [];
    
    // Directly parse all lines for timestamps - ignore timestampMap as positions may be stale
    const lines = notes.split('\n');
    const parsedLines: Array<{ timeMs: number; text: string }> = [];
    
    for (const line of lines) {
      const match = line.match(/\[(\d{2}):(\d{2}):(\d{2})\]\s*(.*)/);
      if (match) {
        const timeMs = this.parseTimestamp(match[0]);
        const text = match[4] || ''; // Text after timestamp
        parsedLines.push({ timeMs, text });
      }
    }
    
    // Sort by time
    parsedLines.sort((a, b) => a.timeMs - b.timeMs);

    for (let i = 0; i < parsedLines.length; i++) {
      const { timeMs: startTime, text } = parsedLines[i];
      
      // Find next timestamp or use total duration
      const endTime =
        i < parsedLines.length - 1
          ? parsedLines[i + 1].timeMs
          : Math.min(startTime + 3000, totalDuration); // Default 3 seconds or end

      timestamps.push({
        Index: i,
        Text: text.trim(),
        StartTime: this.formatDurationWithMs(startTime),
        EndTime: this.formatDurationWithMs(endTime),
        Highlight: false
      });
    }

    return timestamps;
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
