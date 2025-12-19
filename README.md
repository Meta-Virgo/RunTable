# RunTable

[English](#english) | [中文](#chinese)

<a name="english"></a>

## English

RunTable is a modern, web-based Tabletop Role-Playing Game (TRPG) platform designed to facilitate immersive storytelling and gameplay, specifically tailored for systems like Call of Cthulhu (CoC). It connects Keepers (Game Masters) and Investigators (Players) in real-time.

### Features

- **Real-time Gameplay**: Instant messaging and updates for smooth game sessions.
- **Room Management**: Keepers can create and manage game rooms with custom titles and descriptions.
- **Character Sheets**: Comprehensive character creation and management including:
  - Basic Info (Name, Role, Theme Color)
  - Statistics (STR, DEX, INT, etc.)
  - Inventory System
  - Background/Bio
- **Dice Rolling**: Integrated dice roller for various die types (d4, d6, d8, d10, d12, d20, d100) with secret roll support.
- **Chat System**:
  - Public room chat
  - Private messaging (whisper) between players and Keeper
  - Rich text support
- **User Profiles**: Custom user profiles with nicknames and bios.

### Tech Stack

- **Frontend**: [React](https://reactjs.org/) with [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL)

### Getting Started

Follow these instructions to get a copy of the project running on your local machine.

#### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Supabase account and project

#### Installation

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
   Create a `.env` file in the root directory (or rename `.env.example` if available) and add your Supabase credentials:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   Run the SQL commands provided in `db_schema.sql` in your Supabase SQL Editor to set up the necessary tables (Profiles, Rooms, Characters, Messages) and security policies.

#### Running the Application

Start the development server:

```bash
npm run dev
```

Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`).

### Project Structure

- `components/`: Reusable React components (ChatArea, Sidebar, Modals, etc.)
- `db_schema.sql`: Database schema definitions for Supabase.
- `supabase.ts`: Supabase client configuration.
- `types.ts`: TypeScript type definitions.
- `App.tsx`: Main application component.

### License

This project is private and intended for educational/personal use.

---

<a name="chinese"></a>

## 中文 (Chinese)

RunTable 是一个现代化的网页端跑团（TRPG）平台，旨在提供沉浸式的叙事和游戏体验，专为“克苏鲁的呼唤”（Call of Cthulhu, CoC）等规则设计。它能够实时连接守秘人（KP/主持人）和调查员（玩家）。

### 功能特性

- **实时游戏**：即时消息和状态更新，确保流畅的游戏体验。
- **房间管理**：主持人可以创建和管理游戏房间，自定义标题和描述。
- **角色卡管理**：全面的角色创建和管理功能，包括：
  - 基础信息（姓名、角色、主题色）
  - 属性统计（力量、敏捷、智力等）
  - 物品栏系统
  - 背景故事/简介
- **骰子系统**：集成的骰子投掷器，支持多种骰子类型（d4, d6, d8, d10, d12, d20, d100），并支持暗投。
- **聊天系统**：
  - 公共房间聊天
  - 玩家与主持人之间的私聊（耳语）
  - 富文本支持
- **用户资料**：自定义用户资料，包含昵称和简介。

### 技术栈

- **前端**：[React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **构建工具**：[Vite](https://vitejs.dev/)
- **样式**：[Tailwind CSS](https://tailwindcss.com/)
- **图标**：[Lucide React](https://lucide.dev/)
- **后端 & 数据库**：[Supabase](https://supabase.com/) (PostgreSQL)

### 快速开始

按照以下说明在本地机器上运行项目。

#### 前置要求

- Node.js (v16 或更高版本)
- npm 或 yarn
- 一个 Supabase 账号和项目

#### 安装步骤

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
   在根目录下创建一个 `.env` 文件（如果有 `.env.example` 可以重命名），并添加你的 Supabase 凭证：

   ```env
   VITE_SUPABASE_URL=你的_supabase_project_url
   VITE_SUPABASE_ANON_KEY=你的_supabase_anon_key
   ```

4. **数据库设置**
   在 Supabase SQL 编辑器中运行 `db_schema.sql` 提供的 SQL 命令，以设置必要的表（Profiles, Rooms, Characters, Messages）和安全策略。

#### 运行应用

启动开发服务器：

```bash
npm run dev
```

打开浏览器并访问终端中显示的 URL（通常是 `http://localhost:5173`）。

### 项目结构

- `components/`: 可复用的 React 组件（ChatArea, Sidebar, Modals 等）
- `db_schema.sql`: Supabase 数据库架构定义。
- `supabase.ts`: Supabase 客户端配置。
- `types.ts`: TypeScript 类型定义。
- `App.tsx`: 主应用程序组件。

### 许可证

本项目为私有项目，仅供教育/个人使用。
