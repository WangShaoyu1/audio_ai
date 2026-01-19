import { Message } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from "react-i18next";
import { Trash2, FileText, Eye, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

interface JsonLoggerProps {
  messages: Message[];
  onClear?: () => void;
}

export default function JsonLogger({ messages, onClear }: JsonLoggerProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [markdownView, setMarkdownView] = useState<Record<string, boolean>>({});
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleMarkdown = (id: string) => {
    setMarkdownView(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExpand = () => {
    setIsExpanded(prev => !prev);
  };
  
  useEffect(() => {
    // Small timeout to ensure DOM is updated
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  return (
    <div className={`bg-card border border-border rounded-xl flex flex-col min-h-[300px] p-4 shadow-sm transition-all duration-300 ease-in-out ${isExpanded ? 'fixed right-4 top-4 bottom-4 z-50 w-[800px] shadow-2xl' : 'relative h-full'}`}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
            <Button
                variant="ghost"
                size="sm"
                onClick={toggleExpand}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title={isExpanded ? t("logger.collapse") : t("logger.expand")}
            >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <h3 className="text-lg font-semibold text-foreground font-mono">{t("logger.title")}</h3>
        </div>
        {onClear && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClear}
            className="h-8 px-2 text-muted-foreground hover:text-destructive"
            title={t("logger.clear")}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      <ScrollArea className="flex-1 pr-4 min-h-0 w-full" ref={scrollRef}>
        <div className="space-y-4 font-mono text-xs w-full max-w-full">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2 w-full">
              <div className="flex items-center justify-between gap-2 text-muted-foreground w-full">
                <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                  <span className="shrink-0">[{new Date(msg.timestamp).toLocaleTimeString()}]</span>
                  <span className={`shrink-0 ${
                    msg.role === 'user' ? 'text-blue-500 dark:text-blue-400' : 
                    msg.role === 'assistant' ? 'text-green-500 dark:text-green-400' : 'text-yellow-500 dark:text-yellow-400'
                  }`}>
                    {msg.role.toUpperCase()}
                  </span>
                  {msg.intent && (
                    <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] truncate">
                      {t("logger.intent")}: {msg.intent}
                    </span>
                  )}
                </div>
                {msg.role === 'assistant' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 shrink-0"
                    onClick={() => toggleMarkdown(msg.id)}
                    title={markdownView[msg.id] ? t("logger.viewRaw") : t("logger.viewMarkdown")}
                  >
                     {markdownView[msg.id] ? <FileText className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                )}
              </div>
              
              <div className="pl-4 border-l border-border space-y-2 w-full">
                {msg.role === 'assistant' && markdownView[msg.id] ? (
                    <div className="markdown-preview text-foreground/80 text-xs break-words">
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
                    <div className="text-foreground/80 whitespace-pre-wrap break-words w-full">{msg.content}</div>
                )}
                
                {msg.functionCall && (
                  <div className="bg-muted/50 rounded p-2 text-green-600 dark:text-green-300 w-full">
                    <div className="text-purple-500 dark:text-purple-400 mb-1">{t("logger.functionCall")}: {msg.functionCall.name}</div>
                    <pre className="whitespace-pre-wrap break-all w-full">{JSON.stringify(msg.functionCall.arguments, null, 2)}</pre>
                  </div>
                )}
                
                {msg.latency && (
                  <div className="text-[10px] text-muted-foreground/70">
                    {msg.ttft ? (
                      <>
                        {t("chat.ttft")}: {msg.ttft}ms | {t("chat.totalLatency")}: {msg.latency}ms
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
                  <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono w-full">
                    <div className="text-blue-500 dark:text-blue-300 mb-1">{t("logger.linkDetails")}:</div>
                    <pre className="text-muted-foreground whitespace-pre-wrap break-all w-full">{JSON.stringify(msg.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {messages.length === 0 && (
            <div className="text-muted-foreground/50 text-center py-10 italic">
              {t("logger.waiting")}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
