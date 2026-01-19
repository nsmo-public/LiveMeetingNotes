import React, { useState } from 'react';
import { Button, Dropdown, type MenuProps } from 'antd';
import { QuestionCircleOutlined, FileTextOutlined, RocketOutlined, SafetyOutlined, GithubOutlined } from '@ant-design/icons';

// Cấu hình các link tài liệu
const DOCS_CONFIG = {
  userGuide: 'https://github.com/nsmo-public/Web_MeetingNote/blob/main/USER_GUIDE.md', // Link hướng dẫn người dùng đầy đủ
  quickStart: 'https://github.com/nsmo-public/Web_MeetingNote/blob/main/QUICKSTART.md', // Link quick start
  github: 'https://github.com/nsmo-public/Web_MeetingNote', // Link GitHub repo
  privacy: 'https://github.com/nsmo-public/Web_MeetingNote/blob/main/PRIVACY.md', // Link privacy policy
};

export const HelpButton: React.FC = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleMenuClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setDropdownOpen(false);
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'quickstart',
      icon: <RocketOutlined />,
      label: '🚀 Quick Start Guide',
      onClick: () => handleMenuClick(DOCS_CONFIG.quickStart),
    },
    {
      key: 'userguide',
      icon: <FileTextOutlined />,
      label: '📚 Hướng dẫn sử dụng đầy đủ',
      onClick: () => handleMenuClick(DOCS_CONFIG.userGuide),
    },
    {
      type: 'divider',
    },
    {
      key: 'github',
      icon: <GithubOutlined />,
      label: '💻 GitHub Repository',
      onClick: () => handleMenuClick(DOCS_CONFIG.github),
    },
    {
      key: 'privacy',
      icon: <SafetyOutlined />,
      label: '🔒 Privacy & Security',
      onClick: () => handleMenuClick(DOCS_CONFIG.privacy),
    },
  ];

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['click']}
      open={dropdownOpen}
      onOpenChange={setDropdownOpen}
      placement="bottomRight"
    >
      <Button
        type="primary"
        icon={<QuestionCircleOutlined />}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        Trợ giúp
      </Button>
    </Dropdown>
  );
};
