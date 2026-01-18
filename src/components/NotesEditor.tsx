import React, { useEffect, useRef, useState } from 'react';
import { Input } from 'antd';

const { TextArea } = Input;

interface Props {
  isRecording: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
  timestampMap: Map<number, number>;
  onTimestampMapChange: (map: Map<number, number>) => void;
}

export const NotesEditor: React.FC<Props> = ({
  isRecording,
  notes,
  onNotesChange,
  timestampMap,
  onTimestampMapChange
}) => {
  const textareaRef = useRef<any>(null);
  const timestampColumnRef = useRef<HTMLDivElement>(null);
  const recordingStartTime = useRef<number>(0);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const TIME_OFFSET_MS = 2000;
  const lastLineCountRef = useRef(0);
  const previousNotesRef = useRef('');

  useEffect(() => {
    if (isRecording) {
      recordingStartTime.current = Date.now();
    }
  }, [isRecording]);

  // Sync scroll between timestamp column and textarea
  const handleScroll = () => {
    if (timestampColumnRef.current && textareaRef.current) {
      const textarea = textareaRef.current.resizableTextArea?.textArea;
      if (textarea) {
        timestampColumnRef.current.scrollTop = textarea.scrollTop;
      }
    }
  };

  // Check if user is typing at start of a new line
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const lines = newValue.split('\n');
    const currentLineCount = lines.length;
    const previousLines = previousNotesRef.current.split('\n');

    if (isRecording) {
      // Check each line to see if it just got its first character
      for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];
        const previousLine = previousLines[i] || '';
        
        // Detect: line was empty before, now has content
        if (previousLine.trim().length === 0 && currentLine.trim().length > 0) {
          const lineStartPos = newValue.split('\n').slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
          
          // Check if this line doesn't have a timestamp yet
          if (!timestampMap.has(lineStartPos)) {
            const currentDuration = Date.now() - recordingStartTime.current;
            const adjustedDuration = Math.max(0, currentDuration - TIME_OFFSET_MS);
            
            const newMap = new Map(timestampMap);
            newMap.set(lineStartPos, adjustedDuration);
            onTimestampMapChange(newMap);
            break; // Only create one timestamp per change
          }
        }
      }
    }

    previousNotesRef.current = newValue;
    lastLineCountRef.current = currentLineCount;
    onNotesChange(newValue);
  };

  const handleDoubleClick = () => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current.resizableTextArea.textArea;
    const cursorPos = textarea.selectionStart;

    const timestamp = findNearestTimestamp(cursorPos);
    if (timestamp !== null) {
      window.dispatchEvent(
        new CustomEvent('seek-audio', {
          detail: { time: timestamp / 1000 }
        })
      );
    }
  };

  const findNearestTimestamp = (index: number): number | null => {
    let nearest: number | null = null;
    let minDist = Infinity;

    timestampMap.forEach((time, pos) => {
      const dist = Math.abs(pos - index);
      if (dist < minDist) {
        minDist = dist;
        nearest = time;
      }
    });

    return nearest;
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Build timestamp column content
  const renderTimestampColumn = () => {
    const lines = notes.split('\n');
    const timestampArray = Array.from(timestampMap.entries())
      .sort((a, b) => a[0] - b[0]); // Sort by position

    return lines.map((_, index) => {
      const lineStartPos = notes.split('\n').slice(0, index).join('\n').length + (index > 0 ? 1 : 0);
      const timestampEntry = timestampArray.find(([pos]) => pos === lineStartPos);
      const timeMs = timestampEntry ? timestampEntry[1] : null;

      return (
        <div
          key={index}
          className="timestamp-line"
          style={{
            height: '1.6em',
            lineHeight: '1.6',
            fontSize: '14px',
            color: timeMs !== null ? '#1890ff' : 'transparent',
            fontFamily: 'monospace',
            paddingRight: '8px',
            textAlign: 'right',
            userSelect: 'none'
          }}
        >
          {timeMs !== null && showTimestamps ? formatTime(timeMs) : '\u00A0'}
        </div>
      );
    });
  };

  return (
    <div className="notes-editor-container">
      <div className="editor-header">
        <h3>📝 Notes Editor</h3>
        <div className="editor-controls">
          {isRecording && (
            <span className="recording-hint">
              💡 Type at new line to auto-create timestamp
            </span>
          )}
          <button
            className="toggle-timestamps-btn"
            onClick={() => setShowTimestamps(!showTimestamps)}
            title={showTimestamps ? 'Hide timestamps' : 'Show timestamps'}
          >
            {showTimestamps ? '👁️ Hide Timestamps' : '👁️‍🗨️ Show Timestamps'}
          </button>
        </div>
      </div>
      
      <div style={{ 
        display: 'flex', 
        border: '1px solid #434343',
        borderRadius: '6px',
        overflow: 'hidden',
        backgroundColor: '#1e1e1e'
      }}>
        {/* Timestamp Column */}
        <div
          ref={timestampColumnRef}
          style={{
            width: '100px',
            backgroundColor: '#252526',
            borderRight: '1px solid #434343',
            padding: '4px 8px',
            overflow: 'hidden',
            fontFamily: 'monospace'
          }}
        >
          {renderTimestampColumn()}
        </div>

        {/* Text Editor Column */}
        <div style={{ flex: 1 }}>
          <TextArea
            ref={textareaRef}
            value={notes}
            onChange={handleTextChange}
            onDoubleClick={handleDoubleClick}
            onScroll={handleScroll}
            placeholder="Start typing your notes here...&#10;Timestamps will be added automatically when you type at a new line"
            className="notes-textarea"
            autoSize={{ minRows: 15, maxRows: 30 }}
            style={{
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: '1.6',
              border: 'none',
              backgroundColor: 'transparent',
              resize: 'none'
            }}
          />
        </div>
      </div>
    </div>
  );
};
