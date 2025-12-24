import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Button, Input } from './UI';
import { LogIn, UserPlus, AlertCircle, ArrowLeft } from 'lucide-react';

export const Login: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.status === 429 || (err.message && err.message.includes('429'))) {
        setError('请求过于频繁，请稍后再试（错误代码：429）');
      } else if (err.status === 504 || (err.message && err.message.includes('504')) || err.name === 'AuthRetryableFetchError') {
        setError('连接服务器超时，请检查您的网络连接或稍后再试（错误代码：504）');
      } else {
        setError(err.message || '登录失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
    }
    if (cooldown > 0) {
        setError(`请等待 ${cooldown} 秒后再试`);
        return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'https://trpgtool.maoyiwei.com/welcome'
        }
      });
      if (error) throw error;
      alert('注册成功！请检查您的邮箱进行验证。');
      setCooldown(60); // Start 60s cooldown
      setMode('login'); // Switch back to login
    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.status === 429 || (err.message && err.message.includes('429'))) {
        setError('注册请求过于频繁，为了安全起见，请等待一段时间后再试（错误代码：429）。如果您已注册，请直接登录。');
      } else if (err.status === 504 || (err.message && err.message.includes('504')) || err.name === 'AuthRetryableFetchError') {
        setError('连接服务器超时，请检查您的网络连接或稍后再试（错误代码：504）。Supabase 服务可能暂时不可用。');
      } else {
        setError(err.message || '注册失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: 'login' | 'signup') => {
      setMode(newMode);
      setError(null);
      setPassword('');
      setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4">
      <div className="max-w-md w-full glass-panel rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-[-50px] left-[-50px] w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute bottom-[-50px] right-[-50px] w-32 h-32 bg-purple-500/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>

        <div className="relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">RunTable Pro</h1>
            <p className="text-slate-400">沉浸式跑团终端</p>
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleSignUp} className="space-y-6">
            <Input
              label="邮箱"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
            <Input
              label="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            
            {mode === 'signup' && (
                <Input
                label="确认密码"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                />
            )}

            {error && (
              <div className="flex items-start gap-2 text-red-400 bg-red-500/10 p-3 rounded-lg text-sm border border-red-500/20">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <Button type="submit" disabled={loading || (mode === 'signup' && cooldown > 0)} className="w-full" icon={mode === 'login' ? LogIn : UserPlus}>
                {loading ? '处理中...' : (mode === 'login' ? '登录' : (cooldown > 0 ? `重新发送 (${cooldown}s)` : '注册'))}
              </Button>
              
              {mode === 'login' ? (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    disabled={loading} 
                    className="w-full" 
                    onClick={() => switchMode('signup')}
                    icon={UserPlus}
                  >
                    注册新账号
                  </Button>
              ) : (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    disabled={loading} 
                    className="w-full" 
                    onClick={() => switchMode('login')}
                    icon={ArrowLeft}
                  >
                    返回登录
                  </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
