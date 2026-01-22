import React, { useState } from 'react';
import { Button, Modal, Tabs, Typography, List, Tag, Space, Divider } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import type { TabsProps } from 'antd';

const { Title, Paragraph, Text } = Typography;

export const HelpButton: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);

  const tabItems: TabsProps['items'] = [
    {
      key: '1',
      label: '🎯 Giới thiệu',
      children: (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px' }}>
          <Title level={3}>📝 LiveMeetingNote</Title>
          <Paragraph>
            Ứng dụng web <strong>Progressive Web App (PWA)</strong> chuyên nghiệp giúp ghi chép cuộc họp với các khả năng:
          </Paragraph>
          <List
            dataSource={[
              '🎙️ Ghi âm và đánh dấu thời gian tự động',
              '�️ Chuyển đổi giọng nói sang văn bản (Speech-to-Text)',
              '�📴 Làm việc hoàn toàn offline',
              '💾 Lưu trữ file trực tiếp vào máy tính',
              '🌐 Tương thích đa nền tảng (Chrome, Edge, Firefox, Safari)',
              '🔒 100% bảo mật - Không upload dữ liệu lên server',
              '🔄 Auto-backup & Recovery - Khôi phục khi crash',
              '📂 Load Project - Mở lại project cũ để chỉnh sửa',
              '📄 Export Word - Xuất file .docx để chia sẻ'
            ]}
            renderItem={item => <List.Item>{item}</List.Item>}
          />
        </div>
      ),
    },
    {
      key: '2',
      label: '✨ Tính năng',
      children: (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={4}>🎙️ Ghi âm cuộc họp</Title>
              <List size="small">
                <List.Item>• Ghi âm thông qua microphone của thiết bị</List.Item>
                <List.Item>• Hiển thị thời lượng real-time trong khi ghi</List.Item>
                <List.Item>• Hỗ trợ ghi âm dài (không giới hạn thời gian)</List.Item>
              </List>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div>
              <Title level={4}>⏱️ Timestamp tự động</Title>
              <List size="small">
                <List.Item>• Nhấn <Tag color="blue">ENTER</Tag> khi ghi âm → chèn dòng mới → gõ văn bản sẽ tự động chèn nhãn thời gian</List.Item>
                <List.Item>• <strong>Double-click</strong> vào timestamp → jump đến vị trí đó trong audio</List.Item>
                <List.Item>• Timestamp ghi lại chính xác thời điểm trong audio</List.Item>
              </List>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div>
              <Title level={4}>🗣️ Chuyển đổi giọng nói sang văn bản</Title>
              <List size="small">
                <List.Item>• <strong>Yêu cầu:</strong> Kết nối Internet và Google Cloud API Key</List.Item>
                <List.Item>• Click <Tag color="orange" icon={<span>⚙️</span>}>Transcription Config</Tag> → nhập API Key</List.Item>
                <List.Item>• Bật <Tag color="cyan">Auto-transcribe</Tag> → tự động chuyển đổi khi ghi âm</List.Item>
                <List.Item>• Kết quả hiển thị real-time với độ tin cậy (confidence)</List.Item>
                <List.Item>• Click vào kết quả → seek audio đến vị trí tương ứng</List.Item>
                <List.Item>• <strong>Sửa & chèn:</strong> Nhấn nút Edit → chỉnh sửa văn bản → Insert vào Notes Editor</List.Item>
                <List.Item>• Hỗ trợ speaker diarization (nhận diện người nói)</List.Item>
              </List>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div>
              <Title level={4}>🎵 Audio Playback</Title>
              <List size="small">
                <List.Item>• Hiển thị waveform đồ họa (WaveSurfer.js)</List.Item>
                <List.Item>• Controls: Play/Pause, Skip ±10s, Volume, Zoom In/ Zoom Out</List.Item>
                <List.Item>• <strong>Double-click</strong> vào waveform → seek đến vị trí</List.Item>
                <List.Item>• <strong>Chuột phải</strong> → chèn timestamp tại vị trí đang nghe</List.Item>
              </List>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div>
              <Title level={4}>💾 Lưu trữ file tự động</Title>
              <Paragraph>
                <strong>Chrome/Edge:</strong> Chọn folder một lần → files lưu trực tiếp vào folder
              </Paragraph>
              <Paragraph>
                <strong>Safari/Firefox:</strong> Files download vào thư mục Downloads
              </Paragraph>
              <Paragraph><strong>Files output:</strong></Paragraph>
              <List size="small">
                <List.Item>📄 <Text code>[ProjectName].wav</Text> - Audio file</List.Item>
                <List.Item>📄 <Text code>[ProjectName]_meeting_info.json</Text> - Meeting metadata</List.Item>
                <List.Item>📄 <Text code>[ProjectName]_metadata.json</Text> - Notes + timestamps</List.Item>
                <List.Item>📄 <Text code>[ProjectName].docx</Text> - Word document</List.Item>
              </List>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div>
              <Title level={4}>🔄 Auto-backup & Recovery</Title>
              <List size="small">
                <List.Item>• Tự động backup mỗi 3 giây (localStorage + IndexedDB)</List.Item>
                <List.Item>• Refresh page/đóng browser đột ngột → dialog khôi phục</List.Item>
                <List.Item>• Backup tự xóa sau khi save thành công (hoặc người dùng quyết định hủy bỏ việc lưu)</List.Item>
              </List>
            </div>
          </Space>
        </div>
      ),
    },
    {
      key: '3',
      label: '🎮 Hướng dẫn',
      children: (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={4}>Scenario 1: Ghi âm cuộc họp mới</Title>
              <List>
                <List.Item>1. Click <Tag color="blue">Select Folder</Tag> → chọn thư mục lưu file (Chrome/Edge)</List.Item>
                <List.Item>2. Điền thông tin cuộc họp (Title, Date, Time, Location, Host, Attendees)</List.Item>
                <List.Item>3. <strong>(Optional)</strong> Cấu hình Speech-to-Text: Click <Tag color="orange">⚙️ Transcription Config</Tag> → nhập API Key</List.Item>
                <List.Item>4. Click <Tag color="red">Record</Tag> → bắt đầu ghi âm</List.Item>
                <List.Item>5. Gõ notes, nhấn <Tag>ENTER</Tag> để chèn dòng mới kèm nhãn thời gian</List.Item>
                <List.Item>6. <strong>(Optional)</strong> Kết quả Speech-to-Text xuất hiện tự động → click Edit → Insert vào Notes</List.Item>
                <List.Item>7. Click <Tag>Stop</Tag> → files tự động lưu vào folder đã chọn</List.Item>
                <List.Item>8. Playback audio, double-click timestamp để seek</List.Item>
              </List>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div>
              <Title level={4}>Scenario 2: Chỉ ghi chép không ghi âm</Title>
              <List>
                <List.Item>1. Click <Tag color="blue">Select Folder</Tag> (optional)</List.Item>
                <List.Item>2. Điền thông tin cuộc họp</List.Item>
                <List.Item>3. Gõ notes (không nhấn Record)</List.Item>
                <List.Item>4. Click <Tag color="green">Save Notes</Tag> → lưu JSON + DOCX</List.Item>
              </List>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div>
              <Title level={4}>Scenario 3: Load project cũ để chỉnh sửa</Title>
              <List>
                <List.Item>1. Click <Tag color="purple">Load Project</Tag> → chọn folder project cũ</List.Item>
                <List.Item>2. Dữ liệu tự động load lên form</List.Item>
                <List.Item>3. Chỉnh sửa notes/meeting info</List.Item>
                <List.Item>4. Click <Tag color="green">Save Changes</Tag> → tạo version mới</List.Item>
              </List>
            </div>
          </Space>
        </div>
      ),
    },
    {
      key: '4',
      label: '⌨️ Shortcuts',
      children: (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px' }}>
          <Title level={4}>Keyboard Shortcuts</Title>
          <List>
            <List.Item>
              <Tag color="blue">Enter</Tag> - Insert timestamp (khi đang recording)
            </List.Item>
            <List.Item>
              <Tag>Space</Tag> - Play/Pause audio (khi focus player)
            </List.Item>
          </List>

          <Divider />

          <Title level={4}>Mouse Actions</Title>
          <List>
            <List.Item>
              <strong>Double-click timestamp</strong> → Seek audio to that position
            </List.Item>
            <List.Item>
              <strong>Double-click waveform</strong> → Seek to clicked position
            </List.Item>
            <List.Item>
              <strong>Right-click waveform</strong> → Insert timestamp at current position
            </List.Item>
          </List>
        </div>
      ),
    },
    {
      key: '5',
      label: '🌐 Tương thích',
      children: (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px' }}>
          <Title level={4}>Trình duyệt được hỗ trợ</Title>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #434343' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Tính năng</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Chrome/Edge</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Safari</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Firefox</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #434343' }}>
                <td style={{ padding: '8px' }}>Audio Recording</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅ (14.1+)</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #434343' }}>
                <td style={{ padding: '8px' }}>File System Access</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅ Direct save</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>⚠️ Download</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>⚠️ Download</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #434343' }}>
                <td style={{ padding: '8px' }}>PWA Install</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #434343' }}>
                <td style={{ padding: '8px' }}>Offline Mode</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅</td>
              </tr>
            </tbody>
          </table>
          <Paragraph style={{ marginTop: 16 }}>
            <Text strong>Khuyến nghị:</Text> Chrome hoặc Edge để có trải nghiệm tốt nhất.
          </Paragraph>
        </div>
      ),
    },
    {
      key: '6',
      label: '🔒 Privacy',
      children: (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px' }}>
          <Title level={4}>Privacy & Security</Title>
          <List>
            <List.Item>
              <Tag color="green">✅</Tag> <strong>100% Client-side</strong> - Không upload dữ liệu lên server
            </List.Item>
            <List.Item>
              <Tag color="green">✅</Tag> <strong>Không cần đăng nhập</strong> - Không thu thập thông tin cá nhân
            </List.Item>
            <List.Item>
              <Tag color="green">✅</Tag> <strong>Local storage only</strong> - Files lưu trên máy người dùng
            </List.Item>
            <List.Item>
              <Tag color="green">✅</Tag> <strong>No analytics</strong> - Không tracking hành vi
            </List.Item>
            <List.Item>
              <Tag color="green">✅</Tag> <strong>Open source</strong> - Code công khai, kiểm tra được
            </List.Item>
          </List>

          <Divider />

          <Title level={4}>Use Cases</Title>
          <List>
            <List.Item>✅ Cuộc họp nội bộ - Ghi âm và đánh dấu quyết định quan trọng</List.Item>
            <List.Item>✅ Training/Workshop - Ghi âm bài giảng, note key points</List.Item>
            <List.Item>✅ Họp khách hàng - Lưu trữ yêu cầu làm tài liệu</List.Item>
            <List.Item>✅ Remote teams - Chia sẻ notes + audio cho nhóm làm việc</List.Item>
            <List.Item>✅ Giáo dục/E-learning - Ghi âm và ghi chép bài học</List.Item>
          </List>

          <Divider />

          <Paragraph>
            <Text strong>Tài liệu chi tiết:</Text>
            <br />
            <a href="https://github.com/nsmo-public/LiveMeetingNotes" target="_blank" rel="noopener noreferrer">
              📚 GitHub Repository
            </a>
            {' | '}
            <a href="https://github.com/nsmo-public/LiveMeetingNotes/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer">
              🔒 Privacy Policy
            </a>
          </Paragraph>
        </div>
      ),
    },
    {
      key: '7',
      label: '👤 Tác giả',
      children: (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px' }}>
          <Title level={4}>Tác giả ứng dụng LiveMeetingNote</Title>
          <Paragraph>
            Xin chào! Mình là <Text strong>NguyenDacHung</Text>, tác giả của ứng dụng này.<br />
            <br />
            <Text>
              <strong>LiveMeetingNote</strong> được phát triển với mong muốn chia sẻ miễn phí một công cụ hữu ích giúp mọi người ghi chép, lưu trữ và quản lý nội dung cuộc họp một cách chuyên nghiệp, bảo mật và tiện lợi nhất.<br />
              <br />
              Ứng dụng được cung cấp <Text strong>miễn phí 100% và không vì mục đích thương mại</Text>. Nếu bạn cảm thấy công cụ mang lại giá trị và muốn động viên tác giả trong quá trình duy trì, phát triển, rất hoan nghênh việc kết nối, trao đổi hoặc mời mình cốc coffee nhé ^.^!
            </Text>
          </Paragraph>
          <Divider />
          <List
            size="small"
            header={<Text strong>Thông tin liên hệ</Text>}
            dataSource={[
              <>
                <Text strong>Facebook:</Text>{' '}
                <a href="https://facebook.com/dachungbka" target="_blank" rel="noopener noreferrer">
                  https://facebook.com/dachungbka
                </a>
              </>,
              <>
                <Text strong>Telegram:</Text>{' '}
                <a href="https://t.me/hungnd99" target="_blank" rel="noopener noreferrer">
                  https://t.me/hungnd99
                </a>
              </>,
              <>
                <Text strong>Email:</Text> <a href="mailto:dachungbka@gmail.com">dachungbk@gmail.com</a>
              </>,
              <>
                <Text strong>Ngân hàng:</Text> BIDV - Nguyen Dac Hung<br />
                <Text strong>Số tài khoản:</Text> <Text copyable>2610308803</Text>
              </>,
              <>
                <Text type="secondary" italic>
                  Xin cảm ơn mọi sự ủng hộ! Chúc bạn sử dụng hiệu quả và lan tỏa giá trị tích cực đến cộng đồng. <span style={{color: 'red'}}>❤️</span>
                </Text>
              </>
            ]}
            renderItem={item => <List.Item>{item}</List.Item>}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <Button
        type="primary"
        icon={<QuestionCircleOutlined />}
        onClick={() => setModalVisible(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        Giới thiệu & Hướng dẫn
      </Button>

      <Modal
        title="📚 Hướng dẫn sử dụng LiveMeetingNote"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
        centered
      >
        <Tabs defaultActiveKey="" items={tabItems} />
      </Modal>
    </>
  );
};
