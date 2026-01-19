import { SystemState } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Clock, Flame, Thermometer, Timer } from 'lucide-react';
import { useTranslation } from "react-i18next";

interface MicrowaveStatusProps {
  state: SystemState['microwaveState'];
}

export default function MicrowaveStatus({ state }: MicrowaveStatusProps) {
  const { t } = useTranslation();
  return (
    <div className="glass-card relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative z-10">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white/90">
          <div className={cn(
            "w-2 h-2 rounded-full",
            state.status === 'cooking' ? "bg-green-400 animate-pulse" : 
            state.status === 'paused' ? "bg-yellow-400" : "bg-slate-400"
          )} />
          {t("device.status")}
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-2 text-sm text-white/60 mb-1">
              <Flame className="w-4 h-4" />
              {t("device.firepower")}
            </div>
            <div className="text-xl font-mono font-medium text-white">
              {state.firepower ? state.firepower.toUpperCase() : '--'}
            </div>
          </div>
          
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-2 text-sm text-white/60 mb-1">
              <Thermometer className="w-4 h-4" />
              {t("device.temp")}
            </div>
            <div className="text-xl font-mono font-medium text-white">
              {state.temperature ? `${state.temperature}°C` : '--'}
            </div>
          </div>
          
          <div className="col-span-2 bg-white/5 rounded-xl p-4 border border-white/5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-white/60 mb-1">
                <Timer className="w-4 h-4" />
                {t("device.remaining")}
              </div>
              <div className="text-3xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                {state.remaining ? formatTime(state.remaining) : '00:00'}
              </div>
            </div>
            
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center border-2",
              state.status === 'cooking' ? "border-green-500/50 text-green-400" : "border-white/10 text-white/20"
            )}>
              <Clock className={cn("w-6 h-6", state.status === 'cooking' && "animate-spin")} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
