# 🔬 AnatomySelf · 个人生命实验室

Medical Anatomy × Physiology × BaZi WuXing Collision System

## 当前主线架构（推荐理解）

本仓库当前以 **Vite + React 前端** + **Vercel Serverless API (`/api/*.js`)** + **Supabase** 为主线。

```text
src/* (React SPA)
  └─ fetch('/api/*')
       └─ api/*.js (Vercel Functions)
            └─ AI providers + Supabase
```

`server/index.js` 是保留的本地 Express 方案（历史/备用），不是当前默认部署路径。

---

## 本地开发（单一事实来源）

请直接参考：

- `docs/LOCAL_DEVELOPMENT.md`

该文档是本仓库唯一权威的本地开发指南；若其他文档有冲突，以该文档为准。

---

## 快速开始（摘要）

### 1) 安装依赖

```bash
git clone https://github.com/romarogu/AnatomySelf.git
cd AnatomySelf
npm install
```

### 2) 配置环境变量

```bash
cp .env.example .env.local
```

环境变量说明详见 `docs/LOCAL_DEVELOPMENT.md`。

### 3) 启动本地开发（两终端）

```bash
# 终端 1：启动本地 Serverless API（监听 4000，匹配 vite proxy）
npx vercel dev --listen 4000

# 终端 2：启动前端
npm run dev
```

访问：`http://localhost:3000`

> 说明：`vite.config.js` 已将 `/api` 代理到 `http://localhost:4000`。

### 4) 构建与预览

```bash
npm run build
npm run preview
```

---

## 部署（生产）

生产以 Vercel 为准：

- `vercel.json` 使用 `npx vite build`
- `dist/` 作为静态输出
- `api/*.js` 作为 Serverless Functions

---

## 项目结构

```text
AnatomySelf/
├── api/                    # Vercel Serverless Functions（主线 API）
├── src/                    # React 前端
├── public/                 # 静态资源（PWA manifest/sw 等）
├── supabase-schema.sql     # Supabase 表结构 + RLS
├── vercel.json             # Vercel 构建与函数配置
├── vite.config.js          # Vite dev 配置（含 /api 代理）
└── server/index.js         # Express 本地备用实现（非默认）
```

---

## 常用脚本

`package.json` 当前可用脚本：

- `npm run dev`：前端开发服务器
- `npm run build`：打包
- `npm run preview`：预览打包结果

---

## 备用说明：Express 本地模式（非推荐）

如需使用 `server/index.js`，请先阅读 `docs/LOCAL_DEVELOPMENT.md` 中的 “Legacy fallback” 章节。建议优先使用 Vercel Serverless 本地联调方式。

---

## License

MIT
