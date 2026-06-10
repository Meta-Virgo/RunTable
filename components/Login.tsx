import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { Button, Input } from "./UI";
import { LogIn, UserPlus, AlertCircle, ArrowLeft } from "lucide-react";

export const Login: React.FC = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [showResend, setShowResend] = useState(false);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/welcome`,
        },
      });
      if (error) throw error;
      setSuccessMsg("验证邮件已重新发送，请检查您的邮箱。");
      setCooldown(60);
      setShowResend(false);
      setError(null);
    } catch (err: any) {
      console.error("Resend error:", err);
      setError(err.message || "发送失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setShowResend(false);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.message === "Email not confirmed") {
        setError(
          "您的邮箱尚未确认。请检查邮箱或点击下方按钮重新发送验证邮件。"
        );
        setShowResend(true);
      } else if (
        err.status === 429 ||
        (err.message && err.message.includes("429"))
      ) {
        setError("请求过于频繁，请稍后再试（错误代码：429）");
      } else if (
        err.status === 504 ||
        (err.message && err.message.includes("504")) ||
        err.name === "AuthRetryableFetchError"
      ) {
        setError(
          "连接服务器超时，请检查您的网络连接或稍后再试（错误代码：504）"
        );
      } else {
        setError(err.message || "登录失败，请重试");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
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
          emailRedirectTo: `${window.location.origin}/welcome`,
        },
      });
      if (error) throw error;
      alert("注册成功！请检查您的邮箱进行验证。");
      setCooldown(60); // Start 60s cooldown
      setMode("login"); // Switch back to login
    } catch (err: any) {
      console.error("Signup error:", err);
      if (err.status === 429 || (err.message && err.message.includes("429"))) {
        setError(
          "注册请求过于频繁，为了安全起见，请等待一段时间后再试（错误代码：429）。如果您已注册，请直接登录。"
        );
      } else if (
        err.status === 504 ||
        (err.message && err.message.includes("504")) ||
        err.name === "AuthRetryableFetchError"
      ) {
        setError(
          "连接服务器超时，请检查您的网络连接或稍后再试（错误代码：504）。Supabase 服务可能暂时不可用。"
        );
      } else {
        setError(err.message || "注册失败，请重试");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) {
      setError(`请等待 ${cooldown} 秒后再试`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      setSuccessMsg(
        "重置密码邮件已发送，请检查您的邮箱（包括垃圾邮件文件夹）。"
      );
      setCooldown(60);
    } catch (err: any) {
      console.error("Reset password error:", err);
      if (err.status === 429 || (err.message && err.message.includes("429"))) {
        setError("请求过于频繁，请稍后再试（错误代码：429）");
      } else {
        setError(err.message || "发送重置邮件失败，请重试");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: "login" | "signup" | "forgot") => {
    setMode(newMode);
    setError(null);
    setSuccessMsg(null);
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center dicecho-page-bg p-4">
      <div className="max-w-md w-full bg-dicecho-panel border border-dicecho-border/50 rounded-lg p-8 shadow-lg shadow-black/25 relative overflow-hidden">
        <div className="relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              RunTable Pro
            </h1>
            <p className="text-slate-400">沉浸式跑团终端</p>
          </div>

          <form
            onSubmit={
              mode === "login"
                ? handleLogin
                : mode === "signup"
                ? handleSignUp
                : handleResetPassword
            }
            className="space-y-6"
          >
            <Input
              label="邮箱"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />

            {mode !== "forgot" && (
              <Input
                label="密码"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            )}

            {mode === "signup" && (
              <Input
                label="确认密码"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            )}

            {mode === "login" && (
              <div className="flex justify-end -mt-4">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs text-dicecho-primary hover:text-white transition-colors"
                >
                  忘记密码?
                </button>
              </div>
            )}

            {error && (
              <div className="flex flex-col gap-2 text-red-400 bg-red-500/10 p-3 rounded-lg text-sm border border-red-500/20">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
                {showResend && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="self-end text-red-400 hover:bg-red-500/10 h-8 mt-1"
                    onClick={handleResend}
                    disabled={cooldown > 0 || loading}
                  >
                    {cooldown > 0
                      ? `重新发送 (${cooldown}s)`
                      : "重新发送验证邮件"}
                  </Button>
                )}
              </div>
            )}

            {successMsg && (
              <div className="flex items-start gap-2 text-emerald-400 bg-emerald-500/10 p-3 rounded-lg text-sm border border-emerald-500/20">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <Button
                type="submit"
                disabled={
                  loading ||
                  ((mode === "signup" || mode === "forgot") && cooldown > 0)
                }
                className="w-full"
                icon={
                  mode === "login"
                    ? LogIn
                    : mode === "signup"
                    ? UserPlus
                    : AlertCircle
                }
              >
                {loading
                  ? "处理中..."
                  : mode === "login"
                  ? "登录"
                  : mode === "signup"
                  ? cooldown > 0
                    ? `重新发送 (${cooldown}s)`
                    : "注册"
                  : cooldown > 0
                  ? `重新发送 (${cooldown}s)`
                  : "发送重置邮件"}
              </Button>

              {mode === "login" ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={loading}
                  className="w-full"
                  onClick={() => switchMode("signup")}
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
                  onClick={() => switchMode("login")}
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
