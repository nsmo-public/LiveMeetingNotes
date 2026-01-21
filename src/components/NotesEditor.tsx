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
  onSpeakersChange?: (speakers: Map<number, string>) => void; // Callback to sync speaker data
  initialSpeakers?: Map<number, string>; // Initial speakers data when loading project
}

export const NotesEditor: React.FC<Props> = ({
  notes,
  onNotesChange,
  timestampMap,
  onTimestampMapChange,
  recordingStartTime,
  isLiveMode = true,
  onSpeakersChange,
  initialSpeakers
}) => {
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [editingDatetimeIndex, setEditingDatetimeIndex] = useState<number | null>(null);
  const [editingDatetimeValue, setEditingDatetimeValue] = useState<string>('');
  
  // Timestamp delay setting (in seconds) - người gõ note thường chậm hơn người nói
  const [timestampDelay, setTimestampDelay] = useState<number>(() => {
    const saved = localStorage.getItem('timestampDelay');
    return saved ? parseInt(saved, 10) : 10; // Mặc định 10 giây
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Multi-line selection states
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [lastClickedLine, setLastClickedLine] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Undo/Redo history
  const [history, setHistory] = useState<Array<{ notes: string; timestamps: Map<number, number> }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedNotesRef = useRef<string>('');
  
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
  
  // Speaker names for each line (lineIndex → speakerName)
  const [lineSpeakers, setLineSpeakers] = useState<Map<number, string>>(() => {
    // Initialize from initialSpeakers if provided (when loading project)
    if (initialSpeakers && initialSpeakers.size > 0) {
      return new Map(initialSpeakers);
    }
    // Otherwise try to restore from localStorage
    const saved = localStorage.getItem('lineSpeakers');
    return saved ? new Map(JSON.parse(saved)) : new Map();
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
  
  // Save lineSpeakers to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('lineSpeakers', JSON.stringify(Array.from(lineSpeakers.entries())));
    // Notify parent component
    if (onSpeakersChange) {
      onSpeakersChange(lineSpeakers);
    }
  }, [lineSpeakers, onSpeakersChange]);

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
  
  // Handle line mouse down for selection (drag start)
  const handleLineMouseDown = (index: number, event: React.MouseEvent) => {
    // Don't interfere with text selection inside textarea (unless Ctrl/Shift is pressed)
    if ((event.target as HTMLElement).tagName === 'TEXTAREA' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      // Clear selection on normal click
      setSelectedLines(new Set());
      return;
    }
    
    if (event.shiftKey && lastClickedLine !== null) {
      // Shift+Click: Select range
      event.preventDefault();
      // Blur any focused textarea to allow Delete/Backspace to work on selected lines
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const start = Math.min(lastClickedLine, index);
      const end = Math.max(lastClickedLine, index);
      const newSelected = new Set<number>();
      for (let i = start; i <= end; i++) {
        newSelected.add(i);
      }
      setSelectedLines(newSelected);
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl+Click: Toggle selection
      event.preventDefault();
      // Blur any focused textarea to allow Delete/Backspace to work on selected lines
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const newSelected = new Set(selectedLines);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      setSelectedLines(newSelected);
      setLastClickedLine(index);
    } else {
      // Normal mouse down: Start drag selection (only if not clicking inside textarea)
      if ((event.target as HTMLElement).tagName !== 'TEXTAREA') {
        setIsDragging(true);
        const newSelected = new Set<number>();
        newSelected.add(index);
        setSelectedLines(newSelected);
        setLastClickedLine(index);
      }
    }
  };
  
  // Handle line mouse enter during drag
  const handleLineMouseEnter = (index: number) => {
    if (isDragging) {
      const newSelected = new Set(selectedLines);
      newSelected.add(index);
      setSelectedLines(newSelected);
    }
  };
  
  // Handle delete selected lines
  const handleDeleteSelected = () => {
    if (selectedLines.size === 0) return;
    
    saveToHistory();
    
    const lines = notes.split(BLOCK_SEPARATOR);
    const indicesToDelete = Array.from(selectedLines).sort((a, b) => b - a); // Delete from end to start
    
    indicesToDelete.forEach(idx => {
      lines.splice(idx, 1);
    });
    
    // Update timestamps
    const newLineTimestamps = new Map<number, number>();
    const deletedSet = new Set(indicesToDelete);
    let offset = 0;
    
    lineTimestamps.forEach((time, lineIndex) => {
      if (deletedSet.has(lineIndex)) {
        offset++;
      } else {
        const newIndex = lineIndex - offset;
        newLineTimestamps.set(newIndex, time);
      }
    });
    
    setLineTimestamps(newLineTimestamps);
    setSelectedLines(new Set());
    onNotesChange(lines.join(BLOCK_SEPARATOR));
    syncToParentTimestampMap(lines, newLineTimestamps);
  };
  
  // Handle copy selected lines
  const handleCopySelected = () => {
    if (selectedLines.size === 0) return;
    
    const lines = notes.split(BLOCK_SEPARATOR);
    const selectedIndices = Array.from(selectedLines).sort((a, b) => a - b);
    const textToCopy = selectedIndices.map(idx => lines[idx]).join('\n');
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      console.log('📋 Copied selected lines to clipboard');
    });
  };
  
  // Global mouse up handler to end drag selection
  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging]);
  
  // Global keyboard handler
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z: Undo (works even when textarea is focused)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (historyIndex > 0) {
          e.preventDefault();
          const prevState = history[historyIndex - 1];
          setHistoryIndex(historyIndex - 1);
          onNotesChange(prevState.notes);
          setLineTimestamps(new Map(prevState.timestamps));
          const lines = prevState.notes.split(BLOCK_SEPARATOR);
          syncToParentTimestampMap(lines, prevState.timestamps);
          // Clear selection after undo
          setSelectedLines(new Set());
        }
      }
      // Ctrl+Shift+Z or Ctrl+Y: Redo (works even when textarea is focused)
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        if (historyIndex < history.length - 1) {
          e.preventDefault();
          const nextState = history[historyIndex + 1];
          setHistoryIndex(historyIndex + 1);
          onNotesChange(nextState.notes);
          setLineTimestamps(new Map(nextState.timestamps));
          const lines = nextState.notes.split(BLOCK_SEPARATOR);
          syncToParentTimestampMap(lines, nextState.timestamps);
          // Clear selection after redo
          setSelectedLines(new Set());
        }
      }
      // Ctrl+C: Copy selected lines
      else if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedLines.size > 0) {
        // Only handle if not inside textarea (let textarea handle its own copy)
        if (document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          handleCopySelected();
        }
      }
      // Delete or Backspace: Delete selected lines
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLines.size > 0) {
        // Only handle if not inside textarea
        if (document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [history, historyIndex, selectedLines, notes, lineTimestamps]);

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
        // Save datetime with delay offset (người gõ note thường chậm hơn người nói)
        const currentDatetime = Date.now() - (timestampDelay * 1000);
        
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
    debouncedSaveToHistory(); // Auto-save after typing
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
  
  // Save current state to history
  const saveToHistory = () => {
    // Don't save if no actual changes
    if (notes === lastSavedNotesRef.current) {
      return;
    }
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      notes: notes,
      timestamps: new Map(lineTimestamps)
    });
    // Limit history to 50 entries
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      setHistoryIndex(historyIndex + 1);
    }
    setHistory(newHistory);
    lastSavedNotesRef.current = notes;
  };
  
  // Debounced auto-save to history (for typing)
  const debouncedSaveToHistory = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveToHistory();
    }, 1000); // Save after 1 second of inactivity
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const BLOCK_SEPARATOR = '§§§';
    const lines = notes.split(BLOCK_SEPARATOR);
    const currentLine = lines[index];
    const target = e.target as HTMLTextAreaElement;
    const cursorPos = target.selectionStart;

    // ArrowUp: Move to previous textarea if cursor at beginning
    if (e.key === 'ArrowUp' && cursorPos === 0 && index > 0) {
      e.preventDefault();
      const prevInput = containerRef.current?.querySelectorAll('textarea')[index - 1] as HTMLTextAreaElement;
      if (prevInput) {
        prevInput.focus();
        prevInput.setSelectionRange(prevInput.value.length, prevInput.value.length);
      }
      return;
    }

    // ArrowDown: Move to next textarea if cursor at end
    if (e.key === 'ArrowDown' && cursorPos === currentLine.length && index < lines.length - 1) {
      e.preventDefault();
      const nextInput = containerRef.current?.querySelectorAll('textarea')[index + 1] as HTMLTextAreaElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(0, 0);
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      // In Loaded Mode: Let Enter behave like Shift+Enter (newline within the same textarea)
      if (!isLiveMode) {
        // Don't preventDefault - let textarea handle Enter naturally (creates newline in text)
        return;
      }
      
      // In Live Mode: Enter creates new line (new block) with timestamp
      e.preventDefault();
      
      // Save to history before creating new line
      saveToHistory();
      
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
      
      // Don't auto-assign timestamp to new line
      // Timestamp will be created when user types first character (in handleLineChange)
      
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
      
      // Save to history before merge/delete
      saveToHistory();
      
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
          {isLiveMode && (
            <div className="timestamp-delay-control" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px' }}>
              <label htmlFor="timestamp-delay" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                ⏱️ Delay:
              </label>
              <input
                id="timestamp-delay"
                type="number"
                min="0"
                max="60"
                value={timestampDelay}
                onChange={(e) => {
                  const value = Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0));
                  setTimestampDelay(value);
                  localStorage.setItem('timestampDelay', value.toString());
                }}
                style={{
                  width: '50px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  border: '1px solid #434343',
                  borderRadius: '4px',
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4'
                }}
                title="Timestamp sẽ lùi lại bao nhiêu giây (người gõ note thường chậm hơn người nói)"
              />
              <span style={{ fontSize: '12px' }}>giây</span>
            </div>
          )}
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
        const isSelected = selectedLines.has(index);
          return (
            <div
              key={index}
              onMouseDown={(e) => handleLineMouseDown(index, e)}
              onMouseEnter={() => handleLineMouseEnter(index)}
              style={{
                display: 'flex',
                borderBottom: index < lines.length - 1 ? '1px solid #2d2d2d' : 'none',
                backgroundColor: isSelected ? 'rgba(24, 144, 255, 0.15)' : 'transparent',
                outline: isSelected ? '2px solid rgba(24, 144, 255, 0.5)' : 'none',
                outlineOffset: '-2px',
                userSelect: 'none' // Prevent text selection during drag
              }}
            >
              {/* Timestamp Column */}
              <div
                onClick={() => editingDatetimeIndex !== index && timeMs !== undefined && isLiveMode && handleDatetimeClick(index)}
                onDoubleClick={(e) => timeMs !== undefined && handleDatetimeDoubleClick(e, index)}
                style={{
                  width: isLiveMode ? '160px' : '90px',
                  backgroundColor: isSelected ? 'rgba(37, 37, 38, 0.8)' : '#252526',
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

              {/* Speaker Name Input */}
              <div
                style={{
                  width: '120px',
                  backgroundColor: isSelected ? 'rgba(37, 37, 38, 0.8)' : '#2d2d30',
                  borderRight: '1px solid #434343',
                  padding: '4px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                  paddingTop: '8px'
                }}
              >
                <Input
                  value={lineSpeakers.get(index) || ''}
                  onChange={(e) => {
                    const newSpeakers = new Map(lineSpeakers);
                    if (e.target.value) {
                      newSpeakers.set(index, e.target.value);
                    } else {
                      newSpeakers.delete(index);
                    }
                    setLineSpeakers(newSpeakers);
                  }}
                  placeholder="Người nói"
                  size="small"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    padding: '2px 6px',
                    width: '100%',
                    backgroundColor: '#1e1e1e',
                    color: '#4ec9b0',
                    border: '1px solid #3e3e42',
                    borderRadius: '3px'
                  }}
                />
              </div>

              {/* Text Input */}
              <TextArea
                value={line}
                onChange={(e) => handleLineChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onMouseDown={(e) => {
                  // If Ctrl or Shift is pressed, prevent focus and let parent handle selection
                  if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    e.preventDefault();
                  }
                }}
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
                  backgroundColor: isSelected ? 'rgba(30, 30, 30, 0.9)' : 'transparent',
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
