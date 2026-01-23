import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Button, Input, Dropdown, MenuProps, Tooltip, Checkbox, Spin, theme, App, Layout, Typography, Space, Modal, AutoComplete } from 'antd';
import { SendOutlined, PlusOutlined, MessageOutlined, MoreOutlined, DeleteOutlined, EditOutlined, ReloadOutlined } from "@ant-design/icons";

const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;

import { Message } from '@/lib/types';
import JsonLogger from '@/components/JsonLogger';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";

interface Session {
  id: string;
  name: string;
  created_at: string;
}

const BATCH_SIZE = 20;

// Memoized Message Item Component
const MessageItem = memo(({ msg, token, t, handleRetry }: { msg: Message, token: any, t: any, handleRetry: (id: string) => void }) => {
  return (
    <div id={`msg-${msg.id}`} style={{ display: 'flex', gap: 12, justifyContent: msg.role === 'user' ? "flex-end" : "flex-start", marginBottom: 16 }}>
      <div 
          style={{
              maxWidth: '80%',
              padding: 16,
              borderRadius: 16,
              borderTopRightRadius: msg.role === 'user' ? 0 : 16,
              borderTopLeftRadius: msg.role === 'user' ? 16 : 0,
              backgroundColor: msg.role === 'user' ? token.colorPrimary : token.colorFillSecondary,
              color: msg.role === 'user' ? '#fff' : token.colorText,
              fontSize: 14,
              lineHeight: 1.6,
              position: 'relative'
          }}
      >
        {msg.role === 'user' ? (
          msg.content
        ) : (
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
                  />
                ) : (
                  <code {...props} className={className}>
                    {children}
                  </code>
                )
              }
            }}
          />
        )}
        
        {(msg.latency || msg.ttft) && (
          <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>
              {msg.ttft ? (
                  <>
                      {t("chat.ttft")}: {msg.ttft}ms | {t("chat.totalLatency")}: {msg.latency || '-'}ms
                  </>
              ) : (
                  <>
                      {t("chat.totalLatency")}: {msg.latency}ms
                  </>
              )}
               | {t("chat.route")}: {msg.intent}
          </div>
        )}
        {msg.role === 'assistant' && (msg.content === '' || msg.content.includes('[System Error:') || msg.isError) && (
          <div style={{ position: 'absolute', bottom: 4, right: 4 }}>
              <Tooltip title={t("common.retry")}>
                  <Button 
                      type="text"
                      size="small" 
                      onClick={() => handleRetry(msg.id)}
                      icon={<ReloadOutlined style={{ color: token.colorText }} />}
                  />
              </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.msg.id === next.msg.id && 
         prev.msg.content === next.msg.content && 
         prev.msg.latency === next.msg.latency &&
         prev.msg.ttft === next.msg.ttft &&
         prev.msg.isError === next.msg.isError &&
         prev.token.colorPrimary === next.token.colorPrimary;
});

// Memoized Message List Component
const MessageList = memo(({ messages, token, t, handleRetry, isProcessing }: { messages: Message[], token: any, t: any, handleRetry: (id: string) => void, isProcessing: boolean }) => {
  return (
    <>
      {messages.map(msg => (
        <MessageItem key={msg.id} msg={msg} token={token} t={t} handleRetry={handleRetry} />
      ))}
      {isProcessing && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-start' }}>
          <div 
              style={{
                  padding: 16,
                  borderRadius: 16,
                  borderTopLeftRadius: 0,
                  backgroundColor: token.colorFillSecondary,
                  color: token.colorTextSecondary,
                  fontSize: 14
              }}
          >
            <Spin size="small" />
            <span style={{ marginLeft: 8 }}>{t("home.generating") || "..."}</span>
          </div>
        </div>
      )}
    </>
  );
});

