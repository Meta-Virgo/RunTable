import React from 'react';
import { Button } from './UI';
import { CheckCircle } from 'lucide-react';

export const Welcome: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen dicecho-page-bg flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-dicecho-panel border border-dicecho-border/50 rounded-lg p-8 shadow-lg shadow-black/25 text-center">
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
    </div>
  );
};
