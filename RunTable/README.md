# RunTable - 在线跑团平台 (CoC 7th 规则优化版)

RunTable 是一个现代化的在线桌面角色扮演游戏 (TRPG) 平台，专为《克苏鲁的呼唤》(Call of Cthulhu) 第七版规则设计。它结合了实时聊天、语音通讯、角色卡管理和自动化骰子功能，旨在为守秘人 (KP) 和调查员 (PL) 提供流畅的跑团体验。

## ✨ 核心功能

*   **实时互动**
    *   **即时通讯**: 支持富文本聊天，区分“戏内”(IC) 和“戏外”(OOC) 发言。
    *   **实时语音**: 集成 LiveKit 提供低延迟的语音通话功能。
    *   **状态同步**: 房间内所有玩家实时同步角色状态、骰子结果和音乐播放。

*   **角色管理 (CoC 7th)**
    *   **全功能角色卡**: 包含属性 (STR, DEX等)、技能、背景故事、物品和法术。
    *   **自动计算**: 自动计算衍生属性（如 DB, Build, HP, MP, SAN）。
    *   **多角色支持**: KP 可创建并管理多个 NPC 和怪物；PL 可创建自己的调查员。
    *   **头像上传**: 支持自定义角色头像。

*   **智能骰娘**
    *   **便捷指令**: 支持 `.r` (投骰), `.ra` (技能检定), `.sc` (理智检定), `.st` (属性调整) 等常用指令。
    *   **暗骰模式**: KP 可使用 `.rh` 进行暗骰，结果仅自己可见。
    *   **检定判定**: 自动判定大成功、大失败、成功、失败等结果。

*   **跑团辅助工具**
    *   **背景音乐**: KP 可设置并同步播放背景音乐 (BGM)。
    *   **战报生成**: 一键生成跑团记录 (Log)，支持过滤系统消息，方便回放和整理。
    *   **房间管理**: 密码保护、踢人功能、结团归档。
    *   **移动端适配**: 响应式设计，支持手机端操作。

## 🛠️ 技术栈

*   **前端框架**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
*   **开发语言**: [TypeScript](https://www.typescriptlang.org/)
*   **样式库**: [Tailwind CSS](https://tailwindcss.com/) + [Lucide React](https://lucide.dev/) (图标)
*   **后端服务 (BaaS)**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Realtime)
*   **实时音视频**: [LiveKit](https://livekit.io/)

## 🚀 快速开始

### 前置要求

*   [Node.js](https://nodejs.org/) (推荐 v16+)
*   [Supabase](https://supabase.com/) 账号及项目
*   [LiveKit](https://livekit.io/) 账号 (如果需要语音功能)

### 1. 克隆项目

```bash
git clone <repository-url>
cd RunTable
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

在项目根目录下创建一个 `.env` 文件，并填入以下配置：

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_LIVEKIT_URL=your_livekit_websocket_url
```

> **注意**: 你需要在 Supabase 中运行 `supabase/manual_scripts/db_schema.sql` (及其他迁移文件) 来初始化数据库结构。

### 4. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173` 即可开始使用。

## 🎲 骰子指令速查

在聊天输入框中输入以下指令：

| 指令 | 格式 | 示例 | 说明 |
| :--- | :--- | :--- | :--- |
| **普通投骰** | `.r [表达式] [原因]` | `.r 1d100 侦查` | 投掷 1 个 100 面骰子 |
| **暗骰 (KP)** | `.rh [表达式] [原因]` | `.rh 1d100` | 仅 KP 可见结果 |
| **技能检定** | `.ra [技能名] [修正]` | `.ra 侦查` / `.ra 力量 +20` | 自动读取角色属性进行检定 |
| **理智检定** | `.sc [成功]/[失败] [当前San]` | `.sc 1/1d6` | 自动扣除 SAN 值并判定 |
| **修改属性** | `.st [属性][操作符][值]` | `.st hp-2` / `.st san+5` | 快速修改当前角色属性 |
| **帮助** | `.help` | `.help` | 查看所有指令 |

## 📂 项目结构

```
RunTable/
├── components/       # React UI 组件 (Home, ChatArea, Sidebar等)
├── hooks/            # 自定义 Hooks (useLevelSystem等)
├── services/         # 外部服务集成 (AI等)
├── supabase/         # Supabase 相关配置和迁移文件
│   ├── functions/    # Edge Functions
│   └── migrations/   # 数据库迁移脚本
├── utils/            # 工具函数 (骰子解析, CoC规则计算)
├── App.tsx           # 主应用入口及路由逻辑
└── main.tsx          # 渲染入口
```

## 📄 许可证

Private (私有项目)
