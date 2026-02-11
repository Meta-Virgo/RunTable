import React from 'react';
import { Button } from './UI';
import { CheckCircle } from 'lucide-react';

export const Welcome: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900/50 border border-white/10 rounded-xl p-8 backdrop-blur-sm text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-4">
          账号激活成功！
        </h1>
        
        <p className="text-slate-400 mb-8">
          欢迎加入 RunTable。您的邮箱验证已完成，现在可以开始创建或加入跑团房间了。
        </p>
        
        <Button 
          variant="primary" 
          className="w-full"
          onClick={() => {
            // Clear the path to go to root
            window.history.pushState({}, '', '/');
            onNavigate('/');
          }}
        >
          前往登录 / 开始使用
        </Button>
      </div>

      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-[-1]">
        <div className="absolute top-[20%] left-[20%] w-72 h-72 bg-purple-900/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[20%] right-[20%] w-72 h-72 bg-indigo-900/20 rounded-full blur-[100px]"></div>
      </div>
    </div>
  );
};
