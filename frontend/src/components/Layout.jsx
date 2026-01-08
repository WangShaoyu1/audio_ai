import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MessageSquare, Database, FileText, Settings, Activity } from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, to, active }) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
      active 
        ? "bg-secondary text-secondary-foreground" 
        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
    )}
  >
    <Icon className="h-4 w-4" />
    {label}
  </Link>
);

const Layout = ({ children }) => {
  const location = useLocation();

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Audio AI
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <SidebarItem 
            icon={MessageSquare} 
            label="Chat Debugger" 
            to="/" 
            active={location.pathname === '/'} 
          />
          <SidebarItem 
            icon={Database} 
            label="Knowledge Base" 
            to="/knowledge" 
            active={location.pathname === '/knowledge'} 
          />
          <SidebarItem 
            icon={FileText} 
            label="Batch Eval" 
            to="/eval" 
            active={location.pathname === '/eval'} 
          />
          <SidebarItem 
            icon={Settings} 
            label="Instructions" 
            to="/instructions" 
            active={location.pathname === '/instructions'} 
          />
        </nav>

        <div className="p-4 border-t border-border text-xs text-muted-foreground">
          v2.0.0 (Manus Style)
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
