import { Message } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useRef } from 'react';

interface JsonLoggerProps {
  messages: Message[];
}

export default function JsonLogger({ messages }: JsonLoggerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <div className="glass-card h-full flex flex-col min-h-[300px]">
      <h3 className="text-lg font-semibold mb-4 text-white/90 font-mono">System Logs</h3>
      
      <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
        <div className="space-y-4 font-mono text-xs">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              <div className="flex items-center gap-2 text-white/40">
                <span>[{new Date(msg.timestamp).toLocaleTimeString()}]</span>
                <span className={
                  msg.role === 'user' ? 'text-blue-400' : 
                  msg.role === 'assistant' ? 'text-green-400' : 'text-yellow-400'
                }>
                  {msg.role.toUpperCase()}
                </span>
                {msg.intent && (
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/60 text-[10px]">
                    INTENT: {msg.intent}
                  </span>
                )}
              </div>
              
              <div className="pl-4 border-l border-white/10 space-y-2">
                <div className="text-white/80">{msg.content}</div>
                
                {msg.functionCall && (
                  <div className="bg-black/30 rounded p-2 text-green-300/90 overflow-x-auto">
                    <div className="text-purple-400 mb-1">Function Call: {msg.functionCall.name}</div>
                    <pre>{JSON.stringify(msg.functionCall.arguments, null, 2)}</pre>
                  </div>
                )}
                
                {msg.latency && (
                  <div className="text-[10px] text-white/30">
                    Latency: {msg.latency}ms | Confidence: {msg.confidence ?? 0.95}
                  </div>
                )}
                
                {msg.metadata && (
                  <div className="mt-2 p-2 bg-black/40 rounded text-[10px] font-mono overflow-x-auto">
                    <div className="text-blue-300 mb-1">Full Link Details:</div>
                    <pre className="text-white/60">{JSON.stringify(msg.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {messages.length === 0 && (
            <div className="text-white/20 text-center py-10 italic">
              Waiting for input...
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
