import React, { useEffect, useRef, useState } from 'react';
import { Input } from 'antd';

const { TextArea } = Input;

interface Props {
  isRecording: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
  timestampMap: Map<number, number>;
  onTimestampMapChange: (map: Map<number, number>) => void;
  recordingStartTime: number;
}

export const NotesEditor: React.FC<Props> = ({
  isRecording,
  notes,
  onNotesChange,
  timestampMap,
  onTimestampMapChange,
  recordingStartTime
}) => {
  const [showTimestamps, setShowTimestamps] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use line-index-based timestamps (lineIndex → timeMs)
  const [lineTimestamps, setLineTimestamps] = useState<Map<number, number>>(new Map());
  
  // Sync with parent's position-based timestampMap (for compatibility)
  useEffect(() => {
    const newLineTimestamps = new Map<number, number>();
    const lines = notes.split('\n');
    
    timestampMap.forEach((time, position) => {
      let currentPos = 0;
      for (let i = 0; i < lines.length; i++) {
        const lineEnd = currentPos + lines[i].length;
        if (position >= currentPos && position <= lineEnd + 1) {
          newLineTimestamps.set(i, time);
          break;
        }
        currentPos = lineEnd + 1;
      }
    });
    
    setLineTimestamps(newLineTimestamps);
  }, [timestampMap, notes]);

  const formatDatetime = (datetimeMs: number): string => {
    const date = new Date(datetimeMs);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const handleLineChange = (index: number, value: string) => {
    const lines = notes.split('\n');
    const oldLine = lines[index];
    
    // If line becomes empty, delete it
    if (value === '' && lines.length > 1) {
      lines.splice(index, 1);
      
      // Remove timestamp for deleted line and shift others
      const newLineTimestamps = new Map<number, number>();
      lineTimestamps.forEach((time, lineIndex) => {
        if (lineIndex < index) {
          newLineTimestamps.set(lineIndex, time);
        } else if (lineIndex > index) {
          newLineTimestamps.set(lineIndex - 1, time);
        }
      });
      setLineTimestamps(newLineTimestamps);
      
      onNotesChange(lines.join('\n'));
      syncToParentTimestampMap(lines, newLineTimestamps);
      return;
    }
    
    // Update line content
    lines[index] = value;
    
    // Auto-create timestamp: when line goes from empty/whitespace to having content
    const oldLineEmpty = oldLine.trim().length === 0;
    const newLineHasContent = value.trim().length > 0;
    
    if (isRecording && oldLineEmpty && newLineHasContent && !lineTimestamps.has(index)) {
      // Save current datetime (not duration)
      const currentDatetime = Date.now();
      
      const newLineTimestamps = new Map(lineTimestamps);
      newLineTimestamps.set(index, currentDatetime);
      setLineTimestamps(newLineTimestamps);
      
      syncToParentTimestampMap(lines, newLineTimestamps);
    }
    
    onNotesChange(lines.join('\n'));
  };
  
  // Convert line-based timestamps to position-based for parent state
  const syncToParentTimestampMap = (lines: string[], lineTimestamps: Map<number, number>) => {
    const newMap = new Map<number, number>();
    lineTimestamps.forEach((time, lineIndex) => {
      const lineStartPos = lines.slice(0, lineIndex).join('\n').length + (lineIndex > 0 ? 1 : 0);
      newMap.set(lineStartPos, time);
    });
    onTimestampMapChange(newMap);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const lines = notes.split('\n');
    const currentLine = lines[index];
    const target = e.target as HTMLTextAreaElement;
    const cursorPos = target.selectionStart;

    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Split current line at cursor
      const beforeCursor = currentLine.substring(0, cursorPos);
      const afterCursor = currentLine.substring(cursorPos);
      
      lines[index] = beforeCursor;
      lines.splice(index + 1, 0, afterCursor);
      
      // Shift timestamps for lines after the split
      const newLineTimestamps = new Map<number, number>();
      lineTimestamps.forEach((time, lineIndex) => {
        if (lineIndex < index + 1) {
          newLineTimestamps.set(lineIndex, time);
        } else {
          newLineTimestamps.set(lineIndex + 1, time);
        }
      });
      setLineTimestamps(newLineTimestamps);
      
      onNotesChange(lines.join('\n'));
      syncToParentTimestampMap(lines, newLineTimestamps);
      
      // Focus next line after React re-renders
      setTimeout(() => {
        const nextInput = containerRef.current?.querySelectorAll('textarea')[index + 1] as HTMLTextAreaElement;
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(0, 0);
        }
      }, 10);
    } else if (e.key === 'Backspace' && cursorPos === 0 && index > 0) {
      // Merge with previous line
      e.preventDefault();
      const prevLine = lines[index - 1];
      const prevLength = prevLine.length;
      
      lines[index - 1] = prevLine + currentLine;
      lines.splice(index, 1);
      
      // Remove timestamp for deleted line and shift others
      const newLineTimestamps = new Map<number, number>();
      lineTimestamps.forEach((time, lineIndex) => {
        if (lineIndex < index) {
          newLineTimestamps.set(lineIndex, time);
        } else if (lineIndex > index) {
          newLineTimestamps.set(lineIndex - 1, time);
        }
      });
      setLineTimestamps(newLineTimestamps);
      
      onNotesChange(lines.join('\n'));
      syncToParentTimestampMap(lines, newLineTimestamps);
      
      // Focus previous line
      setTimeout(() => {
        const prevInput = containerRef.current?.querySelectorAll('textarea')[index - 1] as HTMLTextAreaElement;
        if (prevInput) {
          prevInput.focus();
          prevInput.setSelectionRange(prevLength, prevLength);
        }
      }, 10);
    }
  };

  const handleDoubleClick = (lineIndex: number) => {
    const datetimeMs = lineTimestamps.get(lineIndex);
    if (datetimeMs !== undefined && recordingStartTime > 0) {
      // Convert datetime to relative time from recording start
      const relativeTimeMs = datetimeMs - recordingStartTime;
      window.dispatchEvent(
        new CustomEvent('seek-audio', {
          detail: { time: Math.max(0, relativeTimeMs) / 1000 }
        })
      );
    }
  };

  const lines = notes.split('\n');
  if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
    lines[0] = '';
  }

  return (
    <div className="notes-editor-container">
      <div className="editor-header">
        <h3>📝 Notes Editor</h3>
        <div className="editor-controls">
          {isRecording && (
            <span className="recording-hint">
              💡 Type to auto-create timestamp • Enter for new line
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
      
      <div 
        ref={containerRef}
        style={{ 
          border: '1px solid #434343',
          borderRadius: '6px',
          backgroundColor: '#1e1e1e',
          maxHeight: '500px',
          overflowY: 'auto'
        }}
      >
        {lines.map((line, index) => {
        const timeMs = lineTimestamps.get(index);
          return (
            <div
              key={index}
              style={{
                display: 'flex',
                borderBottom: index < lines.length - 1 ? '1px solid #2d2d2d' : 'none'
              }}
            >
              {/* Timestamp Column */}
              <div
                onClick={() => handleDoubleClick(index)}
                style={{
                  width: '160px',
                  backgroundColor: '#252526',
                  borderRight: '1px solid #434343',
                  padding: '8px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: timeMs !== undefined ? '#1890ff' : 'transparent',
                  textAlign: 'right',
                  cursor: timeMs !== undefined ? 'pointer' : 'default',
                  userSelect: 'none',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                  paddingTop: '8px'
                }}
              >
                {timeMs !== undefined && showTimestamps ? formatDatetime(timeMs) : '\u00A0'}
              </div>

              {/* Text Input */}
              <TextArea
                value={line}
                onChange={(e) => handleLineChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onInput={(e) => {
                  // Handle undo/redo operations
                  const target = e.target as HTMLTextAreaElement;
                  handleLineChange(index, target.value);
                }}
                placeholder={index === 0 ? "Start typing..." : ""}
                autoSize={{ minRows: 1, maxRows: 10 }}
                style={{
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  border: 'none',
                  backgroundColor: 'transparent',
                  resize: 'none',
                  padding: '8px'
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
