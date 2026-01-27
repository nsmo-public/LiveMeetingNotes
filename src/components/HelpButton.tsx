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
              '🗣️ Chuyển đổi giọng nói sang văn bản (Speech-to-Text) miễn phí với Google Web Speech API',
              '🤖 Chuẩn hóa văn bản bằng AI với Google Gemini (tùy chọn)',
              '✏️ Chỉnh sửa/Xóa từng đoạn transcription với double-click',
              '⏯️ Seek audio từ timestamp trong transcription',
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
                <List.Item>• Sử dụng Google Web Speech API (miễn phí, không cần API key)</List.Item>
                <List.Item>• Click <Tag color="orange" icon={<span>⚙️</span>}>Cấu hình Speech-to-Text</Tag> → chọn ngôn ngữ</List.Item>
                <List.Item>• Bật <Tag color="cyan">Tự động chuyển giọng nói thành văn bản</Tag> → tự động chuyển đổi khi ghi âm</List.Item>
                <List.Item>• Kết quả hiển thị real-time với độ tin cậy (confidence) và timestamp chính xác</List.Item>
                <List.Item>• <strong>Double-click</strong> vào timestamp → seek audio đến vị trí tương ứng</List.Item>
                <List.Item>• <strong>Double-click</strong> vào nội dung → chỉnh sửa hoặc xóa đoạn transcription</List.Item>
                <List.Item>• Panel tự động mở rộng khi có kết quả mới</List.Item>
                <List.Item>• Lưu tự động cả kết quả chính thức và raw data để phục vụ AI refinement</List.Item>
              </List>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div>
              <Title level={4}>🤖 Chuẩn hóa văn bản bằng AI</Title>
              <List size="small">
                <List.Item>• <strong>Tùy chọn:</strong> Yêu cầu Google Gemini API Key (miễn phí)</List.Item>
                <List.Item>• Click <Tag color="orange" icon={<span>⚙️</span>}>Cấu hình Speech-to-Text</Tag> → nhập Gemini API Key</List.Item>
                <List.Item>• Hệ thống tự động phát hiện các model có sẵn (gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash...)</List.Item>
                <List.Item>• Chọn model phù hợp với nhu cầu (flash = nhanh, pro = chất lượng cao)</List.Item>
                <List.Item>• Click <Tag color="purple" icon={<span>✨</span>}>Chuẩn hóa bằng AI</Tag> trong panel Transcription</List.Item>
                <List.Item>• AI sử dụng transcription chính thức (ưu tiên) + raw data (bổ trợ) để cải thiện văn bản</List.Item>
                <List.Item>• ⚠️ <Text type="danger"><strong>Cảnh báo bảo mật:</strong></Text> Dữ liệu sẽ được gửi đến Google Gemini API</List.Item>
                <List.Item>• Kết quả được lưu vào transcription.json để export Word</List.Item>
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
                <List.Item>📄 <Text code>[ProjectName]_transcription.json</Text> - Speech-to-Text results (sau khi edit/AI)</List.Item>
                <List.Item>📄 <Text code>[ProjectName]_rawTranscripts.json</Text> - Raw Speech-to-Text data (bổ trợ AI)</List.Item>
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
              <Title level={4}>Scenario 1: Ghi âm cuộc họp mới với Speech-to-Text</Title>
              <List>
                <List.Item>1. Click <Tag color="blue">Chọn thư mục</Tag> → chọn thư mục lưu file (Chrome/Edge)</List.Item>
                <List.Item>2. Điền thông tin cuộc họp (Tên cuộc họp, Ngày, Giờ, Địa điểm, Chủ trì, Thành viên tham dự)</List.Item>
                <List.Item>3. <strong>(TÙY CHỌN)</strong> Cấu hình Speech-to-Text: 
                  <List size="small" style={{marginTop: 8}}>
                    <List.Item>• Click <Tag color="orange">⚙️ Cấu hình Speech-to-Text</Tag></List.Item>
                    <List.Item>• Chọn ngôn ngữ phù hợp</List.Item>
                    <List.Item>• Nhập Gemini API Key (nếu muốn dùng AI refinement)</List.Item>
                    <List.Item>• Chọn Gemini Model (gemini-2.5-flash được khuyên dùng)</List.Item>
                    <List.Item>• Bật <Tag color="cyan">Tự động chuyển giọng nói thành văn bản</Tag></List.Item>
                  </List>
                </List.Item>
                <List.Item>4. Click <Tag color="red">Ghi âm</Tag> → bắt đầu ghi âm</List.Item>
                <List.Item>5. Gõ notes thủ công hoặc để Speech-to-Text tự động ghi nhận, nhấn <Tag>ENTER</Tag> để chèn dòng mới</List.Item>
                <List.Item>6. <strong>(TÙY CHỌN)</strong> Xem kết quả Speech-to-Text trong panel "Kết quả chuyển đổi giọng nói sang văn bản":
                  <List size="small" style={{marginTop: 8}}>
                    <List.Item>• <strong>Double-click timestamp</strong> → seek audio</List.Item>
                    <List.Item>• <strong>Double-click nội dung</strong> → chỉnh sửa hoặc xóa</List.Item>
                    <List.Item>• Click <Tag color="purple">✨ Chuẩn hóa bằng AI</Tag> để cải thiện văn bản (nếu đã cấu hình)</List.Item>
                  </List>
                </List.Item>
                <List.Item>7. Click <Tag>Dừng</Tag> → files tự động lưu (bao gồm transcription.json và rawTranscripts.json)</List.Item>
                <List.Item>8. <strong>(TÙY CHỌN)</strong> Dùng chức năng Translate của trình duyệt để chuyển đổi kết quả sang ngôn ngữ khác</List.Item>
              </List>
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
              <Title level={4}>Scenario 3: Tải dự án đã lưu để chỉnh sửa</Title>
              <List>
                <List.Item>1. Click <Tag color="purple">Tải dự án đã lưu</Tag> → chọn Thư mục lưu dự án cũ</List.Item>
                <List.Item>2. Dữ liệu tự động load lên giao diện</List.Item>
                <List.Item>3. Chỉnh sửa ghi chú/thông tin cuộc họp</List.Item>
                <List.Item>4. Click <Tag color="green">Lưu thay đổi</Tag> → tạo version mới</List.Item>
              </List>
            </div>

    <Title level={4}>-------------------------------------------------------</Title>
            <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px' }}>
          <Title level={4}>Phím tắt</Title>
          <List>
            <List.Item>
              <Tag color="blue">Enter</Tag> - Chèn nhãn thời gian (khi đang ghi âm)
            </List.Item>
            <List.Item>
              <Tag>Space</Tag> - Phát/Tạm dừng audio (khi focus player)
            </List.Item>
          </List>

          <Divider />

          <Title level={4}>Thao tác chuột trên waveform</Title>
          <List>
            <List.Item>
              <strong>Click đúp chuột vào nhãn thời gian</strong> → Tua đến vị trí tương ứng
            </List.Item>
            <List.Item>
              <strong>Click đúp chuột vào waveform</strong> → Tua đến vị trí tương ứng
            </List.Item>
            <List.Item>
              <strong>Click phải chuột vào waveform</strong> → Chèn dòng mới (Ghi chép thủ công) kèm nhãn thời gian tại vị trí của thanh ghi âm (màu đỏ)
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
                <td style={{ padding: '8px' }}>Ghi âm cuộc họp</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅ (14.1+)</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #434343' }}>
                <td style={{ padding: '8px' }}>Truy cập Hệ thống Thư mục</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅ Lưu trực tiếp</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>⚠️ Tải xuống</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>⚠️ Tải xuống</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #434343' }}>
                <td style={{ padding: '8px' }}>Cài đặt PWA</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>✅</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #434343' }}>
                <td style={{ padding: '8px' }}>Chế độ Offline</td>
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
                <Text strong>🧋💸🎁 Ngân hàng BIDV - Nguyen Dac Hung:</Text> <br />
                <Text strong></Text> <Text copyable>2610308803</Text>
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
