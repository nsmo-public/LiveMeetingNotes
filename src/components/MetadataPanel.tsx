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
          label: '📋 Meeting Information',
          children: (
            <div className="metadata-form">
              <div className="form-row">
                <label>Meeting Title:</label>
                <Input
                  value={meetingInfo.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('title', e.target.value)}
                  placeholder="e.g., Weekly Team Meeting"
                />
              </div>

              <div className="form-row form-row-split">
                <div className="form-field">
                  <label>Date:</label>
                  <Input
                    type="date"
                    value={meetingInfo.date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('date', e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Time:</label>
                  <Input
                    type="time"
                    value={meetingInfo.time}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('time', e.target.value)}
                  />
                </div>

                <div className="form-field">
                <label>Location:</label>
                <Input
                  value={meetingInfo.location}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('location', e.target.value)}
                  placeholder="e.g., Conference Room A / Zoom"
                />
              </div>
              </div>

              <div className="form-row form-row-split">
                <div className="form-field">
                  <label>Host:</label>
                  <Input
                  value={meetingInfo.host}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('host', e.target.value)}
                  placeholder="Meeting host name"
                  />
                </div>

                <div className="form-field">
                <label>Attendees:</label>
                <TextArea
                  value={meetingInfo.attendees}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('attendees', e.target.value)}
                  placeholder="Comma-separated names (e.g., Alice, Bob, Charlie)"
                  rows={2}
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
