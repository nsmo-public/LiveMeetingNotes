import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, Button, message, Space } from 'antd';
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
          enableAutomaticPunctuation: true
        });
      }
    }
  }, [visible, currentConfig, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setIsSaving(true);

      const config: SpeechToTextConfig = {
        apiKey: values.apiKey.trim(),
        apiEndpoint: values.apiEndpoint.trim(),
        languageCode: values.languageCode,
        enableSpeakerDiarization: values.enableSpeakerDiarization,
        enableAutomaticPunctuation: values.enableAutomaticPunctuation
      };

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
      content: 'Bạn có chắc chắn muốn xóa cấu hình Google Cloud Speech-to-Text?',
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
          <span>Cấu hình Google Cloud Speech-to-Text</span>
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
          label="API Key"
          name="apiKey"
          rules={[
            { required: true, message: 'Vui lòng nhập API Key' },
            { min: 20, message: 'API Key phải có ít nhất 20 ký tự' }
          ]}
          extra={
            <Space direction="vertical" size="small" style={{ marginTop: 8 }}>
              <div style={{ fontSize: '12px', color: '#888' }}>
                <InfoCircleOutlined /> Lấy API Key từ{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Cloud Console
                </a>
              </div>
              <div style={{ fontSize: '12px', color: '#ff9800' }}>
                ⚠️ Lưu ý: API Key sẽ được lưu trên trình duyệt của bạn. Không chia sẻ với người khác.
              </div>
            </Space>
          }
        >
          <Input.Password
            placeholder="Nhập API Key của bạn"
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
          extra="Tự động phân biệt và gán nhãn cho từng người nói trong cuộc họp"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label="Tự động thêm dấu câu"
          name="enableAutomaticPunctuation"
          valuePropName="checked"
          extra="Tự động thêm dấu chấm, phấy, hỏi,... vào văn bản"
        >
          <Switch />
        </Form.Item>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            backgroundColor: '#cba8f8',
            borderLeft: '4px solid #1890ff',
            borderRadius: 4
          }}
        >
          <h4 style={{ marginTop: 0, color: '#1890ff' }}>📌 Hướng dẫn sử dụng:</h4>
          <ol style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>Truy cập <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
            <li>Tạo hoặc chọn một project</li>
            <li>Bật API "Cloud Speech-to-Text API"</li>
            <li>Tạo API Key tại mục "Credentials"</li>
            <li>Sao chép API Key và dán vào form này</li>
            <li>Chọn ngôn ngữ và các tùy chọn khác</li>
            <li>Nhấn "Lưu cấu hình"</li>
          </ol>
        </div>
      </Form>
    </Modal>
  );
};
