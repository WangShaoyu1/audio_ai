import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { MessageSquare, Database, FileText, Settings, Activity } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';

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
  const { t } = useTranslation();

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
            label={t('nav.chatDebugger')} 
            to="/" 
            active={location.pathname === '/'} 
          />
          <SidebarItem 
            icon={Database} 
            label={t('nav.knowledgeBase')} 
            to="/knowledge" 
            active={location.pathname === '/knowledge'} 
          />
          <SidebarItem 
            icon={FileText} 
            label={t('nav.batchEval')} 
            to="/eval" 
            active={location.pathname === '/eval'} 
          />
          <SidebarItem 
            icon={Settings} 
            label={t('nav.instructions')} 
            to="/instructions" 
            active={location.pathname === '/instructions'} 
          />
        </nav>

        <div className="p-4 border-t border-border text-xs text-muted-foreground flex flex-col gap-2">
          <div>v2.0.0 (Manus Style)</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Language Switcher */}
        <header className="h-14 border-b border-border flex items-center justify-end px-6 bg-card/50 backdrop-blur">
          <LanguageSwitcher />
        </header>
        
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 max-w-8xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
