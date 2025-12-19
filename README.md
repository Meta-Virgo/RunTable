# RunTable 🎲

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)

[English](#english) | [中文](#chinese)

<a name="english"></a>

## 📖 Introduction

**RunTable** is a modern, web-based Tabletop Role-Playing Game (TRPG) platform designed to facilitate immersive storytelling and gameplay. Specifically tailored for systems like **Call of Cthulhu (CoC)**, it seamlessly connects Keepers (Game Masters) and Investigators (Players) in real-time, providing a robust environment for your adventures.

## ✨ Features

- **🎲 Real-time Dice Rolling**: Integrated dice roller supporting various die types (d4, d6, d8, d10, d12, d20, d100) with support for secret rolls visible only to the Keeper.
- **💬 Immersive Chat System**:
  - Real-time public room chat.
  - Private messaging (whisper) between players and the Keeper.
  - Rich text support for descriptive storytelling.
- **📝 Comprehensive Character Sheets**:
  - Manage Basic Info (Name, Role, Theme Color).
  - Track Statistics (STR, DEX, INT, etc.) automatically.
  - Inventory System and Background/Bio management.
- **🏠 Room Management**: Keepers can easily create, manage, and archive game rooms with custom settings.
- **👤 User Profiles**: Custom profiles with nicknames and bios to personalize your presence.
- **⚡ Reactive Experience**: Powered by Supabase Realtime for instant updates across all clients.

## 🛠 Tech Stack

- **Frontend**: [React](https://reactjs.org/) (v18)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL)

## 🚀 Getting Started

Follow these instructions to get a copy of the project running on your local machine.

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- A **Supabase** account and project

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd RunTable
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory and add your Supabase credentials:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   Run the SQL commands provided in `db_schema.sql` in your Supabase SQL Editor to set up the necessary tables (Profiles, Rooms, Characters, Messages) and security policies.

5. **Run the Application**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`.

## 📂 Project Structure

```bash
RunTable/
├── components/       # Reusable React components
│   ├── ChatArea.tsx  # Chat interface and logic
│   ├── Dashboard.tsx # Main user dashboard
│   ├── Sidebar.tsx   # Navigation sidebar
│   └── ...
├── App.tsx           # Main application entry
├── db_schema.sql     # Database schema for Supabase
├── supabase.ts       # Supabase client configuration
├── types.ts          # TypeScript type definitions
└── ...
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is intended for educational and personal use.

---

<a name="chinese"></a>

## 📖 简介

**RunTable** 是一个现代化的网页端跑团（TRPG）平台，旨在提供沉浸式的叙事和游戏体验。专为 **“克苏鲁的呼唤” (Call of Cthulhu, CoC)** 等规则设计，它能够实时连接守秘人（KP/主持人）和调查员（玩家），为您的冒险提供强大的支持。

## ✨ 功能特性

- **🎲 实时投骰系统**: 内置多种骰子类型 (d4, d6, d8, d10, d12, d20, d100)，支持仅 KP 可见的暗投功能。
- **💬 沉浸式聊天**:
  - 实时公共频道聊天。
  - 玩家与 KP 之间的私聊（耳语）功能。
  - 支持富文本，增强叙事表现力。
- **📝 全面角色卡**:
  - 管理基本信息（姓名、职业、主题色）。
  - 自动追踪属性统计（力量、敏捷、智力等）。
  - 物品栏系统及背景故事管理。
- **🏠 房间管理**: KP 可以轻松创建、管理和归档游戏房间。
- **👤 用户档案**: 自定义昵称和简介，展示个人风采。
- **⚡ 即时响应**: 基于 Supabase Realtime，确保所有客户端数据即时同步。

## 🛠 技术栈

- **前端**: [React](https://reactjs.org/) (v18)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **图标库**: [Lucide React](https://lucide.dev/)
- **后端 & 数据库**: [Supabase](https://supabase.com/) (PostgreSQL)

## 🚀 快速开始

遵循以下步骤在本地机器上运行项目。

### 前置要求

- **Node.js** (v16 或更高版本)
- **npm** 或 **yarn**
- 一个 **Supabase** 账号及项目

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
   在根目录创建 `.env` 文件，并添加您的 Supabase 凭证：

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **数据库设置**
   在 Supabase SQL 编辑器中运行 `db_schema.sql` 中的 SQL 命令，以创建必要的表结构（Profiles, Rooms, Characters, Messages）和安全策略。

5. **运行应用**
   ```bash
   npm run dev
   ```
   打开浏览器并访问 `http://localhost:5173`。

## 📂 项目结构

```bash
RunTable/
├── components/       # 可复用的 React 组件
│   ├── ChatArea.tsx  # 聊天界面与逻辑
│   ├── Dashboard.tsx # 主仪表盘
│   ├── Sidebar.tsx   # 侧边导航栏
│   └── ...
├── App.tsx           # 主应用入口
├── db_schema.sql     # Supabase 数据库结构定义
├── supabase.ts       # Supabase 客户端配置
├── types.ts          # TypeScript 类型定义
└── ...
```

## 🤝 贡献指南

欢迎贡献代码！请随时提交 Pull Request。

1. Fork 本项目
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

## 📄 许可证

本项目仅供学习和个人使用。
