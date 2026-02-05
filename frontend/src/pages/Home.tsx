import { useState, useEffect, useRef, memo } from 'react';
import { Button, Input, Dropdown, MenuProps, Tooltip, Checkbox, Spin, theme, App, Layout, Typography, Space, Modal, AutoComplete, Form, Select, Switch, Row, Col,Card, Popconfirm } from 'antd';
import { SendOutlined, PlusOutlined, MessageOutlined, MoreOutlined, DeleteOutlined, EditOutlined, ReloadOutlined, SettingOutlined, LikeOutlined, DislikeOutlined, LikeFilled, DislikeFilled } from "@ant-design/icons";
import { api } from '@/lib/api';

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
  timezone?: string;
}

const TIMEZONE_OPTIONS = [
    { label: 'Asia/Shanghai (UTC+8)', value: 'Asia/Shanghai' },
    { label: 'UTC', value: 'UTC' },
    { label: 'Asia/Tokyo (UTC+9)', value: 'Asia/Tokyo' },
    { label: 'America/New_York (UTC-5/UTC-4)', value: 'America/New_York' },
    { label: 'America/Los_Angeles (UTC-8/UTC-7)', value: 'America/Los_Angeles' },
    { label: 'Europe/London (UTC+0/UTC+1)', value: 'Europe/London' },
    { label: 'Europe/Paris (UTC+1/UTC+2)', value: 'Europe/Paris' },
    { label: 'Australia/Sydney (UTC+10/UTC+11)', value: 'Australia/Sydney' },
];

const LANGUAGE_OPTIONS = [
    { label: '中文 (简体)', value: 'zh' },
    { label: '中文 (繁體)', value: 'zh_TW' },
    { label: 'English', value: 'en' },
    { label: '日本語', value: 'ja' },
    { label: 'Deutsch', value: 'de' },
    { label: '한국어', value: 'ko' },
];

const PROVIDER_OPTIONS = [
    { label: 'Default', value: '' },
    { label: 'OpenAI', value: 'openai' },
    { label: 'Qwen', value: 'qwen' },
    { label: 'Minimax', value: 'minimax' },
    { label: 'Spark', value: 'spark' },
    { label: 'Google', value: 'google' },
    { label: 'Deepseek', value: 'deepseek' },
    { label: 'Zhipu', value: 'zhipu' },
    { label: 'Baidu', value: 'baidu' },
];

