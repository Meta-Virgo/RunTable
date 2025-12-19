# RunTable 🎲

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)

> A modern, real-time Tabletop Role-Playing Game (TRPG) platform built for immersive storytelling.

[中文文档](./README_CN.md)

## 📖 Introduction

**RunTable** is a sleek, web-based TRPG platform designed to facilitate seamless gameplay for systems like **Call of Cthulhu (CoC)**. By connecting Keepers (Game Masters) and Investigators (Players) in real-time, it offers a robust environment for your adventures, featuring integrated dice rollers, character management, and immersive communication tools.

## ✨ Features

- **🎲 Advanced Dice Roller**: 
  - Supports standard dice (d4, d6, d8, d10, d12, d20, d100).
  - **Secret Rolls**: Keepers can perform hidden rolls invisible to players.
  - **Skill Checks**: One-click skill and attribute checks directly from the character sheet.

- **💬 Immersive Communication**:
  - **Real-time Chat**: Instant messaging for the entire room.
  - **Whisper System**: Private messaging between players and the Keeper.
  - **Rich Narrative**: Support for detailed descriptions and roleplay actions.
  - **Mobile Optimized**: Fully responsive design for play on-the-go.

- **📝 Character Management**:
  - **Dynamic Sheets**: Create and edit investigators with auto-calculating stats.
  - **Inventory & Backstory**: Track items, notes, and character history.
  - **NPC Support**: Keepers can manage NPCs and Monsters with specialized sheets.

- **🏠 Room & Session Control**:
  - **Room Management**: Create password-protected rooms.
  - **Session Persistence**: Auto-save game state and chat history.
  - **Real-time Synchronization**: Powered by Supabase for instant updates across all clients.

## 🛠 Tech Stack

- **Frontend**: [React](https://reactjs.org/) (v18)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL)

## 🚀 Getting Started

Follow these instructions to set up the project locally.

### Prerequisites

- **Node.js** (v16+)
- **npm** or **yarn**
- A **Supabase** account

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
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   Run the SQL commands from `db_schema.sql` in your Supabase SQL Editor to initialize tables (Profiles, Rooms, Characters, Messages) and Row Level Security (RLS) policies.

5. **Run the Application**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:5173` in your browser.

## 🎮 Usage Guide

1. **Sign Up/Login**: Create an account to get started.
2. **Create/Join a Room**:
   - **Keepers**: Create a new room, set a password (optional), and enter as the Keeper.
   - **Players**: Find a room ID, enter the password, and create/select an Investigator.
3. **Gameplay**:
   - Use the sidebar to manage characters.
   - Use the bottom chat area for dialogue and dice rolls.
   - Click "Attributes" or "Skills" in the toolbar for quick checks.

## 📂 Project Structure

```bash
RunTable/
├── components/       # Reusable React components
│   ├── ChatArea.tsx  # Core chat & dice interface
│   ├── Dashboard.tsx # Room management dashboard
│   ├── Sidebar.tsx   # Character list & navigation
│   └── ...
├── App.tsx           # Main application entry
├── db_schema.sql     # Database schema definition
├── supabase.ts       # Supabase client config
└── types.ts          # TypeScript definitions
```

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a Pull Request.

## 📄 License

This project is intended for educational and personal use.
