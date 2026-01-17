import React, { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

interface Props {
  isRecording: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
  timestampMap: Map<number, number>;
  onTimestampMapChange: (map: Map<number, number>) => void;
}

export const NotesEditor: React.FC<Props> = ({
  isRecording,
  onNotesChange,
  timestampMap,
  onTimestampMapChange
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const recordingStartTime = useRef<number>(0);
  const [showTimestamps, setShowTimestamps] = React.useState(true);
  const newLineStartPos = useRef<number | null>(null);
  const lastTextLength = useRef<number>(0);
  const TIME_OFFSET_MS = 2000; // Bù 2 giây cho thời gian nghe và gõ

  useEffect(() => {
    if (editorRef.current && !quillRef.current) {
      quillRef.current = new Quill(editorRef.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline'],
            ['link'],
            [{ color: [] }, { background: [] }],
            ['clean']
          ]
        },
        placeholder: 'Start typing your notes here...\nPress ENTER during recording to insert timestamp'
      });

      // Listen to text changes
      quillRef.current.on('text-change', (delta: any, _oldDelta: any, source: string) => {
        const currentText = quillRef.current!.getText();
        onNotesChange(currentText);
        
        // Auto-insert timestamp when starting new line during recording
        if (isRecording && source === 'user') {
          handleTextChange(delta);
        }
      });

      // Double-click to seek
      editorRef.current.addEventListener('dblclick', handleDoubleClick);
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener('dblclick', handleDoubleClick);
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      recordingStartTime.current = Date.now();
    }
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      recordingStartTime.current = Date.now();
      lastTextLength.current = quillRef.current?.getText().length || 0;
      newLineStartPos.current = null;
    }
  }, [isRecording]);

  // Detect Enter key to mark new line start
  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && quillRef.current) {
        // Mark that next character will be start of new line
        const selection = quillRef.current.getSelection();
        if (selection) {
          newLineStartPos.current = selection.index + 1;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]);

  const handleTextChange = (_delta: any) => {
    if (!quillRef.current || newLineStartPos.current === null) return;
    
    const currentLength = quillRef.current.getText().length;
    const selection = quillRef.current.getSelection();
    
    // Check if user just typed first character of new line
    if (selection && selection.index === newLineStartPos.current + 1) {
      // Insert timestamp at the start of this new line
      insertTimestampAtPosition(newLineStartPos.current);
      newLineStartPos.current = null; // Reset
    }
    
    lastTextLength.current = currentLength;
  };

  const insertTimestampAtPosition = (position: number) => {
    if (!quillRef.current) return;

    const currentDuration = Date.now() - recordingStartTime.current;
    // Subtract offset to account for listening and typing time
    const adjustedDuration = Math.max(0, currentDuration - TIME_OFFSET_MS);
    const timeStr = formatTime(adjustedDuration);

    // Insert timestamp at the beginning of the line
    quillRef.current.insertText(position, `[${timeStr}] `, {
      color: showTimestamps ? '#4096ff' : 'transparent',
      bold: true
    });

    // Store timestamp mapping
    const newMap = new Map(timestampMap);
    newMap.set(position, adjustedDuration);
    onTimestampMapChange(newMap);
  };

  const handleDoubleClick = (_e: MouseEvent) => {
    if (!quillRef.current) return;

    const selection = quillRef.current.getSelection();
    if (!selection) return;

    const timestamp = findNearestTimestamp(selection.index);
    if (timestamp !== null) {
      // Dispatch event to AudioPlayer component
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
      if (dist < minDist && dist < 20) {
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

  // Update timestamp visibility when toggle changes
  React.useEffect(() => {
    if (!editorRef.current) return;
    
    const editorElement = editorRef.current.querySelector('.ql-editor');
    if (!editorElement) return;
    
    if (showTimestamps) {
      editorElement.classList.remove('hide-timestamps');
    } else {
      editorElement.classList.add('hide-timestamps');
    }
  }, [showTimestamps]);

  return (
    <div className="notes-editor-container">
      <div className="editor-header">
        <h3>📝 Notes Editor</h3>
        <div className="editor-controls">
          {isRecording && (
            <span className="recording-hint">
              💡 Start typing on new line to insert timestamp
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
      <div ref={editorRef} className="editor" />
    </div>
  );
};
