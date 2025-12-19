# RunTable 🎲

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)

> 一个现代化、实时的跑团（TRPG）平台，专为沉浸式叙事打造。

[English Documentation](./README.md)

## 📖 简介

**RunTable** 是一个基于 Web 的现代化 TRPG 跑团平台，专为 **“克苏鲁的呼唤” (Call of Cthulhu, CoC)** 等规则设计。它通过实时的连接将守秘人（KP）与调查员（玩家）紧密联系在一起，提供集成的投骰工具、角色卡管理以及沉浸式的沟通环境，为您的冒险之旅保驾护航。

## ✨ 功能特性

- **🎲 高级投骰系统**: 
  - 支持标准骰子 (d4, d6, d8, d10, d12, d20, d100)。
  - **暗骰模式**: KP 可进行对玩家不可见的秘密投骰。
  - **快捷判定**: 支持直接从角色卡点击属性或技能进行判定。

- **💬 沉浸式沟通**:
  - **实时聊天**: 全房间即时通讯。
  - **私聊 (耳语)**: 玩家与 KP 之间的秘密沟通渠道。
  - **丰富叙事**: 支持富文本描述及角色扮演动作。
  - **移动端优化**: 完美适配手机和平板，随时随地开启跑团。

- **📝 角色管理**:
  - **动态角色卡**: 创建并编辑调查员，属性自动计算。
  - **物品与背景**: 追踪物品、笔记及角色背景故事。
  - **NPC 支持**: KP 专属的 NPC 和怪物管理面板。

- **🏠 房间与会话控制**:
  - **房间管理**: 创建带密码保护的游戏房间。
  - **会话持久化**: 自动保存游戏状态和聊天记录。
  - **实时同步**: 基于 Supabase 实现多端状态毫秒级同步。

## 🛠 技术栈

- **前端**: [React](https://reactjs.org/) (v18)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **图标库**: [Lucide React](https://lucide.dev/)
- **后端 & 数据库**: [Supabase](https://supabase.com/) (PostgreSQL)

## 🚀 快速开始

按照以下步骤在本地运行项目。

### 前置要求

- **Node.js** (v16+)
- **npm** 或 **yarn**
- 一个 **Supabase** 账号

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone <repository-url>
   cd RunTable
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **环境配置**
   在根目录创建 `.env` 文件：
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **数据库设置**
   在 Supabase SQL 编辑器中运行 `db_schema.sql` 中的 SQL 命令，初始化必要的表结构（Profiles, Rooms, Characters, Messages）及行级安全策略（RLS）。

5. **运行应用**
   ```bash
   npm run dev
   ```
   在浏览器中访问 `http://localhost:5173`。

## 🎮 使用指南

1. **注册/登录**: 创建账户以开始使用。
2. **创建/加入房间**:
   - **守秘人 (KP)**: 创建新房间，设置密码（可选），并以 KP 身份进入。
   - **玩家**: 输入房间号和密码，创建或选择一张调查员卡片加入。
3. **开始游戏**:
   - 使用侧边栏管理角色状态。
   - 使用底部聊天区域进行对话和投骰。
   - 点击工具栏中的“属性”或“技能”进行快速检定。

## 📂 项目结构

```bash
RunTable/
├── components/       # 可复用 React 组件
│   ├── ChatArea.tsx  # 核心聊天与投骰界面
│   ├── Dashboard.tsx # 房间管理仪表盘
│   ├── Sidebar.tsx   # 角色列表与导航
│   └── ...
├── App.tsx           # 应用主入口
├── db_schema.sql     # 数据库结构定义
├── supabase.ts       # Supabase 客户端配置
└── types.ts          # TypeScript 类型定义
```

## 🤝 贡献指南

欢迎贡献代码！请 Fork 本仓库并提交 Pull Request。

## 📄 许可证

本项目仅供学习和个人使用。
