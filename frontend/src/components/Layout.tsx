import React from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from "react-i18next";
import { 
  MessageOutlined, DatabaseOutlined, FileTextOutlined, 
  SettingOutlined, LogoutOutlined, BgColorsOutlined, CheckOutlined
} from '@ant-design/icons';
import { Layout as AntLayout, Menu, Button, Modal, theme as antdTheme, Typography, Popover, Space, Switch, Divider } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';

const { Sider, Content } = AntLayout;
const { Title, Text } = Typography;

interface LayoutProps {
  children: React.ReactNode;
}

const THEME_COLORS = [
  '#1677ff', // Blue
  '#52c41a', // Green
  '#f5222d', // Red
  '#722ed1', // Purple
  '#fa8c16', // Orange
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme: contextToggleTheme, colorPrimary, setColorPrimary } = useTheme();
  
  // Use Ant Design's token to get colors if needed
  const {
    token: { colorBorder },
  } = antdTheme.useToken();

  const navItems = [
    { key: '/', label: t('nav.chatDebugger'), icon: <MessageOutlined /> },
    { key: '/knowledge-base', label: t('nav.knowledgeBase'), icon: <DatabaseOutlined /> },
    { key: '/batch-eval', label: t('nav.batchEval'), icon: <FileTextOutlined /> },
    { key: '/instructions', label: t('nav.instructions'), icon: <SettingOutlined /> },
  ];

  const handleLogout = () => {
    Modal.confirm({
      title: t('layout.logoutTitle'),
      content: t('layout.logoutDesc'),
      okText: t('layout.confirm'),
      cancelText: t('layout.cancel'),
      okType: 'danger',
      maskClosable: true,
      onOk() {
        localStorage.removeItem('token');
        window.location.href = '/login';
      },
    });
  };

  const themeContent = (
    <div style={{ width: 200 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text>{t('layout.darkMode')}</Text>
        <Switch 
          checked={theme === 'dark'} 
          onChange={contextToggleTheme} 
        />
      </div>
      <Divider style={{ margin: '12px 0' }} />
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
        {THEME_COLORS.map(color => (
          <div
            key={color}
            onClick={() => setColorPrimary(color)}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: color,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: colorPrimary === color ? '2px solid rgba(0,0,0,0.2)' : 'none'
            }}
          >
             {colorPrimary === color && <CheckOutlined style={{ color: 'white', fontSize: 12 }} />}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <AntLayout style={{ height: '100vh' }}>
      <Sider 
        width={250} 
        theme={theme === 'dark' ? 'dark' : 'light'}
        style={{ 
          borderRight: `1px solid ${colorBorder}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '24px', borderBottom: `1px solid ${colorBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: colorPrimary, fontSize: 20 }}>⚡</span> 
              <Title level={4} style={{ margin: 0, color: theme === 'dark' ? 'white' : 'black' }}>Audio AI</Title>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', marginTop: '10px' }}>
            <Menu
              mode="inline"
              selectedKeys={[location]}
              items={navItems}
              onClick={({ key }) => setLocation(key)}
              style={{ borderRight: 0 }}
              theme={theme === 'dark' ? 'dark' : 'light'}
            />
          </div>

          <div style={{ padding: '16px', borderTop: `1px solid ${colorBorder}` }}>
            <Popover 
              content={themeContent} 
              title={t('layout.themeColor')} 
              trigger="click" 
              placement="rightBottom"
            >
              <Button 
                  type="text" 
                  block 
                  style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'flex-start', 
                  gap: '12px',
                  color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : undefined
                  }}
              >
                  <BgColorsOutlined />
                  <span>{t('layout.themeColor')}</span>
              </Button>
            </Popover>
            
            <Button 
              type="text" 
              danger
              block 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'flex-start', 
                gap: '12px',
                marginTop: '8px'
              }}
              onClick={handleLogout}
            >
              <LogoutOutlined />
              <span>{t('layout.logout')}</span>
            </Button>
          </div>
        </div>
      </Sider>

      <AntLayout>
        <Content style={{ 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column',
          position: 'relative' 
        }}>
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
