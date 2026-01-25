import React from 'react';
import { Input, Collapse } from 'antd';
import type { MeetingInfo } from '../types/types';

const { TextArea } = Input;

interface Props {
  meetingInfo: MeetingInfo;
  onChange: (info: MeetingInfo) => void;
}

export const MetadataPanel: React.FC<Props> = ({ meetingInfo, onChange }) => {
  const handleChange = (field: keyof MeetingInfo, value: string) => {
    onChange({
      ...meetingInfo,
      [field]: value
    });
  };

  return (
    <Collapse
      defaultActiveKey={['1']}
      className="metadata-panel"
      items={[
        {
          key: '1',
          label: '📋 Thông tin cuộc họp',
          children: (
            <div className="metadata-form">
              <div className="form-row">
                <label>Tên cuộc họp:</label>
                <Input
                  value={meetingInfo.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('title', e.target.value)}
                  placeholder="VD: Họp giao ban, thảo luận dự án..."
                />
              </div>

              <div className="form-row form-row-split">
                <div className="form-field">
                  <label>Ngày:</label>
                  <Input
                    type="date"
                    value={meetingInfo.date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('date', e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Giờ:</label>
                  <Input
                    type="time"
                    value={meetingInfo.time}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('time', e.target.value)}
                  />
                </div>

                <div className="form-field">
                <label>Địa điểm:</label>
                <Input
                  value={meetingInfo.location}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('location', e.target.value)}
                  placeholder="VD: Phòng họp A / Zoom"
                />
              </div>
              </div>

              <div className="form-row form-row-split2" >
                <div className="form-field">
                  <label>Chủ trì:</label>
                  <TextArea
                  value={meetingInfo.host}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('host', e.target.value)}
                  placeholder="Tên người chủ trì"
                  rows={1}
                  />
                </div>

                <div className="form-field">
                <label>Thành viên tham dự:</label>
                <TextArea
                  value={meetingInfo.attendees}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('attendees', e.target.value)}
                  placeholder="Tên cách nhau bởi dấu phẩy (VD: An, Bình, Chi) - LiveMeetingNotes được đầu tư & phát triển bởi NguyenDacHung"
                  rows={1}
                />
              </div>
              </div>
            </div>
          )
        }
      ]}
    />
  );
};
