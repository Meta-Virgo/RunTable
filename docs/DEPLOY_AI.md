# 部署 AI 功能到 Supabase Edge Functions

为了保护您的 DeepSeek API Key，我们需要将其从前端代码移动到 Supabase 的服务器端（Edge Functions）。

## 前置准备

请确保您已安装 Supabase CLI。如果未安装，请参考 [Supabase 文档](https://supabase.com/docs/guides/cli) 或使用包管理器安装：
```bash
npm install -g supabase
```

## 步骤 1: 登录并链接项目

1. 打开终端（PowerShell 或 CMD）。
2. 登录 Supabase:
   ```bash
   supabase login
   ```
3. 链接到您的远程项目（您需要从 Supabase Dashboard 获取 Project ID）：
   ```bash
   supabase link --project-ref <您的项目ID>
   ```
   *注意：Project ID 可以在 Supabase Dashboard 的 Settings -> General 中找到（通常是一串随机字符）。*

## 步骤 2: 设置 API Key 密钥

为了让 Edge Function 能够访问 API Key，我们需要将其设置为 Secret。

在终端运行：
```bash
supabase secrets set DEEPSEEK_API_KEY=sk-54bbf491f30349e084c05b126db6947c
```

## 步骤 3: 部署 Edge Function

将我们创建的 `ask-ai` 函数部署到云端：

```bash
supabase functions deploy ask-ai
```

## 步骤 4: 验证

部署成功后，回到网页版 RunTable，尝试使用 AI 功能。请求现在会通过 Supabase Edge Function 转发，您的 API Key 将不再暴露在浏览器中。

---

## 常见问题

### 本地开发
如果您想在本地测试 Function 而不部署，可以运行：
```bash
supabase start
supabase functions serve ask-ai
```
并在 `.env` 中添加 `VITE_SUPABASE_FUNCTION_URL=http://localhost:54321/functions/v1`（需要相应修改前端调用逻辑，通常生产环境不需要此步）。

### 权限问题 (CORS)
如果遇到 CORS 错误，请确保 Function 代码中的 `corsHeaders` 已正确设置（已包含在代码中）。
