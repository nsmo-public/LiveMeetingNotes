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
  const recordingStartTime = useRef<number>(0);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const TIME_OFFSET_MS = 2000; // Bù 2 giây cho thời gian nghe và gõ

  useEffect(() => {
    if (isRecording) {
      recordingStartTime.current = Date.now();
    }
  }, [isRecording]);

  // Listen for Enter key during recording
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && isRecording && !e.shiftKey) {
      // Don't prevent default - let Enter create new line naturally
      // Then insert timestamp after the newline
      setTimeout(() => {
        insertTimestampAtCursor();
      }, 10);
    }
  };

  const insertTimestampAtCursor = () => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current.resizableTextArea.textArea;
    const cursorPos = textarea.selectionStart;

    const currentDuration = Date.now() - recordingStartTime.current;
    const adjustedDuration = Math.max(0, currentDuration - TIME_OFFSET_MS);
    const timeStr = formatTime(adjustedDuration);
    const timestampText = `\n[${timeStr}] `;

    // Insert timestamp at cursor position (which is at start of new line after Enter)
    const newText =
      notes.substring(0, cursorPos) +
      timestampText +
      notes.substring(cursorPos);

    onNotesChange(newText);

    // Store timestamp mapping - use position in the ORIGINAL notes before adding timestamp
    const newMap = new Map(timestampMap);
    newMap.set(cursorPos, adjustedDuration);
    onTimestampMapChange(newMap);

    // Move cursor after timestamp
    setTimeout(() => {
      textarea.selectionStart = cursorPos + timestampText.length;
      textarea.selectionEnd = cursorPos + timestampText.length;
      textarea.focus();
    }, 10);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
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
      if (dist < minDist && dist < 50) {
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

  // Render notes with optional timestamp hiding
  const displayNotes = showTimestamps
    ? notes
    : notes.replace(/\[\d{2}:\d{2}:\d{2}\]\s*/g, '');

  return (
    <div className="notes-editor-container">
      <div className="editor-header">
        <h3>📝 Notes Editor</h3>
        <div className="editor-controls">
          {isRecording && (
            <span className="recording-hint">
              💡 Press Enter to insert timestamp at new line
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
      <div style={{ position: 'relative' }}>
        {/* Overlay to show text without timestamps when hidden */}
        {!showTimestamps && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              padding: '4px 11px',
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              pointerEvents: 'none',
              backgroundColor: 'var(--editor-bg, #1e1e1e)',
              color: 'var(--editor-text, #d4d4d4)',
              overflow: 'hidden',
              zIndex: 1
            }}
          >
            {displayNotes}
          </div>
        )}
        <TextArea
          ref={textareaRef}
          value={notes}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onDoubleClick={handleDoubleClick}
          placeholder="Start typing your notes here...&#10;Press ENTER during recording to insert timestamp"
          className="notes-textarea"
          autoSize={{ minRows: 15, maxRows: 30 }}
          style={{
            fontFamily: 'monospace',
            fontSize: '14px',
            lineHeight: '1.6',
            opacity: showTimestamps ? 1 : 0,
            position: 'relative',
            zIndex: 0
          }}
        />
      </div>
    </div>
  );
};
