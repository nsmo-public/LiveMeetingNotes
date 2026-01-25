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
            Ứng dụng web, giúp ghi chép cuộc họp với các khả năng:
          </Paragraph>
          <List
            dataSource={[
              '🎙️ Ghi âm và đánh dấu thời gian tự động khi nhập Ghi chú',
              '�️ Chuyển đổi giọng nói sang văn bản (Speech-to-Text) - Cần kết nối internet',
              '�📴 Có khả năng làm việc offline',
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
                <List.Item>• <strong>Yêu cầu:</strong> Kết nối Internet</List.Item>
                <List.Item>• Click <Tag color="orange" icon={<span>⚙️</span>}>Cấu hình Speech-to-Text</Tag> → nhập API Key (nếu có), chọn ngôn ngữ ...</List.Item>
                <List.Item>• Dùng chức năng Translate của trình duyệt Web để chuyển đổi tự động kết quả sang ngôn ngữ khác (nếu cần)</List.Item>
                <List.Item>• Bật <Tag color="cyan">Tự động chuyển giọng nói thành văn bản</Tag> → tự động chuyển đổi khi ghi âm</List.Item>
                <List.Item>• Kết quả hiển thị real-time với độ tin cậy (confidence)</List.Item>
                <List.Item>• Click vào kết quả → seek audio đến vị trí tương ứng</List.Item>
                <List.Item>• Hỗ trợ speaker diarization (nhận diện người nói - yêu cầu phải có API Key)</List.Item>
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
                <List.Item>📄 <Text code>[ProjectName].webm</Text> - Audio file</List.Item>
                <List.Item>📄 <Text code>[ProjectName]_meeting_info.json</Text> - Meeting metadata</List.Item>
                <List.Item>📄 <Text code>[ProjectName]_metadata.json</Text> - Notes + timestamps</List.Item>
                <List.Item>📄 <Text code>[ProjectName]_transcriptions.json</Text> - Notes + timestamps</List.Item>
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
                <List.Item>1. Click <Tag color="blue">Chọn thư mục</Tag> → chọn thư mục lưu file (Chrome/Edge)</List.Item>
                <List.Item>2. Điền thông tin cuộc họp (Tên cuộc họp, Ngày, Giờ, Địa điểm, Chủ trì, Thành viên tham dự)</List.Item>
                <List.Item>3. <strong>(TÙY CHỌN)</strong> Cấu hình Speech-to-Text: Click <Tag color="orange">⚙️ Cấu hình Speech-to-Text</Tag> → nhập API Key</List.Item>
                <List.Item>4. Click <Tag color="red">Ghi âm</Tag> → bắt đầu ghi âm</List.Item>
                <List.Item>5. Gõ notes, nhấn <Tag>ENTER</Tag> để chèn dòng mới chèn dòng mới → khi gõ văn bản sẽ tự động chèn nhãn thời gian</List.Item>
                <List.Item>6. Click <Tag>Dừng</Tag> → files tự động lưu vào folder đã chọn</List.Item>
                <List.Item>7. Phát lại audio, double-click timestamp để tua đến vị trí tương ứng</List.Item>
              </List>
              <List.Item>8. <strong>(TÙY CHỌN)</strong> Dùng chức năng Translate của trình duyệt Web để chuyển đổi tự động kết quả sang ngôn ngữ khác: 🎧 Nghe người nói bằng ngôn ngữ A →
📝 Nhận nội dung chuyển giọng nói → văn bản → 🌍 Dịch tức thời sang ngôn ngữ B</List.Item>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div>
              <Title level={4}>Scenario 2: Chỉ ghi chép không ghi âm</Title>
              <List>
                <List.Item>1. Click <Tag color="blue">Chọn thư mục</Tag> (tùy chọn)</List.Item>
                <List.Item>2. Điền thông tin cuộc họp</List.Item>
                <List.Item>3. Gõ notes (không nhấn Ghi âm)</List.Item>
                <List.Item>4. Click <Tag color="green">Lưu ghi chú</Tag> → lưu JSON + DOCX</List.Item>
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

    <Title level={4}>-------------------------------------------------------</Title>
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
          </Space>
        </div>
      ),
    },
    {
      key: '4',
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
      key: '5',
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
        </div>
      ),
    },
    {
      key: '6',
      label: '🙋 Tác giả 🙋',
      children: (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px' }}>
          <Paragraph>
            Xin chào! Mình là <Text strong>NguyenDacHung</Text>, tác giả của ứng dụng này.<br />
            <br />
            <Text>
              <strong>LiveMeetingNotes</strong> được phát triển nhằm mục đích cung cấp miễn phí một công cụ hỗ trợ ghi chép, lưu trữ và quản lý nội dung cuộc họp một cách chuyên nghiệp, bảo mật và tiện lợi.<br />
              <br />
              Ứng dụng này được cung cấp <Text strong>HOÀN TOÀN MIỄN PHÍ, không vì mục đích thương mại</Text>. Trong trường hợp Anh/Chị thấy LiveMeetingNotes hữu ích và mong muốn hỗ trợ tác giả một chút kinh phí (<Text strong></Text>tinh thần tự nguyện<Text strong></Text>) để góp phần duy trì và phát triển sản phẩm, Anh/Chị có thể liên hệ qua Thông tin bên dưới 💸👇 ^.^!. Mọi sự đồng hành của Anh/Chị đều được tác giả trân trọng ghi nhận và xem đây là động lực để phát triển các công cụ mới trong tương lai! <br />
              <br />XIN LƯU Ý: Việc đóng góp hoàn toàn mang tính chất tự nguyện, không bắt buộc và không ảnh hưởng đến bất kỳ tính năng nào của ứng dụng. Tác giả không yêu cầu hay thu bất kỳ khoản phí sử dụng nào dưới mọi hình thức. Mọi hành vi thu phí bắt buộc hoặc mạo danh LiveMeetingNotes đều không xuất phát từ tác giả. Đề nghị người dùng cẩn trọng để tránh các trường hợp lừa đảo không đáng có.<br />
              <br />
              Mọi thắc mắc hoặc cần hỗ trợ, Anh/Chị vui lòng liên hệ qua các kênh sau:
            </Text>
          </Paragraph>
          <List
            size="small"
            header={<Text strong>Thông tin liên hệ</Text>}
            dataSource={[
              <>
                <Text strong>✌️Facebook:</Text>{' '}
                <a href="https://facebook.com/dachungbka" target="_blank" rel="noopener noreferrer">
                  https://facebook.com/dachungbka
                </a>
              </>,
              <>
                <Text strong>🌀Telegram:</Text>{' '}
                <a href="https://t.me/hungnd99" target="_blank" rel="noopener noreferrer">
                  https://t.me/hungnd99
                </a>
              </>,
              <>
                <Text strong>📬Email:</Text> <a href="mailto:dachungbk@gmail.com">dachungbk@gmail.com</a>
              </>,
              <>
                <Text strong>🧋💸🎁:</Text> BIDV - Nguyen Dac Hung<br />
                <Text strong>Số tài khoản:</Text> <Text copyable>2610308803</Text>
              </>,
              <>
                <Text type="secondary" italic>
                  Xin cảm ơn mọi sự ủng hộ! Chúc Anh/Chị sử dụng hiệu quả và lan tỏa giá trị tích cực đến cộng đồng ❤️
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
        title="📚 Ứng dụng LiveMeetingNotes"
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
