import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, Button, Space, App, Collapse, Tag } from 'antd';
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
      
      // Default values (recommended settings)
      const defaultValues = {
        apiKey: '',
        geminiApiKey: '',
        openaiApiKey: '',
        aiProvider: 'gemini' as const,
        apiEndpoint: 'https://speech.googleapis.com/v1/speech:recognize',
        languageCode: 'vi-VN',
        enableSpeakerDiarization: false,
        enableAutomaticPunctuation: true,
        maxAlternatives: 1,
        minSpeakerCount: 2,
        maxSpeakerCount: 6,
        segmentTimeout: 1000,
        segmentMaxLength: 150
      };
      
      // Merge saved config with defaults (ensures new fields have default values)
      const mergedConfig = savedConfig ? { ...defaultValues, ...savedConfig } : defaultValues;
      form.setFieldsValue(mergedConfig);
    }
  }, [visible, currentConfig, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setIsSaving(true);

      const config: SpeechToTextConfig = {
        apiKey: values.apiKey?.trim() || '',
        geminiApiKey: values.geminiApiKey?.trim() || '',
        openaiApiKey: values.openaiApiKey?.trim() || '',
        aiProvider: values.aiProvider || 'gemini',
        apiEndpoint: values.apiEndpoint.trim(),
        languageCode: values.languageCode,
        enableSpeakerDiarization: values.enableSpeakerDiarization,
        enableAutomaticPunctuation: values.enableAutomaticPunctuation,
        maxAlternatives: values.maxAlternatives || 1,
        minSpeakerCount: values.minSpeakerCount || 2,
        maxSpeakerCount: values.maxSpeakerCount || 6,
        segmentTimeout: values.segmentTimeout || 1000,
        segmentMaxLength: values.segmentMaxLength || 150
      };

      // Validate: Speaker diarization requires API Key
      if (config.enableSpeakerDiarization && !config.apiKey) {
        message.error('⚠️ Nhận diện người nói yêu cầu Google Cloud API Key');
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
          label="API Key (Tùy chọn - cho Speech-to-Text)"
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
            </Space>
          }
        >
          <Input.Password
            placeholder="Để trống để dùng Web Speech API miễn phí"
            autoComplete="off"
          />
        </Form.Item>

        {/* AI Provider Selection */}
        <Form.Item
          label="AI Provider (cho chuẩn hóa văn bản)"
          name="aiProvider"
          rules={[{ required: true, message: 'Vui lòng chọn AI provider' }]}
          extra="Chọn AI engine để chuẩn hóa văn bản chuyển đổi"
        >
          <Select>
            <Select.Option value="gemini">
              <Space>
                <span>🤖 Google Gemini</span>
                <Tag color="green" style={{ fontSize: '10px' }}>MIỄN PHÍ</Tag>
              </Space>
            </Select.Option>
            <Select.Option value="openai">
              <Space>
                <span>💬 OpenAI ChatGPT</span>
                <Tag color="orange" style={{ fontSize: '10px' }}>TRẢ PHÍ</Tag>
              </Space>
            </Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Gemini API Key (Tùy chọn)"
          name="geminiApiKey"
          rules={[
            { min: 20, message: 'API Key phải có ít nhất 20 ký tự' }
          ]}
          extra={
            <Space direction="vertical" size="small" style={{ marginTop: 8 }}>
              <div style={{ fontSize: '12px', color: '#52c41a', fontWeight: 'bold' }}>
                ✨ MIỄN PHÍ: Lấy tại{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google AI Studio
                </a>
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>
                💡 Chỉ cần nếu chọn AI Provider = Gemini
              </div>
            </Space>
          }
        >
          <Input.Password
            placeholder="Lấy miễn phí tại aistudio.google.com/app/apikey"
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          label="OpenAI API Key (Tùy chọn)"
          name="openaiApiKey"
          rules={[
            { min: 20, message: 'API Key phải có ít nhất 20 ký tự' }
          ]}
          extra={
            <Space direction="vertical" size="small" style={{ marginTop: 8 }}>
              <div style={{ fontSize: '12px', color: '#ff9800' }}>
                💰 Trả phí: Lấy tại{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OpenAI Platform
                </a>
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>
                💡 Chỉ cần nếu chọn AI Provider = OpenAI (GPT-3.5-turbo ~$0.0015/1K tokens)
              </div>
            </Space>
          }
        >
          <Input.Password
            placeholder="sk-..."
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
                ⚠️ Chức năng này chỉ khả dụng với Google Cloud API (có phí) khi chuyển đổi file ghi âm.
              </div>
            </div>
          }
        >
          <Switch />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => 
            prevValues.enableSpeakerDiarization !== currentValues.enableSpeakerDiarization
          }
        >
          {({ getFieldValue }) => 
            getFieldValue('enableSpeakerDiarization') ? (
              <>
                <Form.Item
                  label="Số người nói tối thiểu"
                  name="minSpeakerCount"
                  initialValue={2}
                  extra="Số lượng người nói dự kiến tối thiểu (2-6)"
                >
                  <Select placeholder="Chọn số người tối thiểu">
                    <Select.Option value={2}>2 người (khuyến nghị)</Select.Option>
                    <Select.Option value={3}>3 người</Select.Option>
                    <Select.Option value={4}>4 người</Select.Option>
                    <Select.Option value={5}>5 người</Select.Option>
                    <Select.Option value={6}>6 người</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="Số người nói tối đa"
                  name="maxSpeakerCount"
                  initialValue={6}
                  extra="Số lượng người nói dự kiến tối đa (2-6)"
                >
                  <Select placeholder="Chọn số người tối đa">
                    <Select.Option value={2}>2 người</Select.Option>
                    <Select.Option value={3}>3 người</Select.Option>
                    <Select.Option value={4}>4 người</Select.Option>
                    <Select.Option value={5}>5 người</Select.Option>
                    <Select.Option value={6}>6 người (khuyến nghị)</Select.Option>
                  </Select>
                </Form.Item>
              </>
            ) : null
          }
        </Form.Item>

        <Form.Item
          label="Tự động thêm dấu câu"
          name="enableAutomaticPunctuation"
          valuePropName="checked"
          extra="Tự động thêm dấu chấm, phấy, hỏi,... vào văn bản"
        >
          <Switch />
        </Form.Item>

        <Collapse 
          ghost
          items={[{
            key: 'advanced',
            label: '⚙️ Cài đặt nâng cao',
            children: (
              <>
                <Form.Item
                  label="Số phiên bản nhận diện"
                  name="maxAlternatives"
                  initialValue={1}
                  extra="Số lượng kết quả thay thế API trả về (1-5). Giá trị cao hơn tốn băng thông hơn."
                >
                  <Select placeholder="Chọn số phiên bản">
                    <Select.Option value={1}>1 (khuyến nghị)</Select.Option>
                    <Select.Option value={2}>2</Select.Option>
                    <Select.Option value={3}>3</Select.Option>
                    <Select.Option value={4}>4</Select.Option>
                    <Select.Option value={5}>5</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="Thời gian chờ kết thúc đoạn (ms)"
                  name="segmentTimeout"
                  initialValue={1000}
                  extra="Thời gian tạm dừng trước khi tự động kết thúc đoạn văn bản (500-2000ms)"
                >
                  <Select placeholder="Chọn thời gian chờ">
                    <Select.Option value={500}>500ms (nhanh)</Select.Option>
                    <Select.Option value={750}>750ms</Select.Option>
                    <Select.Option value={1000}>1000ms (khuyến nghị)</Select.Option>
                    <Select.Option value={1500}>1500ms</Select.Option>
                    <Select.Option value={2000}>2000ms (chậm)</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="Độ dài tối đa mỗi đoạn"
                  name="segmentMaxLength"
                  initialValue={150}
                  extra="Số ký tự tối đa trước khi tự động chia đoạn (100-300)"
                >
                  <Select placeholder="Chọn độ dài tối đa">
                    <Select.Option value={100}>100 ký tự (ngắn)</Select.Option>
                    <Select.Option value={150}>150 ký tự (khuyến nghị)</Select.Option>
                    <Select.Option value={200}>200 ký tự</Select.Option>
                    <Select.Option value={250}>250 ký tự</Select.Option>
                    <Select.Option value={300}>300 ký tự (dài)</Select.Option>
                  </Select>
                </Form.Item>
              </>
            )
          }]}
        />

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
              <li><strong>Luôn được dùng</strong> cho ghi âm trực tiếp (live transcription)</li>
              <li><strong style={{ color: '#ff4d4f' }}>Không</strong> hỗ trợ nhận diện người nói</li>
            </ul>
          </div>
          <div>
            <strong style={{ color: '#1890ff' }}>💰 Google Cloud API (Có phí - Nâng cao)</strong>
            <ul style={{ marginBottom: 0, paddingLeft: 20, fontSize: '13px' }}>
              <li>Cần API Key từ <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
              <li>Độ chính xác cao hơn</li>
              <li><strong>Chỉ được dùng</strong> khi chuyển đổi file ghi âm đã lưu</li>
              <li>Hỗ trợ nhận diện người nói (speaker diarization)</li>
              <li>Chi phí: ~$0.006/15 giây audio (theo biểu giá của Google Cloud)</li>
            </ul>
          </div>
        </div>
      </Form>
    </Modal>
  );
};
