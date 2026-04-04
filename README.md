# 🔬 AnatomySelf · 个人生命实验室

**Medical Anatomy × Physiology × BaZi WuXing Collision System**

## 架构

```
┌─────────────────────────────────────────────────┐
│              Vite + React Frontend              │
│  Login → Birth Setup → Dashboard (4 tabs)       │
│  ┌──────────┬──────────┬────────┬─────────────┐ │
│  │ 数据中心  │ 对撞雷达 │双脑洞察│ 体检指标    │ │
│  └──────────┴──────────┴────────┴─────────────┘ │
│           ↓ /api/* (Vite proxy)                 │
├─────────────────────────────────────────────────┤
│            Express Backend (port 4000)           │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐ │
│  │ /api/ocr│  │/api/     │  │ /api/destiny   │ │
│  │ Claude  │  │science   │  │ DeepSeek API   │ │
│  │ Vision  │  │Claude API│  │ (fallback:     │ │
│  │         │  │          │  │  Claude)       │ │
│  └─────────┘  └──────────┘  └────────────────┘ │
│  ┌──────────────────────────────────────────┐   │
│  │ /api/auth/*  /api/user/*  (SQLite)       │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## 快速开始

### 1. 安装依赖

```bash
git clone https://github.com/romarogu/AnatomySelf.git
cd AnatomySelf
npm install
```

### 2. 配置 API Keys

```bash
cp .env.example .env
```

编辑 `.env`：
```
ANTHROPIC_API_KEY=sk-ant-xxx    # 必需：Claude API（OCR + 科学大脑）
DEEPSEEK_API_KEY=sk-xxx         # 可选：DeepSeek（命理大脑，不填则用Claude）
PORT=4000
```

### 3. 启动开发环境

```bash
# 终端 1：启动后端 API
npm run server

# 终端 2：启动前端开发服务器
npm run dev
```

打开 `http://localhost:3000`

### 4. 生产部署

```bash
# 构建前端
npm run build

# 启动生产服务器（同时服务前端静态文件和API）
npm run server
```

打开 `http://localhost:4000`

## 部署到云服务器

### 方案 A：Railway（最简单）

1. 访问 [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. 添加环境变量 `ANTHROPIC_API_KEY` 和 `DEEPSEEK_API_KEY`
4. Start Command 设为 `npm run build && npm run server`
5. 自动获得公网 URL

### 方案 B：VPS 手动部署

```bash
# 在服务器上
git clone https://github.com/romarogu/AnatomySelf.git
cd AnatomySelf
npm install
cp .env.example .env  # 填入API keys
npm run build
PORT=80 npm run server
```

### 方案 C：Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["npm", "run", "server"]
```

## 项目结构

```
AnatomySelf/
├── index.html              # Vite 入口
├── vite.config.js          # Vite 配置（含 /api 代理）
├── package.json
├── .env.example            # 环境变量模板
├── .gitignore
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx            # React 入口
│   ├── App.jsx             # 主应用（BaZi引擎 + UI）
│   └── api.js              # 后端 API 客户端
└── server/
    └── index.js            # Express 后端（OCR/Science/Destiny/Auth）
```

## 双脑管线

| 大脑 | API | 功能 |
|------|-----|------|
| 科学大脑 | Claude API | 解剖学/生理学解读，人口统计学差异 |
| 命理大脑 | DeepSeek API | 天干生克、地支刑冲破害合会、格局、调候、通关、十二长生、旺相休囚死、神煞 |

## License

MIT
