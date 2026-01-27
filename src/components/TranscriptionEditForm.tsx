import React, { memo } from 'react';
import { Input, Button, Space } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';

interface Props {
  editText: string;
  editSpeaker: string;
  editStartTime: string;
  editAudioTimeMs: number | undefined;
  onTextChange: (value: string) => void;
  onSpeakerChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onAudioTimeChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  formatAudioTime: (ms: number) => string;
  parseAudioTime: (timeStr: string) => number;
}

// Memoized component to prevent re-renders when parent transcriptions change
export const TranscriptionEditForm: React.FC<Props> = memo(({
  editText,
  editSpeaker,
  editStartTime,
  editAudioTimeMs,
  onTextChange,
  onSpeakerChange,
  onStartTimeChange,
  onAudioTimeChange,
  onSave,
  onCancel,
  formatAudioTime
}) => {
  return (
    <div style={{ marginTop: '8px' }}>
      {/* All metadata fields in one row */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '8px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Edit Start Time */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', color: '#666', marginRight: '6px', whiteSpace: 'nowrap' }}>
            Thời điểm:
          </label>
          <Input
            size="small"
            value={editStartTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            placeholder="yyyy-MM-dd HH:mm:ss"
            style={{ width: '170px' }}
          />
        </div>
        
        {/* Edit Timestamp (Audio Time) */}
        {editAudioTimeMs !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', color: '#666', marginRight: '6px', whiteSpace: 'nowrap' }}>
              Vị trí audio:
            </label>
            <Input
              size="small"
              value={formatAudioTime(editAudioTimeMs)}
              onChange={(e) => onAudioTimeChange(e.target.value)}
              placeholder="0:00"
              style={{ width: '80px' }}
            />
          </div>
        )}

        {/* Edit Speaker */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', color: '#666', marginRight: '6px', whiteSpace: 'nowrap' }}>
            Người nói:
          </label>
          <Input
            size="small"
            value={editSpeaker}
            onChange={(e) => onSpeakerChange(e.target.value)}
            placeholder="Người nói 1"
            style={{ width: '120px' }}
          />
        </div>
      </div>
      
      {/* Edit Text */}
      <Input.TextArea
        value={editText}
        onChange={(e) => onTextChange(e.target.value)}
        autoSize={{ minRows: 2, maxRows: 6 }}
        style={{ marginBottom: '8px' }}
      />
      
      {/* Edit actions */}
      <Space size="small">
        <Button
          type="primary"
          size="small"
          icon={<SaveOutlined />}
          onClick={onSave}
        >
          Lưu
        </Button>
        <Button
          size="small"
          icon={<CloseOutlined />}
          onClick={onCancel}
        >
          Hủy
        </Button>
      </Space>
    </div>
  );
});

TranscriptionEditForm.displayName = 'TranscriptionEditForm';
