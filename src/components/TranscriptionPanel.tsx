import React, { useEffect, useRef } from 'react';
import { Card, Empty, Tag, Space, Tooltip } from 'antd';
import { AudioOutlined, ClockCircleOutlined, UserOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { TranscriptionResult } from '../types/types';

interface Props {
  transcriptions: TranscriptionResult[];
  isTranscribing: boolean;
  isOnline: boolean;
}

export const TranscriptionPanel: React.FC<Props> = ({
  transcriptions,
  isTranscribing,
  isOnline
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new transcription arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
    <Card
      title={
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
        </Space>
      }
      style={{ 
        height: '500px',
        display: 'flex',
        flexDirection: 'column'
      }}
      bodyStyle={{
        flex: 1,
        overflow: 'hidden',
        padding: 0
      }}
    >
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
        <div
          ref={scrollRef}
          style={{
            height: '100%',
            overflowY: 'auto',
            padding: '16px'
          }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {transcriptions.map((item, index) => (
              <div
                key={item.id}
                style={{
                  padding: '12px',
                  backgroundColor: item.isFinal ? '#f6ffed' : '#e6f7ff',
                  border: `1px solid ${item.isFinal ? '#b7eb8f' : '#91d5ff'}`,
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

                  {/* Index */}
                  <span style={{ 
                    fontSize: '11px', 
                    color: '#999',
                    fontWeight: 'bold'
                  }}>
                    #{index + 1}
                  </span>
                </div>

                {/* Transcription text */}
                <div
                  style={{
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
              </div>
            ))}
          </Space>
        </div>
      )}

      {/* Status footer */}
      {transcriptions.length > 0 && (
        <div
          style={{
            borderTop: '1px solid #f0f0f0',
            padding: '8px 16px',
            backgroundColor: '#fafafa',
            fontSize: '12px',
            color: '#666',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>
            Tổng số: <strong>{transcriptions.length}</strong> đoạn
          </span>
          <span>
            Hoàn thành: <strong>{transcriptions.filter(t => t.isFinal).length}</strong> đoạn
          </span>
        </div>
      )}
    </Card>
  );
};
