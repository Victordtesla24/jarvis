import React, { useEffect, useState } from 'react';
import { SystemMetric } from '../types';
import { Activity, Battery, Shield, Cpu, Zap, Database } from 'lucide-react';

const SystemMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetric[]>([
    { id: 'armor', label: 'SUIT INTEGRITY', value: 100, max: 100, unit: '%', status: 'normal' },
    { id: 'power', label: 'ARC REACTOR', value: 92, max: 100, unit: '%', status: 'normal' },
    { id: 'thrusters', label: 'THRUSTERS', value: 85, max: 100, unit: '%', status: 'normal' },
    { id: 'cpu', label: 'CORTEX LINK', value: 12, max: 100, unit: 'TB', status: 'normal' },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => prev.map(m => {
        const change = (Math.random() - 0.5) * 5;
        let newValue = Math.min(m.max, Math.max(0, m.value + change));
        if (m.id === 'cpu') newValue = Math.random() * 20 + 30;
        
        let status: SystemMetric['status'] = 'normal';
        if (newValue < 30 && m.id === 'armor') status = 'critical';
        else if (newValue < 50 && m.id === 'power') status = 'warning';
        
        return { ...m, value: newValue, status };
      }));
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const getIcon = (id: string) => {
    switch (id) {
      case 'armor': return <Shield size={14} />;
      case 'power': return <Zap size={14} />;
      case 'cpu': return <Database size={14} />;
      default: return <Activity size={14} />;
    }
  };

  const getBarColor = (status: string) => {
    if (status === 'critical') return 'bg-red-500 shadow-[0_0_8px_#ef4444]';
    if (status === 'warning') return 'bg-yellow-500 shadow-[0_0_8px_#eab308]';
    return 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]';
  };

  return (
    <div className="space-y-3 font-mono-tech">
      {metrics.map((metric) => (
        <div key={metric.id} className="relative group">
           {/* Background Grid for bar */}
           <div className="absolute top-0 right-0 w-full h-full border border-cyan-900/30 skew-x-[-10deg] pointer-events-none"></div>
           
           <div className="flex justify-between items-center mb-1 text-[10px] tracking-wider text-cyan-500">
             <span className="flex items-center gap-2 uppercase font-bold">
               {getIcon(metric.id)}
               {metric.label}
             </span>
             <span className={metric.status === 'critical' ? 'text-red-500 animate-pulse font-bold' : 'text-cyan-200'}>
               {metric.value.toFixed(0)}{metric.unit}
             </span>
           </div>
           
           {/* Segmented Bar Chart */}
           <div className="flex gap-0.5 h-2">
             {[...Array(20)].map((_, i) => {
               const threshold = (i / 20) * 100;
               const isActive = metric.value > threshold;
               return (
                 <div 
                   key={i}
                   className={`flex-1 transform skew-x-[-10deg] transition-all duration-300 ${isActive ? getBarColor(metric.status) : 'bg-cyan-900/20'}`}
                   style={{ opacity: isActive ? 1 : 0.2 }}
                 ></div>
               );
             })}
           </div>
        </div>
      ))}

      {/* Footer Grid */}
      <div className="mt-6 pt-4 border-t border-cyan-500/20">
        <div className="grid grid-cols-4 gap-2">
           {[...Array(8)].map((_, i) => (
              <div key={i} className="h-8 border border-cyan-500/10 bg-cyan-900/5 relative overflow-hidden">
                <div className={`absolute inset-0 bg-cyan-400/20 animate-pulse`} style={{ animationDelay: `${i * 0.2}s`, width: `${Math.random() * 100}%` }}></div>
                <span className="absolute bottom-0 right-1 text-[8px] text-cyan-700">SYS_0{i}</span>
              </div>
           ))}
        </div>
      </div>
    </div>
  );
};

export default SystemMonitor;