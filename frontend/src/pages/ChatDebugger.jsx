import React, { useState, useRef, useEffect } from 'react';
import { Send, Clock, Map, Cpu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MessageBubble = ({ role, content, metadata }) => {
  const isUser = role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`max-w-[80%] ${isUser ? 'order-1' : 'order-2'}`}>
        <div 
          className={`p-4 rounded-lg text-sm leading-relaxed ${
            isUser 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-secondary text-secondary-foreground border border-border'
          }`}
        >
          {content}
        </div>
        
        {!isUser && metadata && (
          <div className="mt-2 text-xs text-muted-foreground grid grid-cols-2 gap-2 bg-muted/30 p-2 rounded border border-border/50">
            <div className="flex items-center gap-1" title="Latency">
              <Clock className="h-3 w-3" />
              <span>{metadata.latency?.total_ms || 0}ms</span>
            </div>
            <div className="flex items-center gap-1" title="Route">
              <Map className="h-3 w-3" />
              <span className="uppercase">{metadata.route}</span>
            </div>
            <div className="flex items-center gap-1 col-span-2" title="Models">
              <Cpu className="h-3 w-3" />
              <span>{metadata.models_used?.executor || 'N/A'}</span>
            </div>
            {metadata.trace_id && (
              <div className="col-span-2 font-mono opacity-50 truncate" title="Trace ID">
                ID: {metadata.trace_id}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ChatDebugger = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

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
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: `debug_${Date.now()}`,
          query: userMsg.content,
          user_id: 'admin_debugger',
          stream: false // TODO: Enable streaming when backend supports it
        })
      });

      const data = await response.json();
      
      if (data.code === 0) {
        const aiMsg = {
          role: 'assistant',
          content: data.data.content,
          metadata: data.data.metadata
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error(data.detail || 'Unknown error');
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${error.message}`,
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-4">
      <Card className="flex-1 flex flex-col overflow-hidden border-border shadow-sm">
        <CardHeader className="border-b border-border py-4 bg-muted/10">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Live Chat Debugger
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <Cpu className="h-12 w-12 mb-4" />
              <p>Start a conversation to debug the pipeline</p>
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
              placeholder="Type a message to test..."
              className="flex-1"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default ChatDebugger;
