import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Send, Plus, MessageSquare, MoreVertical, Trash, Edit2 } from "lucide-react";
import { useLocation } from "wouter";
import { Message } from '@/lib/types';
import JsonLogger from '@/components/JsonLogger';
import { cn } from '@/lib/utils';
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

interface Session {
  id: string;
  name: string;
  created_at: string;
}

export default function Home() {
  useLocation();
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

  const [, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

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

  const selectSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setMessages([]); 
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/sessions/${sessionId}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const history = await res.json();
        setMessages(history.map((msg: any) => ({
          id: msg.timestamp, // Use timestamp as temporary ID
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp).getTime()
        })));
      }
    } catch (error) {
      console.error("Failed to load session history", error);
    }
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

      if (res.ok) {
        const data = await res.json();
        const result = data.data;
        
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
        
      } else {
        console.error("Chat request failed");
      }
    } catch (error) {
      console.error("Chat error", error);
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
             placeholder="搜索会话..." 
             className="h-9" 
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
        </div>
        
        <div className="p-4">
          <Button onClick={createSession} className="w-full justify-start gap-2" variant="outline">
            <Plus className="w-4 h-4" />
            新建对话
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
                无搜索结果
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
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate text-sm">{session.name}</span>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                      <MoreVertical className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSessionToRename(session); setNewName(session.name); setIsRenameDialogOpen(true); }}>
                      <Edit2 className="w-3 h-3 mr-2" />
                      重命名
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }} className="text-destructive">
                      <Trash className="w-3 h-3 mr-2" />
                      删除
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
               {sessions.find(s => s.id === currentSessionId)?.name || "新建对话"}
             </h2>
           </div>
        </header>

        <main className="flex-1 overflow-hidden flex p-6 gap-6">
           <div className="flex-1 flex flex-col gap-6 max-w-4xl mx-auto w-full">
              {/* Chat History & Input */}
              <div className="flex-1 flex flex-col gap-4 min-h-0">
                 <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {messages.map(msg => (
                      <div key={msg.id} className={cn("flex gap-3", msg.role === 'user' ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[80%] p-3 rounded-2xl text-sm",
                          msg.role === 'user' 
                            ? "bg-primary text-primary-foreground rounded-tr-none" 
                            : "bg-muted text-muted-foreground rounded-tl-none"
                        )}>
                          {msg.content}
                          {msg.latency && (
                            <div className="text-[10px] opacity-50 mt-1">
                              Latency: {msg.latency}ms | Intent: {msg.intent}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                 </div>

                 <div className="bg-card border border-border rounded-xl p-2 flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(input)}
                      placeholder="输入指令..."
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
                      流式响应
                    </label>
                 </div>
              </div>
           </div>

           {/* Right Panel */}
           <div className="w-80 flex flex-col gap-6">
              <JsonLogger messages={messages} />
           </div>
        </main>
      </div>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名会话</DialogTitle>
          </DialogHeader>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>取消</Button>
            <Button onClick={renameSession}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
