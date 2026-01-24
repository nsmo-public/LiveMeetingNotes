import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, Button, Space, App } from 'antd';
import { SettingOutlined, SaveOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { SpeechToTextConfig } from '../types/types';
import { SpeechToTextService } from '../services/speechToText';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (config: SpeechToTextConfig) => void;
  currentConfig: SpeechToTextConfig | null;
}

export const TranscriptionConfig: React.FC<Props> = ({
  visible,
  onClose,
  onSave,
  currentConfig
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [isSaving, setIsSaving] = useState(false);

  // Load saved config or set defaults
  useEffect(() => {
    if (visible) {
      const savedConfig = currentConfig || SpeechToTextService.loadConfig();
      if (savedConfig) {
        form.setFieldsValue(savedConfig);
      } else {
        // Set default values
        form.setFieldsValue({
          apiKey: '',
          apiEndpoint: 'https://speech.googleapis.com/v1/speech:recognize',
          languageCode: 'vi-VN',
          enableSpeakerDiarization: false,
          enableAutomaticPunctuation: false
        });
      }
    }
  }, [visible, currentConfig, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setIsSaving(true);

      const config: SpeechToTextConfig = {
        apiKey: values.apiKey?.trim() || '',
        apiEndpoint: values.apiEndpoint.trim(),
        languageCode: values.languageCode,
        enableSpeakerDiarization: values.enableSpeakerDiarization,
        enableAutomaticPunctuation: values.enableAutomaticPunctuation
      };

      // Validate: Speaker diarization requires API Key
      if (config.enableSpeakerDiarization && !config.apiKey) {
        message.error('⚠️ Nhận diện người nói yêu cầu Google Cloud API Key');
        setIsSaving(false);
        return;
      }
      if (config.enableAutomaticPunctuation && !config.apiKey) {
        message.error('⚠️ Tự động thêm dấu câu yêu cầu Google Cloud API Key');
        setIsSaving(false);
        return;
      }

      // Save to localStorage
      SpeechToTextService.saveConfig(config);

      // Notify parent
      onSave(config);

      message.success('✅ Cấu hình đã được lưu thành công');
      onClose();
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearConfig = () => {
    Modal.confirm({
      title: 'Xóa cấu hình?',
      content: 'Bạn có chắc chắn muốn xóa cấu hình Speech-to-Text?',
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => {
        SpeechToTextService.clearConfig();
        form.resetFields();
        message.info('🗑️ Đã xóa cấu hình');
      }
    });
  };

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined />
          <span>Cấu hình Speech-to-Text</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="clear" danger icon={<DeleteOutlined />} onClick={handleClearConfig}>
          Xóa cấu hình
        </Button>,
        <Button key="cancel" onClick={onClose}>
          Hủy
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          loading={isSaving}
          onClick={handleSave}
        >
          Lưu cấu hình
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        <Form.Item
          label="API Key (Tùy chọn)"
          name="apiKey"
          rules={[
            { min: 20, message: 'API Key phải có ít nhất 20 ký tự' }
          ]}
          extra={
            <Space direction="vertical" size="small" style={{ marginTop: 8 }}>
              <div style={{ fontSize: '12px', color: '#52c41a' }}>
                ℹ️ <strong>Không bắt buộc:</strong> Nếu để trống, sẽ dùng Web Speech API miễn phí của trình duyệt
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>
                <InfoCircleOutlined /> Chỉ cần nhập nếu muốn:
                <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                  <li>Nhận diện người nói (speaker diarization)</li>
                  <li>Độ chính xác cao hơn với Google Cloud</li>
                </ul>
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>
                Lấy API Key từ{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Cloud Console
                </a>
              </div>
              <div style={{ fontSize: '12px', color: '#ff9800' }}>
                ⚠️ API Key sẽ được lưu trên trình duyệt. Không chia sẻ với người khác.
              </div>
            </Space>
          }
        >
          <Input.Password
            placeholder="Để trống để dùng Web Speech API miễn phí"
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          label="API Endpoint"
          name="apiEndpoint"
          rules={[
            { required: true, message: 'Vui lòng nhập API Endpoint' },
            { type: 'url', message: 'Vui lòng nhập URL hợp lệ' }
          ]}
          extra="URL của Google Cloud Speech-to-Text API"
        >
          <Input placeholder="https://speech.googleapis.com/v1/speech:recognize" />
        </Form.Item>

        <Form.Item
          label="Ngôn ngữ"
          name="languageCode"
          rules={[{ required: true, message: 'Vui lòng chọn ngôn ngữ' }]}
          extra="Ngôn ngữ sử dụng cho nhận dạng giọng nói"
        >
          <Select>
            <Select.Option value="vi-VN">🇻🇳 Tiếng Việt (Vietnam)</Select.Option>
            <Select.Option value="en-US">🇺🇸 English (US)</Select.Option>
            <Select.Option value="en-GB">🇬🇧 English (UK)</Select.Option>
            <Select.Option value="ja-JP">🇯🇵 日本語 (Japanese)</Select.Option>
            <Select.Option value="ko-KR">🇰🇷 한국어 (Korean)</Select.Option>
            <Select.Option value="zh-CN">🇨🇳 中文 (Chinese Simplified)</Select.Option>
            <Select.Option value="zh-TW">🇹🇼 中文 (Chinese Traditional)</Select.Option>
            <Select.Option value="fr-FR">🇫🇷 Français (French)</Select.Option>
            <Select.Option value="de-DE">🇩🇪 Deutsch (German)</Select.Option>
            <Select.Option value="es-ES">🇪🇸 Español (Spanish)</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Nhận diện người nói"
          name="enableSpeakerDiarization"
          valuePropName="checked"
          extra={
            <div>
              <div style={{ marginTop: 4 }}>Tự động phân biệt và gán nhãn cho từng người nói trong cuộc họp</div>
              <div style={{ marginTop: 4, color: '#ff9800', fontSize: '12px' }}>
                ⚠️ Chức năng này chỉ khả dụng với Google Cloud API (có phí). Sẽ không sử dụng Web Speech API miễn phí.
              </div>
            </div>
          }
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label="Tự động thêm dấu câu"
          name="enableAutomaticPunctuation"
          valuePropName="unchecked"
          extra="Tự động thêm dấu chấm, phấy, hỏi,... vào văn bản"
        >
          <Switch />
        </Form.Item>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            backgroundColor: '#19041b',
            borderLeft: '4px solid #1890ff',
            borderRadius: 4
          }}
        >
          <h4 style={{ marginTop: 0, color: '#1890ff' }}>📌 Hai chế độ hoạt động:</h4>
          <div style={{ marginBottom: 16 }}>
            <strong style={{ color: '#52c41a' }}>🆓 Web Speech API (Miễn phí - Mặc định)</strong>
            <ul style={{ marginBottom: 0, paddingLeft: 20, fontSize: '13px' }}>
              <li>Không cần API Key</li>
              <li>Chạy trên trình duyệt Chrome/Edge</li>
              <li>Miễn phí 100%</li>
              <li><strong style={{ color: '#ff4d4f' }}>Không</strong> hỗ trợ nhận diện người nói</li>
            </ul>
          </div>
          <div>
            <strong style={{ color: '#1890ff' }}>💰 Google Cloud API (Có phí - Nâng cao)</strong>
            <ul style={{ marginBottom: 0, paddingLeft: 20, fontSize: '13px' }}>
              <li>Cần API Key từ <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
              <li>Độ chính xác cao hơn</li>
              <li>Hỗ trợ nhận diện người nói (speaker diarization)</li>
              <li>Chi phí: ~$0.006/15 giây audio (theo biểu giá của Google Cloud)</li>
            </ul>
          </div>
        </div>
      </Form>
    </Modal>
  );
};
