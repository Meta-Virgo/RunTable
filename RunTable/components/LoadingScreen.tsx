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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020617] text-slate-200">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-900/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[10%] right-[-5%] w-[30rem] h-[30rem] bg-indigo-900/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-indigo-500/30 blur-xl rounded-full animate-pulse"></div>
          <Dices size={64} className="text-indigo-400 animate-bounce" style={{ animationDuration: '3s' }} />
        </div>
        
        <h1 className="text-3xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-4">
          RunTable
        </h1>
        
        <div className="flex items-center space-x-2 text-slate-500 text-sm font-medium">
          <span>正在初始化</span>
          <span className="w-4 text-left">{dots}</span>
        </div>

        {/* Loading Bar */}
        <div className="w-48 h-1 bg-slate-800 rounded-full mt-6 overflow-hidden relative">
          <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-purple-500 w-1/2 animate-[shimmer_1.5s_infinite] rounded-full"></div>
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
