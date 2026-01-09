import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Send, Sparkles, Terminal, Book, FileSpreadsheet, Settings, LogOut, Plus, MessageSquare, MoreVertical, Trash, Edit2, Sun, Moon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Message, SystemState, SAMPLE_PROMPTS } from '@/lib/types';
import VoiceVisualizer from '@/components/VoiceVisualizer';
import MicrowaveStatus from '@/components/MicrowaveStatus';
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
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStream, setIsStream] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [sessionToRename, setSessionToRename] = useState<Session | null>(null);
  const [newName, setNewName] = useState("");
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [systemState, setSystemState] = useState<SystemState>({
    isListening: false,
    isProcessing: false,
    currentIntent: null,
    activeFunction: null,
    microwaveState: {
      status: 'idle',
      mode: null,
      temperature: null,
      duration: null,
      remaining: null,
      firepower: null
    }
  });

  useEffect(() => {
    fetchSessions();
    // Check system theme preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

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
    // Ideally, we create the session on the backend when the first message is sent, 
    // or explicitly create it here. For now, we just clear the UI state.
  };

  const selectSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    // Fetch messages for this session (not implemented in backend yet, so we just clear for now or need to implement message history fetch)
    // For now, we assume history is loaded via chat context or separate endpoint.
    // Since we don't have a message history endpoint, we start fresh or need to add one.
    // Let's assume we start fresh for demo purposes or need to implement it.
    setMessages([]); 
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
    setSystemState(prev => ({ ...prev, isProcessing: true }));
    
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
        
        // Update session ID if it was new
        if (!currentSessionId && result.metadata?.trace_id) {
           // The backend doesn't return session_id in the response structure defined in endpoints.py
           // We might need to refresh sessions list to get the new session
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
        
        // Update system state based on actions
        if (result.actions && result.actions.length > 0) {
           // Handle mock actions
           const action = result.actions[0];
           if (action.type === 'mock_instruction') {
             // Parse payload to update microwave state (simple heuristic)
             if (action.payload.includes('start')) {
                setSystemState(prev => ({
                  ...prev,
                  microwaveState: { ...prev.microwaveState, status: 'cooking', remaining: 300 }
                }));
             } else if (action.payload.includes('pause')) {
                setSystemState(prev => ({
                  ...prev,
                  microwaveState: { ...prev.microwaveState, status: 'paused' }
                }));
             }
           }
        }

      } else {
        console.error("Chat request failed");
      }
    } catch (error) {
      console.error("Chat error", error);
    } finally {
      setSystemState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const toggleListening = () => {
    setSystemState(prev => ({ ...prev, isListening: !prev.isListening }));
    if (!systemState.isListening) {
      // Simulate voice input after 3 seconds
      setTimeout(() => {
        setSystemState(prev => ({ ...prev, isListening: false }));
        handleSendMessage(SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)]);
      }, 3000);
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="h-full flex bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/50 flex flex-col">
        <div className="p-4 border-b border-border">
           <Input placeholder="搜索会话..." className="h-9" />
        </div>
        
        <div className="p-4">
          <Button onClick={createSession} className="w-full justify-start gap-2" variant="outline">
            <Plus className="w-4 h-4" />
            新建对话
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {sessions.map(session => (
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
          ))}
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
           {/* Chat Area */}
           <div className="flex-1 flex flex-col gap-6 max-w-4xl mx-auto w-full">
              <div className="flex-1 bg-card/30 rounded-2xl border border-border p-6 relative overflow-hidden flex flex-col items-center justify-center">
                 <VoiceVisualizer 
                    isActive={systemState.isListening} 
                    isProcessing={systemState.isProcessing} 
                  />
                  <div className="relative z-10 text-center space-y-6 mt-8">
                    <div className={cn(
                      "text-4xl font-light transition-all duration-500",
                      systemState.isListening ? "text-primary scale-110" : "text-muted-foreground"
                    )}>
                      {systemState.isListening ? "正在聆听..." : 
                       systemState.isProcessing ? "正在处理..." : 
                       "点击说话"}
                    </div>
                    
                    <Button 
                      size="lg"
                      className={cn(
                        "w-20 h-20 rounded-full transition-all duration-300 shadow-xl",
                        systemState.isListening 
                          ? "bg-destructive hover:bg-destructive/90 animate-pulse" 
                          : "bg-primary hover:bg-primary/90"
                      )}
                      onClick={toggleListening}
                    >
                      {systemState.isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                    </Button>
                  </div>

                  {/* Quick Prompts */}
                  <div className="absolute bottom-6 left-0 right-0 px-6 flex gap-2 justify-center overflow-x-auto pb-2 scrollbar-hide">
                    {SAMPLE_PROMPTS.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(prompt)}
                        className="whitespace-nowrap px-4 py-2 rounded-full bg-accent/50 border border-border text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
              </div>

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
              <MicrowaveStatus state={systemState.microwaveState} />
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
