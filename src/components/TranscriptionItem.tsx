import React, { memo } from 'react';
import { Tag, Space, Tooltip, Button, Input } from 'antd';
import { ClockCircleOutlined, UserOutlined, CheckCircleOutlined, EditOutlined, SaveOutlined, CloseOutlined, RobotOutlined } from '@ant-design/icons';
import type { TranscriptionResult } from '../types/types';

interface Props {
  item: TranscriptionResult;
  index: number;
  isEditing: boolean;
  editText: string;
  editSpeaker: string;
  editStartTime: string;
  editAudioTimeMs: number | undefined;
  isComposingRef: React.MutableRefObject<boolean>;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onTextChange: (value: string) => void;
  onSpeakerChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onAudioTimeChange: (value: string) => void;
  onSeekToTime: (timeMs: number) => void;
  onDoubleClick: () => void;
  formatTime: (isoTime: string) => string;
  formatAudioTime: (ms: number) => string;
  parseAudioTime: (timeStr: string) => number;
  getConfidenceColor: (confidence: number) => string;
  getConfidenceLabel: (confidence: number) => string;
}

const TranscriptionItemComponent: React.FC<Props> = ({
  item,
  index,
  isEditing,
  editText,
  editSpeaker,
  editStartTime,
  editAudioTimeMs,
  isComposingRef,
  onStartEdit,
  onSave,
  onCancel,
  onTextChange,
  onSpeakerChange,
  onStartTimeChange,
  onAudioTimeChange,
  onSeekToTime,
  onDoubleClick,
  formatTime,
  formatAudioTime,
  parseAudioTime,
  getConfidenceColor,
  getConfidenceLabel
}) => {
  return (
    <div
      style={{
        padding: '12px',
        backgroundColor: item.isFinal ? (item.isManuallyEdited ? '#fff7e6' : '#f6ffed') : '#e6f7ff',
        border: `1px solid ${item.isFinal ? (item.isManuallyEdited ? '#ffa940' : '#b7eb8f') : '#91d5ff'}`,
        borderRadius: '8px',
        position: 'relative',
        cursor: item.isFinal && !isEditing ? 'pointer' : 'default'
      }}
      onDoubleClick={onDoubleClick}
      title={item.isFinal ? "Double-click để chỉnh sửa" : ""}
    >
      {/* Header with metadata */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          fontSize: '12px',
          color: '#666'
        }}
      >
        <Space size="small">
          {/* Time */}
          <Tooltip title="Thời gian">
            <Tag icon={<ClockCircleOutlined />} color="blue" style={{ fontSize: '11px' }}>
              {formatTime(item.startTime)}
            </Tag>
          </Tooltip>

          {/* Audio Time - Clickable */}
          {item.audioTimeMs !== undefined && (
            <Tooltip title="Double click để tua đến vị trí này trên audio">
              <Tag 
                color="cyan" 
                style={{ 
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '11px'
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onSeekToTime(item.audioTimeMs!);
                }}
              >
                📍 {formatAudioTime(item.audioTimeMs)}
              </Tag>
            </Tooltip>
          )}

          {/* Speaker */}
          {item.speaker && (
            <Tooltip title="Người nói">
              <Tag icon={<UserOutlined />} color="purple" style={{ fontSize: '11px' }}>
                {item.speaker}
              </Tag>
            </Tooltip>
          )}

          {/* AI Refined Label */}
          {item.isAIRefined && (
            <Tooltip title="Đoạn văn bản được xử lý bởi Gemini AI">
              <Tag 
                icon={<RobotOutlined />} 
                style={{ 
                  fontSize: '11px',
                  background: 'linear-gradient(135deg, #667eea22 0%, #764ba222 100%)',
                  borderColor: '#667eea',
                  color: '#667eea'
                }}
              >
                AI
              </Tag>
            </Tooltip>
          )}

          {/* Confidence */}
          {item.confidence > 0 && (
            <Tooltip title={`Độ tin cậy: ${(item.confidence * 100).toFixed(0)}%`}>
              <Tag 
                color={getConfidenceColor(item.confidence)}
                style={{ fontSize: '11px' }}
              >
                {getConfidenceLabel(item.confidence)}
              </Tag>
            </Tooltip>
          )}

          {/* Final status */}
          {item.isFinal && (
            <Tooltip title="Kết quả cuối cùng">
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            </Tooltip>
          )}
        </Space>

        {/* Index and Edit button */}
        <Space size="small">
          <span style={{ 
            fontSize: '11px', 
            color: '#999',
            fontWeight: 'bold'
          }}>
            #{index + 1}
          </span>
          
          {/* Edit button - only for final results */}
          {item.isFinal && !isEditing && (
            <Tooltip title="Sửa nội dung">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={onStartEdit}
                style={{ padding: '0 4px', height: 'auto' }}
              />
            </Tooltip>
          )}
          
          {/* Manual edit indicator */}
          {item.isManuallyEdited && (
            <Tooltip title="Đã chỉnh sửa thủ công">
              <Tag color="orange" style={{ fontSize: '10px', margin: 0 }}>
                ✏️ Edited
              </Tag>
            </Tooltip>
          )}
          
          {/* AI refined indicator */}
          {item.isAIRefined && (
            <Tooltip title="Đã chuẩn hóa bằng AI ✨">
              <Tag color="purple" style={{ fontSize: '10px', margin: 0 }}>
                🤖 AI
              </Tag>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* Editable content */}
      {isEditing ? (
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
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={() => { isComposingRef.current = false; }}
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
                  onCompositionStart={() => { isComposingRef.current = true; }}
                  onCompositionEnd={() => { isComposingRef.current = false; }}
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
              <Input.TextArea
                value={editSpeaker}
                onChange={(e) => onSpeakerChange(e.target.value)}
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={() => { isComposingRef.current = false; }}
                placeholder="Người nói 1"
                autoSize={{ minRows: 1, maxRows: 2 }}
                style={{ width: '120px' }}
              />
            </div>
          </div>
          
          {/* Edit Text */}
          <Input.TextArea
            value={editText}
            onChange={(e) => onTextChange(e.target.value)}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
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
      ) : (
        <>
          {/* Transcription text */}
          <div
            style={{
              marginTop: '8px',
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#262626',
              wordWrap: 'break-word',
              fontStyle: item.isFinal ? 'normal' : 'italic',
              fontWeight: item.isFinal ? 'normal' : '300'
            }}
          >
            {item.text}
          </div>

          {/* Draft indicator - only for interim results */}
          {!item.isFinal && (
            <div
              style={{
                marginTop: '8px',
                fontSize: '11px',
                color: '#1890ff',
                fontStyle: 'italic'
              }}
            >
              ⏳ Đang nhận dạng...
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Memoize to prevent re-renders when other items change
export const TranscriptionItem = memo(TranscriptionItemComponent, (prevProps, nextProps) => {
  // Only re-render if this specific item changed or editing state changed
  return prevProps.item.id === nextProps.item.id &&
         prevProps.item.text === nextProps.item.text &&
         prevProps.item.speaker === nextProps.item.speaker &&
         prevProps.item.startTime === nextProps.item.startTime &&
         prevProps.item.audioTimeMs === nextProps.item.audioTimeMs &&
         prevProps.item.isManuallyEdited === nextProps.item.isManuallyEdited &&
         prevProps.item.isAIRefined === nextProps.item.isAIRefined &&
         prevProps.isEditing === nextProps.isEditing &&
         prevProps.editText === nextProps.editText &&
         prevProps.editSpeaker === nextProps.editSpeaker &&
         prevProps.editStartTime === nextProps.editStartTime &&
         prevProps.editAudioTimeMs === nextProps.editAudioTimeMs;
});
