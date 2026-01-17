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
      quillRef.current.on('text-change', () => {
        onNotesChange(quillRef.current!.getText());
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
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && quillRef.current) {
        e.preventDefault();
        insertTimestamp();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]);

  const insertTimestamp = () => {
    if (!quillRef.current) return;

    const duration = Date.now() - recordingStartTime.current;
    const timeStr = formatTime(duration);
    const range = quillRef.current.getSelection(true);

    // Check if range is valid
    if (!range) return;

    // Insert timestamp with blue color and bold
    quillRef.current.insertText(range.index, `[${timeStr}] `, {
      color: '#4096ff',
      bold: true
    });

    // Store timestamp mapping
    const newMap = new Map(timestampMap);
    newMap.set(range.index, duration);
    onTimestampMapChange(newMap);

    // Add newline after timestamp
    quillRef.current.insertText(range.index + timeStr.length + 3, '\n');

    // Move cursor to next line
    quillRef.current.setSelection(range.index + timeStr.length + 4, 0);
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

  return (
    <div className="notes-editor-container">
      <div className="editor-header">
        <h3>📝 Notes Editor</h3>
        {isRecording && (
          <span className="recording-hint">
            💡 Press ENTER to insert timestamp
          </span>
        )}
      </div>
      <div ref={editorRef} className="editor" />
    </div>
  );
};