const MODEL_OPTIONS: Record<string, { label: string, value: string }[]> = {
    openai: [
        { label: 'GPT-5.2', value: 'gpt-5.2' },
        { label: 'GPT-5.2 Codex', value: 'gpt-5.2-codex' },
        { label: 'GPT-4o', value: 'gpt-4o' },
    ],
    qwen: [
        { label: 'Qwen Max (Latest)', value: 'qwen-max' },
        { label: 'Qwen Plus', value: 'qwen-plus' },
        { label: 'Qwen Flash', value: 'qwen-flash' },
    ],
    minimax: [
        { label: 'MiniMax-Text-01 (Speed)', value: 'minimax-text-01' },
        { label: 'ABAB 6.5s (Chat)', value: 'abab6.5s-chat' },
        { label: '⚠️ MiniMax-M2.1 (Not Recommended)', value: 'minimax-m2.1' },
        { label: '⚠️ MiniMax-M2.1 Lightning (Not Recommended)', value: 'minimax-m2.1-lightning' },
    ],
    spark: [
        { label: 'Spark X1', value: 'spark-x1' },
        { label: 'Spark 4.0 Ultra', value: 'spark-4.0-ultra' },
    ],
    google: [
        { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
        { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    ],
    deepseek: [
        { label: 'DeepSeek V3.2', value: 'deepseek-chat' },
        { label: 'DeepSeek R1', value: 'deepseek-reasoner' },
    ],
    zhipu: [
        { label: 'GLM-4 Plus', value: 'glm-4-plus' },
        { label: 'GLM-4 Flash', value: 'glm-4-flash' },
        { label: 'GLM-4 Long', value: 'glm-4-long' },
    ],
    baidu: [
        { label: 'ERNIE 4.0 8K', value: 'ernie-4.0-8k-latest' },
        { label: 'ERNIE 3.5 8K', value: 'ernie-3.5-8k' },
        { label: 'ERNIE Speed 8K', value: 'ernie-speed-8k' },
        { label: 'ERNIE Lite 8K', value: 'ernie-lite-8k' },
        { label: 'ERNIE Tiny 8K', value: 'ernie-tiny-8k' },
        { label: 'ERNIE Speed 128K', value: 'ernie-speed-128k' },
    ]
};

const BATCH_SIZE = 20;

// Memoized Message Item Component
const MessageItem = memo(({ msg, token, t, handleRetry, onFeedback, timezone = 'Asia/Shanghai' }: { 
  msg: Message, 
  token: any, 
  t: any, 
  handleRetry: (id: string) => void,
  onFeedback: (id: string, feedback: 'like' | 'dislike') => void,
  timezone?: string
}) => {
  const timeStr = new Intl.DateTimeFormat('default', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
  }).format(new Date(msg.timestamp));

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
        <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4, display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 8 }}>
              <span>
                  {msg.ttft !== undefined ? (
                      <>
                          {t("chat.ttft")}: {msg.ttft}ms | {t("chat.totalLatency")}: {msg.latency || '-'}ms
                      </>
                  ) : (
                      <>
                          {t("chat.totalLatency")}: {msg.latency}ms
                      </>
                  )}
                   | {t("chat.route")}: {msg.intent}
              </span>
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

      {msg.role === 'assistant' && !msg.isError && msg.intent === 'instruction' && (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
            <Tooltip title={t("feedback.like")}>
              <Button 
                type="text" 
                size="small" 
                icon={msg.feedback === 'like' ? <LikeFilled style={{ color: '#52c41a' }} /> : <LikeOutlined style={{ color: token.colorTextDescription }} />} 
                onClick={() => onFeedback(msg.id, 'like')}
              />
            </Tooltip>
            <Tooltip title={t("feedback.dislike")}>
              <Button 
                type="text" 
                size="small" 
                icon={msg.feedback === 'dislike' ? <DislikeFilled style={{ color: '#ff4d4f' }} /> : <DislikeOutlined style={{ color: token.colorTextDescription }} />} 
                onClick={() => onFeedback(msg.id, 'dislike')}
              />
            </Tooltip>
          </div>
       )}
    </div>
  );
}, (prev, next) => {
  return prev.msg.id === next.msg.id && 
         prev.msg.content === next.msg.content && 
         prev.msg.latency === next.msg.latency &&
         prev.msg.ttft === next.msg.ttft &&
         prev.msg.isError === next.msg.isError &&
         prev.msg.feedback === next.msg.feedback &&
         prev.token.colorPrimary === next.token.colorPrimary &&
         prev.timezone === next.timezone;
});

