import React, { useEffect, useRef, useState } from 'react';
import { Collapse, Empty, Tag, Space, Tooltip, Input, Button } from 'antd';
import { AudioOutlined, ClockCircleOutlined, UserOutlined, CheckCircleOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import type { TranscriptionResult } from '../types/types';

interface Props {
  transcriptions: TranscriptionResult[];
  isTranscribing: boolean;
  isOnline: boolean;
  onSeekAudio?: (timeMs: number) => void;
  onEditTranscription?: (id: string, newText: string, newSpeaker: string) => void;
}

export const TranscriptionPanel: React.FC<Props> = ({
  transcriptions,
  isTranscribing,
  isOnline,
  onSeekAudio,
  onEditTranscription
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(300); // Initial height
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editSpeaker, setEditSpeaker] = useState<string>('');

  // Auto-scroll to bottom when new transcription arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions]);

  // Auto-expand height based on content, up to max 500px
  useEffect(() => {
    if (scrollRef.current && transcriptions.length > 0) {
      const scrollHeight = scrollRef.current.scrollHeight;
      const newHeight = Math.min(scrollHeight + 80, 500); // +80 for header/footer, max 500px
      setContentHeight(Math.max(newHeight, 300)); // Minimum 300px
    }
  }, [transcriptions]);

  const formatTime = (isoTime: string): string => {
    const date = new Date(isoTime);
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatAudioTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const handleSeekToTime = (timeMs: number) => {
    if (onSeekAudio) {
      onSeekAudio(timeMs);
    }
  };

  const handleStartEdit = (item: TranscriptionResult) => {
    setEditingId(item.id);
    setEditText(item.text);
    setEditSpeaker(item.speaker);
  };

  const handleSaveEdit = (id: string) => {
    if (onEditTranscription && editText.trim()) {
      onEditTranscription(id, editText.trim(), editSpeaker.trim() || 'Person1');
      setEditingId(null);
      setEditText('');
      setEditSpeaker('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
    setEditSpeaker('');
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return '#52c41a'; // green
    if (confidence >= 0.7) return '#faad14'; // orange
    return '#ff4d4f'; // red
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.9) return 'Cao';
    if (confidence >= 0.7) return 'Trung bình';
    return 'Thấp';
  };

  return (
    <Collapse
      defaultActiveKey={[]}
      items={[
        {
          key: '1',
          label: (
            <Space>
              <AudioOutlined />
              <span>Kết quả chuyển đổi giọng nói sang văn bản</span>
              {isTranscribing && (
                <Tag color="processing" icon={<AudioOutlined />}>
                  Đang nhận dạng...
                </Tag>
              )}
              {!isOnline && (
                <Tag color="default">Offline</Tag>
              )}
              {transcriptions.length > 0 && (
                <Tag color="blue">{transcriptions.length} đoạn</Tag>
              )}
            </Space>
          ),
          children: (
            <div style={{ 
              height: `${contentHeight}px`,
              display: 'flex',
              flexDirection: 'column',
              transition: 'height 0.3s ease'
            }}>
              {transcriptions.length === 0 ? (
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  padding: '24px'
                }}>
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      isTranscribing
                        ? 'Đang chờ kết quả chuyển đổi...'
                        : 'Chưa có dữ liệu chuyển đổi. Bật chế độ ghi âm và Auto Transcribe để bắt đầu.'
                    }
                  />
                </div>
              ) : (
                <>
                  <div
                    ref={scrollRef}
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '16px'
                    }}
                  >
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      {transcriptions.map((item, index) => {
                        const isEditing = editingId === item.id;
                        
                        return (
                        <div
                          key={item.id}
                          style={{
                            padding: '12px',
                            backgroundColor: item.isFinal ? (item.isManuallyEdited ? '#fff7e6' : '#f6ffed') : '#e6f7ff',
                            border: `1px solid ${item.isFinal ? (item.isManuallyEdited ? '#ffa940' : '#b7eb8f') : '#91d5ff'}`,
                            borderRadius: '8px',
                            position: 'relative'
                          }}
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
                                    onDoubleClick={() => handleSeekToTime(item.audioTimeMs!)}
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
                                    onClick={() => handleStartEdit(item)}
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
                            </Space>
                          </div>

                          {/* Editable content */}
                          {isEditing ? (
                            <div style={{ marginTop: '8px' }}>
                              {/* Edit Speaker */}
                              <div style={{ marginBottom: '8px' }}>
                                <label style={{ fontSize: '12px', color: '#666', marginRight: '8px' }}>
                                  Người nói:
                                </label>
                                <Input
                                  size="small"
                                  value={editSpeaker}
                                  onChange={(e) => setEditSpeaker(e.target.value)}
                                  placeholder="Person1"
                                  style={{ width: '150px' }}
                                />
                              </div>
                              
                              {/* Edit Text */}
                              <Input.TextArea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                autoSize={{ minRows: 2, maxRows: 6 }}
                                style={{ marginBottom: '8px' }}
                              />
                              
                              {/* Edit actions */}
                              <Space size="small">
                                <Button
                                  type="primary"
                                  size="small"
                                  icon={<SaveOutlined />}
                                  onClick={() => handleSaveEdit(item.id)}
                                >
                                  Lưu
                                </Button>
                                <Button
                                  size="small"
                                  icon={<CloseOutlined />}
                                  onClick={handleCancelEdit}
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
                      })}
                    </Space>
                  </div>
                </>
              )}
            </div>
          )
        }
      ]}
    />
  );
};
