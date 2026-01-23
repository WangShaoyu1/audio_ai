import { Message } from '@/lib/types';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from "react-i18next";
import { DeleteOutlined, FileTextOutlined, EyeOutlined, ExpandAltOutlined } from '@ant-design/icons';
import { Button, Tooltip, theme, Card, Typography, Space, Tag, Drawer } from 'antd';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

const { Text } = Typography;

interface JsonLoggerProps {
  messages: Message[];
  onClear?: () => void;
}

export default function JsonLogger({ messages, onClear }: JsonLoggerProps) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const scrollRef = useRef<HTMLDivElement>(null);
  const drawerScrollRef = useRef<HTMLDivElement>(null);
  const [markdownView, setMarkdownView] = useState<Record<string, boolean>>({});
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const toggleMarkdown = (id: string) => {
    setMarkdownView(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  };
  
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom(scrollRef);
      if (isDrawerOpen) {
        scrollToBottom(drawerScrollRef);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isDrawerOpen]);

  const renderLogContent = (isFull: boolean) => (
    <div 
      ref={isFull ? drawerScrollRef : scrollRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        fontFamily: 'monospace',
        fontSize: 12,
        height: '100%'
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, color: token.colorTextSecondary }}>
              <Space style={{ overflow: 'hidden', flex: 1 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>[{new Date(msg.timestamp).toLocaleTimeString()}]</Text>
                <Text 
                  strong 
                  style={{ 
                    color: msg.role === 'user' ? '#1890ff' : 
                           msg.role === 'assistant' ? '#52c41a' : '#faad14' 
                  }}
                >
                  {msg.role.toUpperCase()}
                </Text>
                {msg.intent && (
                  <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>
                    {t("logger.intent")}: {msg.intent}
                  </Tag>
                )}
              </Space>
              {msg.role === 'assistant' && (
                <Tooltip title={markdownView[msg.id] ? t("logger.viewRaw") : t("logger.viewMarkdown")}>
                  <Button
                    type="text"
                    size="small"
                    onClick={() => toggleMarkdown(msg.id)}
                    icon={markdownView[msg.id] ? <FileTextOutlined /> : <EyeOutlined />}
                  />
                </Tooltip>
              )}
            </div>
            
            <div style={{ paddingLeft: 16, borderLeft: `1px solid ${token.colorBorder}`, width: '100%' }}>
              {msg.role === 'assistant' && markdownView[msg.id] ? (
                  <div style={{ fontSize: 12, wordBreak: 'break-word', color: token.colorText }}>
                      <ReactMarkdown
                          children={msg.content}
                          remarkPlugins={[remarkGfm]}
                          components={{
                              code({node, inline, className, children, ...props}: any) {
                                  const match = /language-(\w+)/.exec(className || '')
                                  return !inline && match ? (
                                      <SyntaxHighlighter
                                          {...props}
                                          children={String(children).replace(/\n$/, '')}
                                          style={oneDark}
                                          language={match[1]}
                                          PreTag="div"
                                          customStyle={{ fontSize: '10px' }}
                                      />
                                  ) : (
                                      <code {...props} className={className}>
                                          {children}
                                      </code>
                                  )
                              }
                          }}
                      />
                  </div>
              ) : (
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', width: '100%', color: token.colorText }}>{msg.content}</div>
              )}
              
              {msg.functionCall && (
                <div style={{ borderRadius: token.borderRadius, padding: 8, width: '100%', backgroundColor: token.colorFillQuaternary, marginTop: 8 }}>
                  <div style={{ color: '#722ed1', marginBottom: 4 }}>{t("logger.functionCall")}: {msg.functionCall.name}</div>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', width: '100%', margin: 0 }}>{JSON.stringify(msg.functionCall.arguments, null, 2)}</pre>
                </div>
              )}
              
              {(msg.latency || msg.ttft) && (
                <div style={{ fontSize: 10, color: token.colorTextQuaternary, marginTop: 8 }}>
                  {msg.ttft ? (
                    <>
                      {t("chat.ttft")}: {msg.ttft}ms | {t("chat.totalLatency")}: {msg.latency || '-'}ms
                    </>
                  ) : (
                    <>
                      {t("chat.totalLatency")}: {msg.latency}ms
                    </>
                  )}
                   | {t("logger.confidence")}: {msg.confidence ?? 0.95}
                </div>
              )}
              
              {msg.metadata && msg.role !== 'user' && (
                <div style={{ marginTop: 8, padding: 8, borderRadius: token.borderRadius, fontSize: 10, fontFamily: 'monospace', width: '100%', backgroundColor: token.colorFillQuaternary }}>
                  <div style={{ color: '#1890ff', marginBottom: 4 }}>{t("logger.linkDetails")}:</div>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', width: '100%', margin: 0, color: token.colorTextSecondary }}>{JSON.stringify(msg.metadata, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', fontStyle: 'italic', color: token.colorTextQuaternary }}>
            {t("logger.waiting")}
          </div>
        )}
      </Space>
    </div>
  );

  return (
    <>
      <Card
        title={
          <Space>
            <Tooltip title={t("logger.expand")}>
              <Button
                  type="text"
                  size="small"
                  onClick={() => setIsDrawerOpen(true)}
                  icon={<ExpandAltOutlined />}
              />
            </Tooltip>
            <Text strong style={{ fontFamily: 'monospace' }}>{t("logger.title")}</Text>
          </Space>
        }
        extra={
          onClear && (
            <Tooltip title={t("logger.clear")}>
              <Button 
                type="text" 
                size="small" 
                onClick={onClear}
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          )
        }
        styles={{
          body: {
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden'
          },
          header: {
            minHeight: 48,
            padding: '0 12px'
          }
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          boxShadow: token.boxShadowTertiary,
        }}
      >
        {renderLogContent(false)}
      </Card>

      <Drawer
        title={t("logger.title")}
        placement="right"
        width={800}
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
        styles={{
            body: { padding: 0 }
        }}
      >
         {renderLogContent(true)}
      </Drawer>
    </>
  );
}
