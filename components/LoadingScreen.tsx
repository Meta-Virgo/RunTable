import React, { useEffect, useState } from 'react';
import { Dices } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center dicecho-page-bg text-slate-200">
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-8">
          <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-panel/80 p-5 shadow-sm">
            <Dices size={64} className="text-dicecho-primary" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold tracking-wider text-white mb-4">
          RunTable
        </h1>
        
        <div className="flex items-center space-x-2 text-dicecho-muted text-sm font-medium">
          <span>正在初始化</span>
          <span className="w-4 text-left">{dots}</span>
        </div>

        {/* Loading Bar */}
        <div className="w-48 h-1 bg-dicecho-card rounded-full mt-6 overflow-hidden relative">
          <div className="absolute top-0 left-0 h-full bg-dicecho-primary w-1/2 animate-[shimmer_1.5s_infinite] rounded-full"></div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};