export default function Home() {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStream, setIsStream] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [sessionToRename, setSessionToRename] = useState<Session | null>(null);
  const [newName, setNewName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [logClearTimestamp, setLogClearTimestamp] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!targetMessageId) {
        scrollToBottom();
    }
  }, [messages, isProcessing, targetMessageId]);

  // Scroll to target message if it exists
  useEffect(() => {
    if (targetMessageId && messages.length > 0) {
        const el = document.getElementById(`msg-${targetMessageId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight effect
            el.style.transition = 'background-color 0.5s';
            el.style.backgroundColor = 'rgba(24, 144, 255, 0.1)';
            setTimeout(() => {
                el.style.backgroundColor = 'transparent';
                setTargetMessageId(null);
            }, 2000);
        }
    }
  }, [messages, targetMessageId]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const timer = setTimeout(() => {
        handleSearch(searchQuery);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleSearch = async (q: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/search/messages?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (error) {
      console.error("Search failed", error);
    }
  };

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch("/api/v1/sessions", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !currentSessionId) {
          selectSession(data[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch sessions", error);
    }
  };

  const createSession = () => {
    setCurrentSessionId(null);
    setMessages([]);
  };

  const loadHistory = async (sessionId: string, offsetVal: number, isInitial: boolean) => {
    setIsLoadingHistory(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/sessions/${sessionId}/history?limit=${BATCH_SIZE}&offset=${offsetVal}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const history = await res.json();
        if (Array.isArray(history)) {
          const mappedMessages = history.map((msg: any) => ({
            id: msg.id || msg.timestamp || Date.now().toString(),
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
            intent: msg.intent || msg.metadata?.route || msg.metadata?.intent,
            latency: msg.latency || msg.metadata?.latency?.total_ms || msg.metadata?.latency,
            ttft: msg.ttft || msg.metadata?.latency?.ttft_ms,
            metadata: msg.metadata
          }));

          if (mappedMessages.length < BATCH_SIZE) {
            setHasMore(false);
          }

          if (isInitial) {
            setMessages(mappedMessages);
            // Scroll to bottom after render if not targeting a message
            if (!targetMessageId) {
                setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
            }
          } else {
            const container = chatContainerRef.current;
            const oldHeight = container ? container.scrollHeight : 0;
            const oldScrollTop = container ? container.scrollTop : 0;

            setMessages(prev => [...mappedMessages, ...prev]);

            // Restore scroll position
            requestAnimationFrame(() => {
              if (container) {
                const newHeight = container.scrollHeight;
                container.scrollTop = newHeight - oldHeight + oldScrollTop;
              }
            });
          }

          if (mappedMessages.length > 0) {
            setOffset(offsetVal + BATCH_SIZE);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load session history", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const selectSession = async (sessionId: string, messageId?: string) => {
    setCurrentSessionId(sessionId);
    setMessages([]); 
    setLogClearTimestamp(0);
    setOffset(0);
    setHasMore(true);
    setTargetMessageId(messageId || null);
    await loadHistory(sessionId, 0, true);
  };

  const renameSession = async () => {
    if (!sessionToRename) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/sessions/${sessionToRename.id}/rename`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ name: newName })
      });
      if (res.ok) {
        fetchSessions();
        setIsRenameDialogOpen(false);
        message.success(t("home.renameSuccess") || "Session renamed successfully");
      }
    } catch (error) {
      console.error("Failed to rename session", error);
      message.error(t("home.renameFailed") || "Failed to rename session");
    }
  };

  const confirmDeleteSession = (sessionId: string) => {
    modal.confirm({
      title: t("home.deleteSession"),
      content: t("home.deleteSessionConfirm") || "Are you sure you want to delete this session?",
      okText: t("home.confirm"),
      cancelText: t("home.cancel"),
      okType: 'danger',
      onOk: () => deleteSession(sessionId),
    });
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchSessions();
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
        message.success(t("home.deleteSuccess") || "Session deleted successfully");
      }
    } catch (error) {
      console.error("Failed to delete session", error);
      message.error(t("home.deleteFailed") || "Failed to delete session");
    }
  };

  const handleRetry = useCallback((messageId: string) => {
    // Retry logic needs access to messages state, but since we are in useCallback, we need to be careful.
    // However, if we pass handleRetry to memoized component, it should be stable.
    // We can't use closure 'messages' here effectively if it's stale.
    // Better to just let it re-create when messages change? 
    // Or use functional update.
    // For now, let's keep it simple. It will invalidate memo if messages change, which is fine.
    // Wait, if handleRetry changes on every render, MemoizedMessageList will re-render.
    // We need to use a ref or something.
    // Actually, retry is rare. Re-rendering is fine on retry.
    // The main issue is INPUT typing. 
    // On input typing, 'messages' DOES NOT change. So handleRetry doesn't need to change if it depends on messages?
    // Ah, 'messages' is a dependency of handleRetry.
    // If messages don't change, handleRetry doesn't change.
    // So it's fine.
  }, [messages]); 

  const realHandleRetry = (messageId: string) => {
     const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    
    const msg = messages[msgIndex];
    if (msg.role !== 'assistant') return;

    // Find preceding user message
    let userMsgIndex = -1;
    for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
            userMsgIndex = i;
            break;
        }
    }

    if (userMsgIndex !== -1) {
        const userContent = messages[userMsgIndex].content;
        handleSendMessage(userContent);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop === 0 && hasMore && !isLoadingHistory && currentSessionId) {
        loadHistory(currentSessionId, offset, false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    const startTime = Date.now();
    let ttfb: number | undefined;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          session_id: currentSessionId,
          query: text,
          stream: isStream
        })
      });

      if (!res.ok) {
        console.error("Chat request failed");
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: t("common.systemError"),
            timestamp: Date.now(),
            isError: true
        }]);
        setIsProcessing(false);
        return;
      }

      if (isStream && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistantMsg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: '',
          timestamp: Date.now()
        };
        
        setMessages(prev => [...prev, assistantMsg]);
        
        let buffer = '';
        let hasContent = false;
        
        while (true) {
          try {
            const { done, value } = await reader.read();
            if (done) break;
            
            if (ttfb === undefined) {
              ttfb = Date.now() - startTime;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                if (dataStr === '[DONE]') continue;
                
                try {
                  const data = JSON.parse(dataStr);
                  if (data.content) {
                    hasContent = true;
                    assistantMsg = {
                      ...assistantMsg,
                      content: assistantMsg.content + data.content,
                      ttft: ttfb
                    };
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMsg.id ? assistantMsg : msg
                    ));
                  }
                  if (data.metadata) {
                    assistantMsg = {
                      ...assistantMsg,
                      latency: data.metadata.latency?.total_ms,
                      ttft: data.metadata.latency?.ttft_ms || ttfb,
                      intent: data.metadata.route,
                      metadata: data.metadata
                    };
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMsg.id ? assistantMsg : msg
                    ));
                    
                    if (!currentSessionId && data.metadata.trace_id) {
                      fetchSessions();
                    }
                  }
                } catch (e) {
                  console.error("Error parsing stream data", e);
                }
              }
            }
          } catch (readError) {
             console.error("Stream read error", readError);
             setMessages(prev => prev.map(msg => 
                msg.id === assistantMsg.id ? { ...msg, content: t("common.systemError"), isError: true } : msg
             ));
             break;
          }
        }
        
        if (!hasContent && assistantMsg.content === '') {
             setMessages(prev => prev.map(msg => 
                msg.id === assistantMsg.id ? { ...msg, content: t("common.systemError"), isError: true } : msg
             ));
        }

      } else {
        const data = await res.json();
        const result = data.data;
        
        if (!result || !result.content) {
             setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: t("common.systemError"),
                timestamp: Date.now(),
                isError: true
            }]);
            return;
        }

        if (!currentSessionId && result.metadata?.trace_id) {
           fetchSessions();
        }

        const assistantMsg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: result.content,
          timestamp: Date.now(),
          latency: result.metadata?.latency?.total_ms,
          intent: result.metadata?.route,
          metadata: result.metadata
        };
        
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (error) {
      console.error("Chat error", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: t("common.systemError"),
        timestamp: Date.now(),
        isError: true
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const getSessionMenuItems = (session: Session): MenuProps['items'] => [
    {
      key: 'rename',
      label: t("home.rename"),
      icon: <EditOutlined />,
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        setSessionToRename(session);
        setNewName(session.name);
        setIsRenameDialogOpen(true);
      }
    },
    {
      key: 'delete',
      label: t("home.deleteSession"),
      icon: <DeleteOutlined />,
      danger: true,
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        confirmDeleteSession(session.id);
      }
    }
  ];

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider 
        width={260} 
        theme="light" 
        style={{ 
          borderRight: `1px solid ${token.colorBorder}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: 16, borderBottom: `1px solid ${token.colorBorder}` }}>
               <AutoComplete
                 style={{ width: '100%' }}
                 placeholder={t("home.searchPlaceholder")}
                 value={searchQuery}
                 onChange={(value) => setSearchQuery(value)}
                 onSelect={(value, option) => selectSession(option.session_id, option.key)}
                 options={searchResults.map((result: any) => ({
                   value: result.session_name,
                   label: (
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <Text strong ellipsis>{result.session_name}</Text>
                       <Text type="secondary" ellipsis style={{ fontSize: 12 }}>{result.content}</Text>
                     </div>
                   ),
                   key: result.id,
                   session_id: result.session_id
                 }))}
                 backfill={false}
               >
                 <Input.Search allowClear />
               </AutoComplete>
            </div>
            
            <div style={{ padding: 16 }}>
              <Button onClick={createSession} block icon={<PlusOutlined />} type="primary">
                {t("home.newChat")}
              </Button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
                {sessions.map(session => (
                  <div 
                    key={session.id}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 8,
                        borderRadius: token.borderRadius,
                        cursor: 'pointer',
                        marginBottom: 4,
                        backgroundColor: currentSessionId === session.id ? token.colorPrimaryBg : 'transparent',
                        color: currentSessionId === session.id ? token.colorPrimary : token.colorTextSecondary
                    }}
                    onMouseEnter={(e) => {
                        if (currentSessionId !== session.id) e.currentTarget.style.backgroundColor = token.colorFillTertiary;
                    }}
                    onMouseLeave={(e) => {
                        if (currentSessionId !== session.id) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    onClick={() => selectSession(session.id)}
                  >
                    <Space style={{ overflow: 'hidden', flex: 1 }}>
                      <MessageOutlined />
                      <Text ellipsis style={{ fontSize: 14, color: 'inherit' }}>{session.name}</Text>
                    </Space>
                    
                    <Dropdown menu={{ items: getSessionMenuItems(session) }} trigger={['click']}>
                      <Button 
                        type="text" 
                        size="small" 
                        icon={<MoreOutlined />} 
                        onClick={(e) => e.stopPropagation()}
                        style={{ opacity: 0.5 }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                      />
                    </Dropdown>
                  </div>
                ))
              }
            </div>
        </div>
      </Sider>

      <Layout>
        <Header 
            style={{ 
                padding: '0 24px', 
                background: token.colorBgContainer, 
                borderBottom: `1px solid ${token.colorBorder}`, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                height: 64
            }}
        >
           <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
             <Title level={4} style={{ margin: 0 }}>
               {sessions.find(s => s.id === currentSessionId)?.name || t("home.newChat")}
             </Title>
           </div>
           <Space>
             <LanguageToggle />
           </Space>
        </Header>

        <Content style={{ padding: 24, display: 'flex', gap: 24, overflow: 'hidden', background: token.colorBgLayout }}>
           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900, margin: '0 auto', width: '100%', height: '100%' }}>
              {/* Chat History & Input */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
                 <div 
                   ref={chatContainerRef} 
                   onScroll={handleScroll} 
                   style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}
                 >
                    {isLoadingHistory && messages.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
                            <Spin />
                        </div>
                    )}
                    
                    <MessageList 
                      messages={messages} 
                      token={token} 
                      t={t} 
                      handleRetry={realHandleRetry}
                      isProcessing={isProcessing}
                    />

                    <div ref={chatEndRef} />
                 </div>

                 <div style={{ padding: '0 4px' }}>
                    <div style={{ 
                        border: `1px solid ${token.colorBorder}`, 
                        borderRadius: 12, 
                        backgroundColor: token.colorBgContainer,
                        padding: 12,
                        boxShadow: token.boxShadowTertiary
                    }}>
                        <Input.TextArea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(input);
                                }
                            }}
                            placeholder={t("home.inputPlaceholder")}
                            autoSize={{ minRows: 1, maxRows: 6 }}
                            bordered={false}
                            style={{ resize: 'none', marginBottom: 8 }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Checkbox 
                                checked={isStream} 
                                onChange={(e) => setIsStream(e.target.checked)}
                            >
                                {t("home.streamResponse")}
                            </Checkbox>
                            <Button 
                                type="primary" 
                                icon={<SendOutlined />} 
                                onClick={() => handleSendMessage(input)}
                                loading={isProcessing}
                                disabled={!input.trim()}
                            >
                                {t("chat.send")}
                            </Button>
                        </div>
                    </div>
                 </div>
              </div>
           </div>
           
           <div style={{ width: 400, display: 'flex', flexDirection: 'column' }}>
              <JsonLogger 
                messages={messages.filter(m => m.timestamp > logClearTimestamp)} 
                onClear={() => setLogClearTimestamp(Date.now())} 
              />
           </div>
        </Content>
      </Layout>

      <Modal
        title={t("home.renameSession")}
        open={isRenameDialogOpen}
        onOk={renameSession}
        onCancel={() => setIsRenameDialogOpen(false)}
        okText={t("home.save")}
        cancelText={t("home.cancel")}
      >
        <Input 
          value={newName} 
          onChange={(e) => setNewName(e.target.value)} 
          onPressEnter={renameSession}
        />
      </Modal>
    </Layout>
  );
}
