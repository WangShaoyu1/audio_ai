import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { MessageSquare, Database, FileText, Settings, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

// Placeholder Pages
const ChatPage = () => <div className="p-8">Chat Debugger (Coming Soon)</div>;
const KnowledgePage = () => <div className="p-8">Knowledge Base (Coming Soon)</div>;
const EvalPage = () => <div className="p-8">Batch Evaluation (Coming Soon)</div>;
const InstructionsPage = () => <div className="p-8">Instructions (Coming Soon)</div>;

function SidebarItem({ icon: Icon, label, path }: { icon: any, label: string, path: string }) {
  const location = useLocation();
  const isActive = location.pathname === path;
  
  return (
    <Link 
      to={path} 
      className={cn(
        "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
        isActive 
          ? "bg-secondary text-foreground" 
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      )}
    >
      <Icon className="w-5 h-5" />
      {label}
    </Link>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background text-foreground dark">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-500" />
            Audio AI
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <SidebarItem icon={MessageSquare} label="Chat Debugger" path="/" />
          <SidebarItem icon={Database} label="Knowledge Base" path="/knowledge" />
          <SidebarItem icon={FileText} label="Batch Eval" path="/eval" />
          <SidebarItem icon={Settings} label="Instructions" path="/instructions" />
        </nav>
        
        <div className="p-4 border-t border-border text-xs text-muted-foreground">
          v2.0.0 (Manus Style)
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/eval" element={<EvalPage />} />
          <Route path="/instructions" element={<InstructionsPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
