import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Search, Clock, Code, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
  timestamp: number;
}

interface Session {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: number;
}

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(`sess_${Date.now()}`);
  const [showMetadata, setShowMetadata] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post('/api/v1/chat/completions', {
        query: userMsg.content,
        session_id: selectedSessionId,
        user_id: 'admin_user',
        stream: false // TODO: Support stream
      });

      const data = response.data;
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        metadata: data.metadata,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Chat failed:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Error: Failed to get response from server.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Left: Session List (Simplified) */}
      <div className="w-64 border-r border-border bg-card/50 p-4 hidden md:block">
        <div className="mb-4">
          <button 
            onClick={() => {
              setSelectedSessionId(`sess_${Date.now()}`);
              setMessages([]);
            }}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            + New Chat
          </button>
        </div>
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-secondary/50 text-sm cursor-pointer border border-border">
            <div className="font-medium truncate">Current Session</div>
            <div className="text-xs text-muted-foreground truncate">{selectedSessionId}</div>
          </div>
        </div>
      </div>

      {/* Middle: Chat Area */}
      <div className="flex-1 flex flex-col relative">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <Bot className="w-12 h-12 mb-4" />
              <p>Start a conversation to test the AI</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-4 max-w-3xl mx-auto", msg.role === 'user' ? "justify-end" : "justify-start")}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
              )}
              
              <div className={cn("flex flex-col gap-1 max-w-[80%]", msg.role === 'user' ? "items-end" : "items-start")}>
                {/* Traceability Badges for AI */}
                {msg.role === 'assistant' && msg.metadata && (
                  <div className="flex flex-wrap gap-2 mb-1">
                    <Badge variant="outline" className="text-xs py-0 h-5 bg-background/50 border-blue-500/30 text-blue-400">
                      {msg.metadata.route?.toUpperCase()}
                    </Badge>
                    {msg.metadata.models_used?.executor && (
                      <Badge variant="outline" className="text-xs py-0 h-5 bg-background/50 border-green-500/30 text-green-400">
                        {msg.metadata.models_used.executor}
                      </Badge>
                    )}
                    {msg.metadata.latency?.total_ms && (
                      <Badge variant="outline" className="text-xs py-0 h-5 bg-background/50 border-orange-500/30 text-orange-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {msg.metadata.latency.total_ms}ms
                      </Badge>
                    )}
                  </div>
                )}

                <div className={cn(
                  "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                  msg.role === 'user' 
                    ? "bg-primary text-primary-foreground rounded-tr-sm" 
                    : "bg-card border border-border rounded-tl-sm"
                )}>
                  {msg.content}
                  
                  {/* Search Results Preview */}
                  {msg.metadata?.search_results?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Search className="w-3 h-3" />
                        Sources
                      </div>
                      <div className="space-y-2">
                        {msg.metadata.search_results.slice(0, 3).map((res: any, idx: number) => (
                          <a key={idx} href={res.href} target="_blank" rel="noopener noreferrer" 
                             className="block text-xs p-2 rounded bg-background/50 hover:bg-background transition-colors border border-transparent hover:border-border truncate">
                            <div className="font-medium text-blue-400 truncate">{res.title}</div>
                            <div className="text-muted-foreground truncate opacity-70">{res.body}</div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border bg-background/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              disabled={isLoading}
              className="w-full bg-secondary/50 border border-border rounded-full py-3 px-5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right: Metadata Panel */}
      {showMetadata && (
        <div className="w-80 border-l border-border bg-card/30 overflow-y-auto p-4 hidden lg:block">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Code className="w-4 h-4" />
              Trace Metadata
            </h3>
          </div>
          
          {messages.length > 0 ? (
            <div className="space-y-4">
              {[...messages].reverse().filter(m => m.role === 'assistant').map((msg) => (
                <div key={msg.id} className="space-y-2">
                  <div className="text-xs text-muted-foreground font-mono">
                    Response ID: {msg.id}
                  </div>
                  <pre className="text-[10px] bg-secondary/50 p-3 rounded-lg overflow-x-auto font-mono text-muted-foreground border border-border">
                    {JSON.stringify(msg.metadata, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-8">
              No metadata available
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Simple Badge Component
function Badge({ children, className, variant = 'default' }: any) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)}>
      {children}
    </span>
  );
}
