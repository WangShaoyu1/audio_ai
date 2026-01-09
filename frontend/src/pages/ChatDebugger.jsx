import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Clock, Map, Cpu, Search, Plus, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';

const MessageBubble = ({ role, content, metadata }) => {
  const isUser = role === 'user';
  const { t } = useTranslation();
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`max-w-[80%] ${isUser ? 'order-1' : 'order-2'}`}>
        <div 
          className={`p-4 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${
            isUser 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-secondary text-secondary-foreground border border-border'
          }`}
        >
          {content}
        </div>
        
        {!isUser && metadata && (
          <div className="mt-1 text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-border/50">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-1" title={t('chat.latency')}>
                <Clock className="h-3 w-3" />
                <span>{metadata.latency?.total_ms || 0}ms</span>
              </div>
              <div className="flex items-center gap-1" title={t('chat.route')}>
                <Map className="h-3 w-3" />
                <span className="uppercase font-semibold text-primary">{metadata.route}</span>
              </div>
              <div className="flex items-center gap-1" title={t('chat.model')}>
                <Cpu className="h-3 w-3" />
                <span>{metadata.models_used?.executor || 'N/A'}</span>
              </div>
              {metadata.search_results?.length > 0 && (
                <div className="col-span-2 text-blue-500 flex items-center gap-1">
                  <Search className="h-3 w-3" />
                  <span>{metadata.search_results.length} sources found</span>
                </div>
              )}
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ChatDebugger = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Session Management
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]); // Current session messages

  useEffect(() => {
    // Load sessions from local storage (Mock persistence)
    const savedSessions = JSON.parse(localStorage.getItem('chat_sessions') || '[]');
    if (savedSessions.length > 0) {
      setSessions(savedSessions);
      setCurrentSessionId(savedSessions[0].id);
      setMessages(savedSessions[0].messages || []);
    } else {
      createNewSession();
    }
  }, []);

  useEffect(() => {
    // Save sessions to local storage whenever they change
    if (sessions.length > 0) {
      localStorage.setItem('chat_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  const createNewSession = () => {
    const newSession = {
      id: crypto.randomUUID(),
      title: `New Chat ${new Date().toLocaleTimeString()}`,
      messages: []
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages([]);
  };

  const switchSession = (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
    }
  };

  const deleteSession = (e, sessionId) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(newSessions);
    if (currentSessionId === sessionId) {
      if (newSessions.length > 0) {
        switchSession(newSessions[0].id);
      } else {
        createNewSession();
      }
    }
  };

  const updateCurrentSessionMessages = (newMessages) => {
    setMessages(newMessages);
    setSessions(prev => prev.map(s =>
      s.id === currentSessionId ? { ...s, messages: newMessages } : s
    ));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    updateCurrentSessionMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const data = await api.post('/chat/completions', {
        session_id: currentSessionId,
        query: userMsg.content,
        stream: false
      });

      if (data.code === 0) {
        const aiMsg = {
          role: 'assistant',
          content: data.data.content,
          metadata: data.data.metadata
        };
        updateCurrentSessionMessages([...newMessages, aiMsg]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      updateCurrentSessionMessages([...newMessages, {
        role: 'assistant',
        content: `${t('common.error')}: ${error.message}`,
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-7rem)] flex gap-4">
      {/* Sidebar: Session List */}
      <Card className="w-64 flex flex-col border-border shadow-sm">
        <CardHeader className="p-4 border-b border-border">
          <Button onClick={createNewSession} className="w-full justify-start gap-2" variant="outline">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.map(session => (
              <div
                key={session.id}
                onClick={() => switchSession(session.id)}
                className={`group flex items-center justify-between p-2 rounded-md text-sm cursor-pointer transition-colors ${
                  currentSessionId === session.id 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="h-4 w-4" />
                  <span className="truncate max-w-[120px]">{session.title}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => deleteSession(e, session.id)}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden border-border shadow-sm">
        <CardHeader className="border-b border-border py-4 bg-muted/10">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t('chat.title')}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <Cpu className="h-12 w-12 mb-4" />
              <p>{t('chat.subtitle')}</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <MessageBubble key={idx} {...msg} />
          ))}
          
          {loading && (
            <div className="flex justify-start mb-6">
              <div className="bg-secondary text-secondary-foreground px-4 py-3 rounded-lg text-sm animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="p-4 border-t border-border bg-background">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('chat.placeholder')}
              className="flex-1"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4 mr-2" />
              {t('chat.send')}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default ChatDebugger;
