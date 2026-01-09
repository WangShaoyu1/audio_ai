import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Send, Sparkles, Terminal, Book, FileSpreadsheet, Settings, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Message, SystemState, SAMPLE_PROMPTS } from '@/lib/types';
import VoiceVisualizer from '@/components/VoiceVisualizer';
import MicrowaveStatus from '@/components/MicrowaveStatus';
import JsonLogger from '@/components/JsonLogger';
import { cn } from '@/lib/utils';

export default function Home() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
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

  // Simulate microwave timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemState(prev => {
        if (prev.microwaveState.status === 'cooking' && prev.microwaveState.remaining && prev.microwaveState.remaining > 0) {
          return {
            ...prev,
            microwaveState: {
              ...prev.microwaveState,
              remaining: prev.microwaveState.remaining - 1
            }
          };
        } else if (prev.microwaveState.status === 'cooking' && prev.microwaveState.remaining === 0) {
          return {
            ...prev,
            microwaveState: {
              ...prev.microwaveState,
              status: 'finished',
              remaining: null
            }
          };
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
    
    // Simulate AI processing delay
    setTimeout(() => {
      processCommand(text);
    }, 1500);
  };

  const processCommand = (text: string) => {
    const lowerText = text.toLowerCase();
    let responseMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      latency: Math.floor(Math.random() * 500) + 200, // 200-700ms latency
      confidence: 0.92 + Math.random() * 0.07 // 0.92-0.99 confidence
    };

    // Simple rule-based logic for demo purposes
    if (lowerText.includes('start') || lowerText.includes('cook')) {
      responseMsg.content = "Starting cooking with high firepower for 5 minutes.";
      responseMsg.intent = "INSTRUCTION_CONTROL";
      responseMsg.functionCall = {
        name: "voice_cmd_start_cooking",
        arguments: { firepower: "high", duration: 300 }
      };
      setSystemState(prev => ({
        ...prev,
        isProcessing: false,
        microwaveState: {
          ...prev.microwaveState,
          status: 'cooking',
          firepower: 'high',
          remaining: 300
        }
      }));
    } else if (lowerText.includes('pause')) {
      responseMsg.content = "Cooking paused.";
      responseMsg.intent = "INSTRUCTION_CONTROL";
      responseMsg.functionCall = {
        name: "voice_cmd_pause_cooking",
        arguments: {}
      };
      setSystemState(prev => ({
        ...prev,
        isProcessing: false,
        microwaveState: {
          ...prev.microwaveState,
          status: 'paused'
        }
      }));
    } else if (lowerText.includes('recipe') || lowerText.includes('how to')) {
      responseMsg.content = "I found a great recipe for that. You'll need 500g of chicken wings, honey, soy sauce, and garlic. Would you like me to send the full recipe to your phone?";
      responseMsg.intent = "KNOWLEDGE_QA";
      setSystemState(prev => ({ ...prev, isProcessing: false }));
    } else {
      responseMsg.content = "I can help you with cooking, recipes, or general questions. Try saying 'Start cooking' or 'Find a recipe'.";
      responseMsg.intent = "GENERAL_CHAT";
      setSystemState(prev => ({ ...prev, isProcessing: false }));
    }

    setMessages(prev => [...prev, responseMsg]);
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

  return (
    <div className="min-h-screen flex flex-col p-4 lg:p-8 gap-6 relative overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">AI Voice Solution</h1>
            <p className="text-sm text-white/40 font-mono">SEMANTIC UNDERSTANDING DEMO</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/knowledge-base">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <Book className="w-4 h-4 mr-2" />
              Knowledge Base
            </Button>
          </Link>
          <Link href="/instructions">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <Settings className="w-4 h-4 mr-2" />
              Instructions
            </Button>
          </Link>
          <Link href="/batch-eval">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Batch Eval
            </Button>
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            SYSTEM ONLINE
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              localStorage.removeItem("token");
              setLocation("/login");
            }} 
            className="text-white/60 hover:text-white hover:bg-white/10" 
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 z-10">
        
        {/* Left Column: Interaction Area */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Voice Orb / Visualizer */}
          <div className="flex-1 glass-card relative min-h-[400px] flex flex-col items-center justify-center overflow-hidden">
            <VoiceVisualizer 
              isActive={systemState.isListening} 
              isProcessing={systemState.isProcessing} 
            />
            
            <div className="relative z-10 text-center space-y-6">
              <div className={cn(
                "text-4xl font-light transition-all duration-500",
                systemState.isListening ? "text-white scale-110" : "text-white/50"
              )}>
                {systemState.isListening ? "Listening..." : 
                 systemState.isProcessing ? "Processing..." : 
                 "Tap to Speak"}
              </div>
              
              <Button 
                size="lg"
                className={cn(
                  "w-20 h-20 rounded-full transition-all duration-300 shadow-xl",
                  systemState.isListening 
                    ? "bg-red-500 hover:bg-red-600 shadow-red-500/30 animate-pulse" 
                    : "bg-primary hover:bg-primary/90 shadow-primary/30"
                )}
                onClick={toggleListening}
              >
                {systemState.isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </Button>
            </div>

            {/* Quick Prompts */}
            <div className="absolute bottom-6 left-0 right-0 px-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {SAMPLE_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(prompt)}
                  className="whitespace-nowrap px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 hover:border-white/20 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Text Input Fallback */}
          <div className="glass-card p-2 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(input)}
              placeholder="Or type a command..."
              className="flex-1 bg-transparent border-none text-white placeholder:text-white/30 focus:ring-0 px-4"
            />
            <Button size="icon" onClick={() => handleSendMessage(input)} className="rounded-xl">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Right Column: System Internals */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <MicrowaveStatus state={systemState.microwaveState} />
          <JsonLogger messages={messages} />
        </div>
      </main>
    </div>
  );
}
