import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Send, Plus, MessageSquare, MoreVertical, Trash, Edit2, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import { Message } from '@/lib/types';
import JsonLogger from '@/components/JsonLogger';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";

interface Session {
  id: string;
  name: string;
  created_at: string;
}

const BATCH_SIZE = 20;

export default function Home() {
  const { t } = useTranslation();
  useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStream, setIsStream] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [sessionToRename, setSessionToRename] = useState<Session | null>(null);
  const [newName, setNewName] = useState("");
  const [deleteConfirmSessionId, setDeleteConfirmSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [logClearTimestamp, setLogClearTimestamp] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

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
            // Scroll to bottom after render
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
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

  const selectSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setMessages([]); 
    setLogClearTimestamp(0);
    setOffset(0);
    setHasMore(true);
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
      }
    } catch (error) {
      console.error("Failed to rename session", error);
    }
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
      }
    } catch (error) {
      console.error("Failed to delete session", error);
    }
  };

  const handleRetry = (messageId: string) => {
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
        
        // Trigger send as a new message (append to history)
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
                      content: assistantMsg.content + data.content
                    };
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMsg.id ? assistantMsg : msg
                    ));
                  }
                  if (data.metadata) {
                    assistantMsg = {
                      ...assistantMsg,
                      latency: data.metadata.latency?.total_ms,
                      ttft: data.metadata.latency?.ttft_ms,
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

  return (
    <div className="h-full flex bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/50 flex flex-col">
        <div className="p-4 border-b border-border">
           <Input 
             placeholder={t("home.searchPlaceholder")}
             className="h-9" 
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
        </div>
        
        <div className="p-4">
          <Button onClick={createSession} className="w-full justify-start gap-2" variant="outline">
            <Plus className="w-4 h-4" />
            {t("home.newChat")}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {searchQuery ? (
            searchResults.length > 0 ? (
              searchResults.map((result, idx) => (
                <div 
                  key={idx}
                  className="p-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors text-muted-foreground"
                  onClick={() => selectSession(result.session_id)}
                >
                  <div className="flex items-center gap-2 overflow-hidden mb-1">
                    <MessageSquare className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate text-xs font-medium">{result.session_name}</span>
                  </div>
                  <div className="text-xs truncate pl-5 opacity-80">
                    {result.content}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {t("home.searchPlaceholder")}
              </div>
            )
          ) : (
            sessions.map(session => (
              <div 
                key={session.id}
                className={cn(
                  "group flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors",
                  currentSessionId === session.id ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                )}
                onClick={() => selectSession(session.id)}
              >
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate text-sm">{session.name}</span>
                </div>
                
                <DropdownMenu onOpenChange={(open) => !open && setDeleteConfirmSessionId(null)}>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem onClick={(e) => { 
                      e.stopPropagation(); 
                      setSessionToRename(session); 
                      setNewName(session.name); 
                      setIsRenameDialogOpen(true); 
                    }}>
                      <Edit2 className="w-3 h-3 mr-2" />
                      <span>{t("home.rename")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onSelect={(e) => {
                        if (deleteConfirmSessionId !== session.id) {
                          e.preventDefault();
                          setDeleteConfirmSessionId(session.id);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-destructive focus:text-destructive"
                    >
                      {deleteConfirmSessionId === session.id ? (
                        <div className="flex items-center justify-between w-full gap-2">
                           <span 
                              className="font-medium cursor-pointer hover:underline"
                              onClick={(e) => {
                                 e.stopPropagation(); // Prevent item click
                                 deleteSession(session.id);
                                 setDeleteConfirmSessionId(null);
                                 // The menu will close automatically if we don't prevent it, 
                                 // but here we are inside an onClick that stops propagation.
                                 // We might want to let the menu close now.
                                 // Actually, deleteSession re-fetches sessions, which might unmount this component.
                                 // But to be safe, we can rely on the re-render.
                                 // If we want to close the menu, we might need to trigger a click outside or not stop propagation?
                                 // If I stop propagation, the menu won't know a click happened.
                                 // Wait, if I delete the session, the row disappears, so the menu disappears.
                                 // So it should be fine.
                              }}
                           >
                              {t("home.confirm")}
                           </span>
                           <span 
                              className="text-muted-foreground cursor-pointer hover:underline text-xs"
                              onClick={(e) => {
                                 e.stopPropagation();
                                 setDeleteConfirmSessionId(null);
                              }}
                           >
                              {t("home.cancel")}
                           </span>
                        </div>
                      ) : (
                        <>
                          <Trash className="w-3 h-3 mr-2" />
                          <span>{t("home.deleteSession")}</span>
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur">
           <div className="flex items-center gap-4">
             <h2 className="font-semibold">
               {sessions.find(s => s.id === currentSessionId)?.name || t("home.newChat")}
             </h2>
           </div>
           <div className="flex items-center gap-2">
             <LanguageToggle />
           </div>
        </header>

        <main className="flex-1 overflow-hidden flex p-6 gap-6">
           <div className="flex-1 flex flex-col gap-6 max-w-4xl mx-auto w-full">
              {/* Chat History & Input */}
              <div className="flex-1 flex flex-col gap-4 min-h-0">
                 <div 
                   ref={chatContainerRef} 
                   onScroll={handleScroll} 
                   className="flex-1 overflow-y-auto space-y-4 pr-2"
                 >
                    {isLoadingHistory && messages.length > 0 && (
                        <div className="flex justify-center py-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        </div>
                    )}
                    {messages.map(msg => (
                      <div key={msg.id} className={cn("flex gap-3", msg.role === 'user' ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[80%] p-3 rounded-2xl text-sm relative group",
                          msg.role === 'user' 
                            ? "bg-primary text-primary-foreground rounded-tr-none" 
                            : "bg-muted text-muted-foreground rounded-tl-none"
                        )}>
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
                          {msg.latency && (
                            <div className="text-[10px] opacity-50 mt-1">
                                {msg.ttft ? (
                                    <>
                                        {t("chat.ttft")}: {msg.ttft}ms | {t("chat.totalLatency")}: {msg.latency}ms
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
                            <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                    variant="ghost"
                                    size="icon" 
                                    className="h-6 w-6 hover:bg-background/20"
                                    onClick={() => handleRetry(msg.id)}
                                    title={t("common.retry")}
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {isProcessing && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                      <div className="flex gap-3 justify-start">
                        <div className="bg-muted text-muted-foreground p-3 rounded-2xl rounded-tl-none text-sm">
                          <span className="animate-pulse">{t("home.generating") || "..."}</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                 </div>

                 <div className="bg-card border border-border rounded-xl p-2 flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(input)}
                      placeholder={t("home.inputPlaceholder")}
                      className="border-none focus-visible:ring-0 bg-transparent"
                    />
                    <Button size="icon" onClick={() => handleSendMessage(input)}>
                      <Send className="w-4 h-4" />
                    </Button>
                 </div>
                 <div className="flex items-center gap-2 px-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isStream} 
                        onChange={(e) => setIsStream(e.target.checked)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      {t("home.streamResponse")}
                    </label>
                 </div>
              </div>
           </div>

           {/* Right Panel */}
           <div className="w-80 flex flex-col gap-6">
              <JsonLogger 
                messages={messages.filter(m => m.timestamp > logClearTimestamp)} 
                onClear={() => setLogClearTimestamp(Date.now())} 
              />
           </div>
        </main>
      </div>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("home.renameSession")}</DialogTitle>
          </DialogHeader>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>{t("home.cancel")}</Button>
            <Button onClick={renameSession}>{t("home.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
