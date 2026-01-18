import React, { useRef, useState } from 'react';
import { Input } from 'antd';

const { TextArea } = Input;

interface Props {
  notes: string;
  onNotesChange: (notes: string) => void;
  timestampMap: Map<number, number>;
  onTimestampMapChange: (map: Map<number, number>) => void;
  recordingStartTime: number;
  isLiveMode?: boolean; // true when recording/just recorded, false when loaded from project
}

export const NotesEditor: React.FC<Props> = ({
  notes,
  onNotesChange,
  timestampMap,
  onTimestampMapChange,
  recordingStartTime,
  isLiveMode = true
}) => {
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [editingDatetimeIndex, setEditingDatetimeIndex] = useState<number | null>(null);
  const [editingDatetimeValue, setEditingDatetimeValue] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use line-index-based timestamps (lineIndex → dateTimeMs) as source of truth
  const BLOCK_SEPARATOR = '§§§';
  const [lineTimestamps, setLineTimestamps] = useState<Map<number, number>>(() => {
    // Initialize from parent's timestampMap only once on mount
    const initialLineTimestamps = new Map<number, number>();
    const lines = notes.split(BLOCK_SEPARATOR);
    
    timestampMap.forEach((time, position) => {
      let currentPos = 0;
      for (let i = 0; i < lines.length; i++) {
        const lineStartPos = i === 0 ? 0 : currentPos;
        if (position === lineStartPos) {
          initialLineTimestamps.set(i, time);
          break;
        }
        currentPos += lines[i].length + 1;
      }
    });
    
    return initialLineTimestamps;
  });

  // Sync lineTimestamps when parent timestampMap changes (e.g., when loading project)
  React.useEffect(() => {
    const newLineTimestamps = new Map<number, number>();
    const lines = notes.split(BLOCK_SEPARATOR);
    
    timestampMap.forEach((time, position) => {
      let currentPos = 0;
      for (let i = 0; i < lines.length; i++) {
        const lineStartPos = i === 0 ? 0 : currentPos;
        if (position === lineStartPos) {
          newLineTimestamps.set(i, time);
          break;
        }
        currentPos += lines[i].length + (i < lines.length - 1 ? BLOCK_SEPARATOR.length : 0);
      }
    });
    
    setLineTimestamps(newLineTimestamps);
    console.log('📊 NotesEditor synced lineTimestamps:', {
      timestampMapSize: timestampMap.size,
      lineTimestampsSize: newLineTimestamps.size,
      linesCount: lines.length,
      sampleLineTimestamps: Array.from(newLineTimestamps.entries()).slice(0, 3)
    });
  }, [timestampMap, notes]);

  // Listen for insert-note-at-time event from AudioPlayer
  React.useEffect(() => {
    const handleInsertNote = (event: CustomEvent) => {
      const { time } = event.detail; // time in seconds
      const timestampMs = recordingStartTime + time * 1000;
      
      console.log('📝 Insert note at time:', { time, timestampMs, recordingStartTime });
      
      // Find insertion position based on timestamp order
      const lines = notes.split(BLOCK_SEPARATOR);
      let insertIndex = lines.length; // Default: append at end
      
      // Find the correct position to insert
      const sortedTimestamps = Array.from(lineTimestamps.entries()).sort((a, b) => a[1] - b[1]);
      for (let i = 0; i < sortedTimestamps.length; i++) {
        const [lineIdx, lineTime] = sortedTimestamps[i];
        if (timestampMs < lineTime) {
          insertIndex = lineIdx;
          break;
        }
      }
      
      // Insert new empty line
      lines.splice(insertIndex, 0, '');
      
      // Update lineTimestamps: shift existing and add new
      const newLineTimestamps = new Map<number, number>();
      lineTimestamps.forEach((time, lineIndex) => {
        if (lineIndex < insertIndex) {
          newLineTimestamps.set(lineIndex, time);
        } else {
          newLineTimestamps.set(lineIndex + 1, time);
        }
      });
      newLineTimestamps.set(insertIndex, timestampMs);
      
      setLineTimestamps(newLineTimestamps);
      onNotesChange(lines.join(BLOCK_SEPARATOR));
      syncToParentTimestampMap(lines, newLineTimestamps);
      
      // Focus the new line
      setTimeout(() => {
        const inputs = containerRef.current?.querySelectorAll('textarea');
        const newInput = inputs?.[insertIndex] as HTMLTextAreaElement;
        if (newInput) {
          newInput.focus();
        }
      }, 50);
    };
    
    window.addEventListener('insert-note-at-time', handleInsertNote as EventListener);
    return () => {
      window.removeEventListener('insert-note-at-time', handleInsertNote as EventListener);
    };
  }, [notes, lineTimestamps, recordingStartTime]);

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

  const formatTimestamp = (datetimeMs: number): string => {
    // Format as relative time from recording start (HH:MM:SS)
    if (recordingStartTime === 0) return '00:00:00';
    
    const relativeMs = Math.max(0, datetimeMs - recordingStartTime);
    const totalSeconds = Math.floor(relativeMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const parseDatetime = (dateStr: string): number | null => {
    // Format: yyyy-MM-dd HH:mm:ss
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;
    
    const [, year, month, day, hours, minutes, seconds] = match;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds)
    );
    
    return date.getTime();
  };

  const handleDatetimeClick = (index: number) => {
    const timeMs = lineTimestamps.get(index);
    if (timeMs !== undefined) {
      setEditingDatetimeIndex(index);
      setEditingDatetimeValue(formatDatetime(timeMs));
    }
  };

  const handleDatetimeChange = (value: string) => {
    setEditingDatetimeValue(value);
  };

  const handleDatetimeBlur = () => {
    if (editingDatetimeIndex !== null) {
      const newTimeMs = parseDatetime(editingDatetimeValue);
      if (newTimeMs !== null) {
        const newLineTimestamps = new Map(lineTimestamps);
        newLineTimestamps.set(editingDatetimeIndex, newTimeMs);
        setLineTimestamps(newLineTimestamps);
        
        const lines = notes.split(BLOCK_SEPARATOR);
        syncToParentTimestampMap(lines, newLineTimestamps);
      }
    }
    setEditingDatetimeIndex(null);
    setEditingDatetimeValue('');
  };

  const handleDatetimeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleDatetimeBlur();
    } else if (e.key === 'Escape') {
      setEditingDatetimeIndex(null);
      setEditingDatetimeValue('');
    }
  };

  const handleLineChange = (index: number, value: string) => {
    const BLOCK_SEPARATOR = '§§§';
    const lines = notes.split(BLOCK_SEPARATOR);
    const oldLine = lines[index];
    
    // Don't auto-delete line when it becomes empty
    // Let user explicitly delete via Backspace/Delete keys (handled in handleKeyDown)
    // Just update the content
    lines[index] = value;
    
    // Auto-create timestamp: Only in Live Mode when line goes from empty to having content
    if (isLiveMode) {
      const oldLineEmpty = oldLine.trim().length === 0;
      const newLineHasContent = value.trim().length > 0;
      
      if (oldLineEmpty && newLineHasContent && !lineTimestamps.has(index)) {
        // Save current datetime (when recording or just recorded)
        const currentDatetime = Date.now();
        
        const newLineTimestamps = new Map(lineTimestamps);
        newLineTimestamps.set(index, currentDatetime);
        setLineTimestamps(newLineTimestamps);
        
        onNotesChange(lines.join(BLOCK_SEPARATOR));
        syncToParentTimestampMap(lines, newLineTimestamps);
        return;
      }
    }
    // In Loaded Mode: Never auto-create timestamp, user must use right-click on waveform
    
    // Always sync timestamps when text changes (to update positions)
    onNotesChange(lines.join(BLOCK_SEPARATOR));
    syncToParentTimestampMap(lines, lineTimestamps);
  };
  
  // Convert line-based timestamps to position-based for parent state
  const syncToParentTimestampMap = (lines: string[], lineTimestamps: Map<number, number>) => {
    const BLOCK_SEPARATOR = '§§§';
    const newMap = new Map<number, number>();
    lineTimestamps.forEach((time, lineIndex) => {
      const lineStartPos = lines.slice(0, lineIndex).join(BLOCK_SEPARATOR).length + (lineIndex > 0 ? BLOCK_SEPARATOR.length : 0);
      newMap.set(lineStartPos, time);
    });
    onTimestampMapChange(newMap);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const BLOCK_SEPARATOR = '§§§';
    const lines = notes.split(BLOCK_SEPARATOR);
    const currentLine = lines[index];
    const target = e.target as HTMLTextAreaElement;
    const cursorPos = target.selectionStart;

    if (e.key === 'Enter' && !e.shiftKey) {
      // In Loaded Mode: Let Enter behave like Shift+Enter (newline within the same textarea)
      if (!isLiveMode) {
        // Don't preventDefault - let textarea handle Enter naturally (creates newline in text)
        return;
      }
      
      // In Live Mode: Enter creates new line (new block) with timestamp
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
      
      // Calculate timestamp for new line (index + 1)
      const currentTimestamp = lineTimestamps.get(index);
      const nextTimestamp = lineTimestamps.get(index + 1); // Will be shifted to index + 2
      
      if (currentTimestamp) {
        let newTimestamp: number;
        if (nextTimestamp) {
          // Insert timestamp halfway between current and next
          newTimestamp = currentTimestamp + (nextTimestamp - currentTimestamp) / 2;
        } else {
          // No next timestamp, add 3 seconds
          newTimestamp = currentTimestamp + 3000;
        }
        newLineTimestamps.set(index + 1, newTimestamp);
      } else if (afterCursor.trim().length > 0) {
        // Current line has no timestamp, create one for new line
        newLineTimestamps.set(index + 1, Date.now());
      }
      
      setLineTimestamps(newLineTimestamps);
      
      onNotesChange(lines.join(BLOCK_SEPARATOR));
      syncToParentTimestampMap(lines, newLineTimestamps);
      
      // Focus next line after React re-renders
      setTimeout(() => {
        const nextInput = containerRef.current?.querySelectorAll('textarea')[index + 1] as HTMLTextAreaElement;
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(0, 0);
        }
      }, 10);
    }
    // Shift+Enter: Allow natural newline (browser default behavior)
    // No preventDefault for Shift+Enter - let textarea handle it naturally
    
    if (e.key === 'Backspace' && cursorPos === 0 && index > 0) {
      // Check if user has selected text
      const selectionStart = target.selectionStart;
      const selectionEnd = target.selectionEnd;
      const hasSelection = selectionStart !== selectionEnd;
      
      // If user is selecting text (e.g., select all), let textarea handle it naturally
      // Don't merge lines
      if (hasSelection) {
        return; // Let default behavior handle selection deletion
      }
      
      // Backspace at start with no selection: merge with previous line only if current line is empty
      e.preventDefault();
      
      if (currentLine.trim().length === 0) {
        // Current line is empty, just remove it
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
        
        onNotesChange(lines.join(BLOCK_SEPARATOR));
        syncToParentTimestampMap(lines, newLineTimestamps);
        
        // Focus previous line at end
        setTimeout(() => {
          const prevInput = containerRef.current?.querySelectorAll('textarea')[index - 1] as HTMLTextAreaElement;
          if (prevInput) {
            prevInput.focus();
            prevInput.setSelectionRange(prevInput.value.length, prevInput.value.length);
          }
        }, 10);
      } else {
        // Current line has content, merge with previous
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
        
        onNotesChange(lines.join(BLOCK_SEPARATOR));
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
      return;
    }
    
    // Delete key: delete entire line if it's empty
    if (e.key === 'Delete' && currentLine.trim().length === 0 && lines.length > 1) {
      e.preventDefault();
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
      
      onNotesChange(lines.join(BLOCK_SEPARATOR));
      syncToParentTimestampMap(lines, newLineTimestamps);
      
      // Focus current position (which will now be the next line)
      setTimeout(() => {
        const inputs = containerRef.current?.querySelectorAll('textarea');
        const focusInput = inputs?.[Math.min(index, inputs.length - 1)] as HTMLTextAreaElement;
        if (focusInput) {
          focusInput.focus();
        }
      }, 10);
    }
  };

  const handleDatetimeDoubleClick = (e: React.MouseEvent, lineIndex: number) => {
    e.stopPropagation();
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

  const lines = notes.split(BLOCK_SEPARATOR);
  if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
    lines[0] = '';
  }

  return (
    <div className="notes-editor-container">
      <div className="editor-header">
        <h3>📝 Notes Editor</h3>
        <div className="editor-controls">
          <span className="recording-hint">
            {isLiveMode 
              ? '💡 Type to create datetime • Enter for new line • Shift+Enter for line break'
              : '💡 Right-click waveform to insert note • Enter/Shift+Enter for line break in text'
            }
          </span>
          <button
            className="toggle-timestamps-btn"
            onClick={() => setShowTimestamps(!showTimestamps)}
            title={showTimestamps ? (isLiveMode ? 'Hide DateTimes' : 'Hide TimeStamps') : (isLiveMode ? 'Show DateTimes' : 'Show TimeStamps')}
          >
            {showTimestamps ? (isLiveMode ? '👁️ Hide DateTimes' : '👁️ Hide TimeStamps') : (isLiveMode ? '👁️‍🗨️ Show DateTimes' : '👁️‍🗨️ Show TimeStamps')}
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
                onClick={() => editingDatetimeIndex !== index && timeMs !== undefined && isLiveMode && handleDatetimeClick(index)}
                onDoubleClick={(e) => timeMs !== undefined && handleDatetimeDoubleClick(e, index)}
                style={{
                  width: isLiveMode ? '160px' : '90px',
                  backgroundColor: '#252526',
                  borderRight: '1px solid #434343',
                  padding: '8px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: timeMs !== undefined ? '#1890ff' : 'transparent',
                  textAlign: 'right',
                  cursor: timeMs !== undefined ? 'pointer' : 'default',
                  userSelect: editingDatetimeIndex === index ? 'text' : 'none',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                  paddingTop: '8px'
                }}
                title={timeMs !== undefined ? (isLiveMode ? 'Click to edit • Double-click to jump to audio' : 'Double-click to jump to audio') : ''}
              >
                {editingDatetimeIndex === index && isLiveMode ? (
                  <Input
                    value={editingDatetimeValue}
                    onChange={(e) => handleDatetimeChange(e.target.value)}
                    onBlur={handleDatetimeBlur}
                    onKeyDown={handleDatetimeKeyDown}
                    autoFocus
                    size="small"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      padding: '2px 4px',
                      width: '144px',
                      backgroundColor: '#1e1e1e',
                      color: '#1890ff',
                      border: '1px solid #1890ff'
                    }}
                  />
                ) : (
                  timeMs !== undefined && showTimestamps ? (isLiveMode ? formatDatetime(timeMs) : formatTimestamp(timeMs)) : '\u00A0'
                )}
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
