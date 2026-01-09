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
    <div className="bg-card border border-border rounded-xl h-full flex flex-col min-h-[300px] p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-4 text-foreground font-mono">System Logs</h3>
      
      <ScrollArea className="flex-1 pr-4 h-0" ref={scrollRef}>
        <div className="space-y-4 font-mono text-xs">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>[{new Date(msg.timestamp).toLocaleTimeString()}]</span>
                <span className={
                  msg.role === 'user' ? 'text-blue-500 dark:text-blue-400' : 
                  msg.role === 'assistant' ? 'text-green-500 dark:text-green-400' : 'text-yellow-500 dark:text-yellow-400'
                }>
                  {msg.role.toUpperCase()}
                </span>
                {msg.intent && (
                  <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">
                    INTENT: {msg.intent}
                  </span>
                )}
              </div>
              
              <div className="pl-4 border-l border-border space-y-2">
                <div className="text-foreground/80">{msg.content}</div>
                
                {msg.functionCall && (
                  <div className="bg-muted/50 rounded p-2 text-green-600 dark:text-green-300 overflow-x-auto">
                    <div className="text-purple-500 dark:text-purple-400 mb-1">Function Call: {msg.functionCall.name}</div>
                    <pre>{JSON.stringify(msg.functionCall.arguments, null, 2)}</pre>
                  </div>
                )}
                
                {msg.latency && (
                  <div className="text-[10px] text-muted-foreground/70">
                    Latency: {msg.latency}ms | Confidence: {msg.confidence ?? 0.95}
                  </div>
                )}
                
                {msg.metadata && (
                  <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono overflow-x-auto">
                    <div className="text-blue-500 dark:text-blue-300 mb-1">Full Link Details:</div>
                    <pre className="text-muted-foreground">{JSON.stringify(msg.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {messages.length === 0 && (
            <div className="text-muted-foreground/50 text-center py-10 italic">
              Waiting for input...
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