// Memoized Message List Component
const MessageList = memo(({ messages, token, t, handleRetry, isProcessing, onFeedback, timezone }: { 
  messages: Message[], 
  token: any, 
  t: any, 
  handleRetry: (id: string) => void, 
  isProcessing: boolean,
  onFeedback: (id: string, feedback: 'like' | 'dislike') => void,
  timezone?: string
}) => {
  return (
    <>
      {messages.map(msg => (
        <MessageItem 
          key={msg.id} 
          msg={msg} 
          token={token} 
          t={t} 
          handleRetry={handleRetry} 
          onFeedback={onFeedback}
          timezone={timezone}
        />
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
  const [sessionToConfig, setSessionToConfig] = useState<Session | null>(null);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [configForm] = Form.useForm();
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

  const selectedRepoId = Form.useWatch('INSTRUCTION_REPO_ID', configForm);
  const selectedLanguage = Form.useWatch('language', configForm);
  const [instructionRepos, setInstructionRepos] = useState<any[]>([]);

  const selectedRepo = instructionRepos.find(r => r.id === selectedRepoId);
  const isLanguageMismatch = selectedRepo && selectedRepo.language && selectedLanguage && selectedRepo.language !== selectedLanguage;

  useEffect(() => {
    fetchSessions();
    fetchInstructionRepos();
  }, []);

  const fetchInstructionRepos = async () => {
    try {
      const repos = await api.instructionRepos.list();
      setInstructionRepos(repos);
    } catch (error) {
      console.error("Failed to load instruction repos", error);
    }
  };

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

  const currentSession = sessions.find(s => s.id === currentSessionId);

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

  const createSession = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/v1/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const newSession = await res.json();
        setSessions(prev => [newSession, ...prev]);
        selectSession(newSession.id);
        // Open config dialog immediately for the new session
        // openConfigDialog(newSession); // Optional: if we want to force config
      }
    } catch (error) {
      console.error("Failed to create session", error);
    }
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


  const openConfigDialog = async (session: Session) => {
      setSessionToConfig(session);
      setIsConfigDialogOpen(true);
      configForm.resetFields();
      fetchInstructionRepos();
      try {
          const token = localStorage.getItem("token");
          const res = await fetch(`/api/v1/sessions/${session.id}/config`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
              const data = await res.json();
              configForm.setFieldsValue(data);
          }
      } catch (e) {
          console.error("Failed to load config", e);
      }
  };

  const saveConfig = async () => {
      if (!sessionToConfig) return;
      try {
          const values = await configForm.validateFields();
          const token = localStorage.getItem("token");
          const res = await fetch(`/api/v1/sessions/${sessionToConfig.id}/config`, {
              method: "PUT",
              headers: { 
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}` 
              },
              body: JSON.stringify(values)
          });
          if (res.ok) {
              message.success(t("home.configSaved") || "Configuration saved");
              setIsConfigDialogOpen(false);
              // Refresh sessions to update timezone in currentSession
              fetchSessions();
          } else {
              message.error("Failed to save configuration");
          }
      } catch (e) {
          console.error("Failed to save config", e);
      }
  };

  const confirmDeleteSession = (sessionId: string) => {
    modal.confirm({
      title: t("home.deleteSession"),
      content: t("home.deleteSessionConfirm") || "Are you sure you want to delete this session?",
      okText: t("home.confirm"),
      cancelText: t("home.cancel"),
      okType: 'danger',
      maskClosable: false,
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
        const newSessions = sessions.filter(s => s.id !== sessionId);
        setSessions(newSessions);

        if (currentSessionId === sessionId) {
            if (newSessions.length > 0) {
                selectSession(newSessions[0].id);
            } else {
                setCurrentSessionId(null);
                setMessages([]);
            }
        }
        message.success(t("home.deleteSuccess") || "Session deleted successfully");
      }
    } catch (error) {
      console.error("Failed to delete session", error);
      message.error(t("home.deleteFailed") || "Failed to delete session");
    }
  };

 

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

  const handleFeedback = async (messageId: string, feedback: 'like' | 'dislike') => {
    // Safety check for temporary IDs (timestamp-based)
    if (messageId.length < 32 && !messageId.includes('-')) {
        message.warning(t("feedback.waitId") || "Please wait for message ID to synchronize...");
        return;
    }

    try {
      await api.feedback.submit(messageId, feedback);
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, feedback } : msg
      ));
      message.success(t("feedback.success") || "Feedback submitted");
    } catch (error) {
      console.error("Feedback failed", error);
      message.error(t("feedback.error") || "Failed to submit feedback");
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    const startTime = Date.now();
    let ttfb: number | undefined;

    const tempUserMsgId = Date.now().toString();
    const userMsg: Message = {
      id: tempUserMsgId,
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
        const tempAssistantId = Date.now().toString();
        let assistantMsg: Message = {
          id: tempAssistantId,
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
                      msg.id === tempAssistantId ? assistantMsg : msg
                    ));
                  }
                  if (data.metadata) {
                    const realAssistantId = data.metadata.message_id;
                    const realUserId = data.metadata.reply_to;
                    
                    assistantMsg = {
                      ...assistantMsg,
                      id: realAssistantId || assistantMsg.id,
                      latency: data.metadata.latency?.total_ms,
                      ttft: data.metadata.latency?.ttft_ms || ttfb,
                      intent: data.metadata.route,
                      metadata: data.metadata
                    };
                    
                    setMessages(prev => prev.map(msg => {
                      if (msg.id === tempAssistantId) {
                          return assistantMsg;
                      }
                      if (msg.id === tempUserMsgId && realUserId) {
                          return { ...msg, id: realUserId };
                      }
                      return msg;
                    }));
                    
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
                msg.id === tempAssistantId ? { ...msg, content: t("common.systemError"), isError: true } : msg
             ));
             break;
          }
        }
        
        if (!hasContent && assistantMsg.content === '') {
             setMessages(prev => prev.map(msg => 
                msg.id === tempAssistantId ? { ...msg, content: t("common.systemError"), isError: true } : msg
             ));
        }

        // Refresh session list if the current session was "New Chat" to show the generated title
        const currentSession = sessions.find(s => s.id === currentSessionId);
        if (currentSession && (currentSession.name === "New Chat" || currentSession.name === "未命名会话")) {
            fetchSessions();
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

        const realAssistantId = result.metadata?.message_id;
        const realUserId = result.metadata?.reply_to;

        // Update User Message ID if available
        if (realUserId) {
            setMessages(prev => prev.map(msg => 
                msg.id === tempUserMsgId ? { ...msg, id: realUserId } : msg
            ));
        }

        const assistantMsg: Message = {
          id: realAssistantId || Date.now().toString(),
          role: 'assistant',
          content: result.content,
          timestamp: Date.now(),
          latency: result.metadata?.latency?.total_ms,
          ttft: result.metadata?.latency?.ttft_ms,
          intent: result.metadata?.route,
          metadata: result.metadata
        };
        
        setMessages(prev => [...prev, assistantMsg]);

        // Refresh session list if the current session was "New Chat"
        const currentSession = sessions.find(s => s.id === currentSessionId);
        if (currentSession && (currentSession.name === "New Chat" || currentSession.name === "未命名会话")) {
             fetchSessions();
        }
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
      key: 'config',
      label: t("home.config") || "Configuration",
      icon: <SettingOutlined />,
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        openConfigDialog(session);
      }
    },
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
                 onSelect={(_, option) => selectSession(option.session_id, option.key)}
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
            
            <div style={{ padding: 16, display: 'flex', gap: 8 }}>
              <Button onClick={createSession} block icon={<PlusOutlined />} type="primary" style={{ flex: 1 }}>
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
                      onFeedback={handleFeedback}
                      timezone={currentSession?.timezone}
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
                            variant="borderless"
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
        maskClosable={false}
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

      <Modal
        title={t("home.sessionConfig") || "Session Configuration"}
        open={isConfigDialogOpen}
        onCancel={() => setIsConfigDialogOpen(false)}
        width={1000}
        maskClosable={false}
        footer={[
          <Button key="cancel" onClick={() => setIsConfigDialogOpen(false)}>
            {t("home.cancel")}
          </Button>,
          isLanguageMismatch ? (
            <Popconfirm
              key="save-confirm"
              title={t("config.languageMismatchTitle") || "Language Mismatch"}
              description={t("config.languageMismatchDesc") || "The session language does not match the instruction repository language. This may affect recognition accuracy."}
              onConfirm={saveConfig}
              okText={t("common.confirm")}
              cancelText={t("common.cancel")}
            >
              <Button key="save" type="primary">
                {t("home.save")}
              </Button>
            </Popconfirm>
          ) : (
            <Button key="save" type="primary" onClick={saveConfig}>
              {t("home.save")}
            </Button>
          )
        ]}
      >
        <Form form={configForm} layout="vertical">
            <Row gutter={16}>
                <Col span={12}>
                    <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
                        <Card size="small" title={t("config.intentClassification") || "Intent Classification"}>
                            <Row gutter={12}>
                                <Col span={12}>
                                    <Form.Item name="INTENT_LLM_PROVIDER" label={t("config.provider") || "Provider"} style={{ marginBottom: 0 }}>
                                        <Select 
                                            options={PROVIDER_OPTIONS} 
                                            allowClear
                                            onChange={() => configForm.setFieldValue('INTENT_LLM_MODEL', undefined)}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item 
                                        noStyle 
                                        shouldUpdate={(prev, current) => prev.INTENT_LLM_PROVIDER !== current.INTENT_LLM_PROVIDER}
                                    >
                                        {({ getFieldValue }) => {
                                            const provider = getFieldValue('INTENT_LLM_PROVIDER');
                                            return (
                                                <Form.Item name="INTENT_LLM_MODEL" label={t("config.model") || "Model"} style={{ marginBottom: 0 }}>
                                                    <Select options={provider ? MODEL_OPTIONS[provider] || [] : []} disabled={!provider} allowClear />
                                                </Form.Item>
                                            );
                                        }}
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                        <Card size="small" title={t("config.instructionParsing") || "Instruction Parsing"}>
                            <Form.Item 
                                name="INSTRUCTION_REPO_ID" 
                                label={t("config.instructionRepo") || "Instruction Repository"} 
                                rules={[{ required: true, message: t("config.repoRequired") || "Required" }]}
                                style={{ marginBottom: 16 }}
                            >
                                <Select 
                                    placeholder={t("config.selectRepo")}
                                    options={instructionRepos.map(repo => ({ label: repo.name, value: repo.id }))}
                                />
                            </Form.Item>
                            <Row gutter={12}>
                                <Col span={12}>
                                    <Form.Item name="INSTRUCTION_LLM_PROVIDER" label={t("config.provider") || "Provider"} style={{ marginBottom: 0 }}>
                                        <Select 
                                            options={PROVIDER_OPTIONS} 
                                            allowClear
                                            onChange={() => configForm.setFieldValue('INSTRUCTION_LLM_MODEL', undefined)}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item 
                                        noStyle 
                                        shouldUpdate={(prev, current) => prev.INSTRUCTION_LLM_PROVIDER !== current.INSTRUCTION_LLM_PROVIDER}
                                    >
                                        {({ getFieldValue }) => {
                                            const provider = getFieldValue('INSTRUCTION_LLM_PROVIDER');
                                            return (
                                                <Form.Item name="INSTRUCTION_LLM_MODEL" label={t("config.model") || "Model"} style={{ marginBottom: 0 }}>
                                                    <Select options={provider ? MODEL_OPTIONS[provider] || [] : []} disabled={!provider} allowClear />
                                                </Form.Item>
                                            );
                                        }}
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                        <Card
                            size="small"
                            title={t("config.ragGeneration") || "RAG Generation"}
                            extra={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Typography.Text style={{ fontSize: 12 }}>{t("config.ragEnable") || "Enable RAG"}</Typography.Text>
                                    <Form.Item name="RAG_ENABLE" valuePropName="checked" noStyle>
                                        <Switch
                                            size="small"
                                            onChange={(checked) => {
                                                if (!checked) {
                                                    configForm.setFieldValue('RAG_LLM_PROVIDER', undefined);
                                                    configForm.setFieldValue('RAG_LLM_MODEL', undefined);
                                                }
                                            }}
                                        />
                                    </Form.Item>
                                </div>
                            }
                        >
                            <Form.Item noStyle shouldUpdate={(prev, current) => prev.RAG_ENABLE !== current.RAG_ENABLE || prev.RAG_LLM_PROVIDER !== current.RAG_LLM_PROVIDER}>
                                {({ getFieldValue }) => {
                                    const ragEnabled = getFieldValue('RAG_ENABLE');
                                    const provider = getFieldValue('RAG_LLM_PROVIDER');
                                    return (
                                        <Row gutter={12}>
                                            <Col span={12}>
                                                <Form.Item name="RAG_LLM_PROVIDER" label={t("config.provider") || "Provider"} style={{ marginBottom: 0 }}>
                                                    <Select 
                                                        options={PROVIDER_OPTIONS} 
                                                        disabled={!ragEnabled} 
                                                        allowClear
                                                        onChange={() => configForm.setFieldValue('RAG_LLM_MODEL', undefined)}
                                                    />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item name="RAG_LLM_MODEL" label={t("config.model") || "Model"} style={{ marginBottom: 0 }}>
                                                    <Select options={provider ? MODEL_OPTIONS[provider] || [] : []} disabled={!ragEnabled || !provider} allowClear />
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                    );
                                }}
                            </Form.Item>
                        </Card>
                    </Space>
                </Col>
                
                <Col span={12}>
                    <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
                        <Card size="small" title={t("config.chat") || "Chat"}>
                            <Row gutter={12}>
                                <Col span={12}>
                                    <Form.Item name="CHAT_LLM_PROVIDER" label={t("config.provider") || "Provider"} style={{ marginBottom: 0 }}>
                                        <Select options={PROVIDER_OPTIONS} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item 
                                        noStyle 
                                        shouldUpdate={(prev, current) => prev.CHAT_LLM_PROVIDER !== current.CHAT_LLM_PROVIDER}
                                    >
                                        {({ getFieldValue }) => {
                                            const provider = getFieldValue('CHAT_LLM_PROVIDER');
                                            return (
                                                <Form.Item name="CHAT_LLM_MODEL" label={t("config.model") || "Model"} style={{ marginBottom: 0 }}>
                                                    <Select options={provider ? MODEL_OPTIONS[provider] || [] : []} disabled={!provider} />
                                                </Form.Item>
                                            );
                                        }}
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                        <Card size="small" title={t("config.searchSummary") || "Search Summary"}>
                            <Row gutter={12}>
                                <Col span={12}>
                                    <Form.Item name="SEARCH_LLM_PROVIDER" label={t("config.provider") || "Provider"} style={{ marginBottom: 0 }}>
                                        <Select options={PROVIDER_OPTIONS} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item 
                                        noStyle 
                                        shouldUpdate={(prev, current) => prev.SEARCH_LLM_PROVIDER !== current.SEARCH_LLM_PROVIDER}
                                    >
                                        {({ getFieldValue }) => {
                                            const provider = getFieldValue('SEARCH_LLM_PROVIDER');
                                            return (
                                                <Form.Item name="SEARCH_LLM_MODEL" label={t("config.model") || "Model"} style={{ marginBottom: 0 }}>
                                                    <Select options={provider ? MODEL_OPTIONS[provider] || [] : []} disabled={!provider} />
                                                </Form.Item>
                                            );
                                        }}
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                        <Card size="small" title={t("config.general") || "General Settings"}>
                             <Row gutter={12}>
                                <Col span={12}>
                                    <Form.Item name="timezone" label={t("config.timezone") || "Timezone"} style={{ marginBottom: 0 }}>
                                        <Select options={TIMEZONE_OPTIONS} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="language" label={t("config.language") || "Language"} style={{ marginBottom: 0 }}>
                                        <Select options={LANGUAGE_OPTIONS} />
                                    </Form.Item>
                                </Col>
                             </Row>
                        </Card>
                    </Space>
                </Col>
            </Row>
        </Form>
      </Modal>
    </Layout>
  );
}