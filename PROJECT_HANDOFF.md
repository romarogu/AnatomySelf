# AnatomySelf — 项目完整技术文档

> 最后更新：2026-04-18
> 仓库：https://github.com/romarogu/AnatomySelf
> 线上：https://anatomyself.com（Vercel Pro 部署）

---

## 一、产品概述

AnatomySelf 是一款**双脑健康分析应用**，将**西方临床医学指标**（体检数据）与**东方八字命理学**（BaZi）进行"对撞分析"，为用户提供个性化的健康洞察。

**核心卖点**：在一个界面中同时看到"科学脑"（临床指标分析）和"命理脑"（五行能量审计）的交叉对比。

**目标用户**：海外华人、对 Eastern Mysticism / Human Design / Wellness Astrology 感兴趣的英文用户、biohacking 社群。

**商业模式**：Freemium — 基础分析免费，深度报告/高级对话/PDF导出 为 Pro 付费功能（Stripe 集成已预留，尚未上线）。

---

## 二、技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | React 18 + Vite 6 | 单页应用，无路由库 |
| **UI** | 纯 inline styles | 暗色主题，古籍美学（暗金+宣纸质感） |
| **可视化** | D3.js v7 | 五维雷达图（Resonance Radar） |
| **PDF** | html2canvas + jsPDF | 生命蓝图报告 + 周报 |
| **部署** | Vercel Pro | 前端 CDN + Serverless Functions |
| **后端 API** | Vercel Serverless (Node.js) | `/api/*.js`，无 Express |
| **数据库** | Supabase PostgreSQL | Auth + RLS + 4张表 |
| **AI — 科学脑** | 智谱 GLM-4-Plus | 指标解读、OCR |
| **AI — 命理脑** | 智谱 GLM-5 (Deep Thinking) + GLM-4-Plus | 两步法：思考→JSON转换 |
| **AI — 对话** | 智谱 GLM-5 (命理) / GLM-4-Plus (科学) | Deep Chat |
| **AI — OCR** | GLM-4V-Plus (图片) / GLM-OCR (PDF) | 体检报告识别 |
| **备份 AI** | DeepSeek / Claude (gptsapi.net) | 智谱失败时的 fallback |
| **i18n** | 自建 JSON 翻译 | 中文/英文双语 |
| **PWA** | manifest.json + sw.js | 可安装到手机主屏 |

---

## 三、项目结构

```
AnatomySelf/
├── api/                          # Vercel Serverless Functions
│   ├── destiny.js                # 命理脑 — GLM-5思考+GLM-4-Plus转JSON（两步法）
│   ├── science.js                # 科学脑 — GLM-4-Plus 指标分析
│   ├── chat.js                   # 深度对话 — 科学脑+命理脑双通道
│   ├── ocr.js                    # OCR — 图片(GLM-4V) / PDF(GLM-OCR)
│   ├── user-data.js              # Supabase 数据读写代理
│   ├── health.js                 # 健康检查端点
│   └── test-apis.js              # API 连通性测试
├── src/
│   ├── App.jsx                   # 主应用（~2700行，含全部业务逻辑）
│   ├── api.js                    # 前端 API 客户端（fetch wrapper）
│   ├── LandingPage.jsx           # 营销首页
│   ├── MethodologyPage.jsx       # 方法论白皮书页
│   ├── ReportGenerator.jsx       # PDF 报告生成器
│   ├── ShareCard.jsx             # 社交分享卡片
│   ├── supabaseClient.js         # Supabase 初始化
│   ├── main.jsx                  # React 入口
│   └── i18n/
│       ├── index.jsx             # i18n Provider + useI18n hook
│       ├── en.json               # 英文翻译
│       └── zh.json               # 中文翻译
├── public/                       # 静态资源
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service Worker
│   └── icon-*.png                # App 图标
├── supabase-schema.sql           # 数据库建表脚本
├── vercel.json                   # Vercel 部署配置
├── package.json                  # 依赖
└── vite.config.js                # Vite 配置
```

---

## 四、核心数据流

### 4.1 用户注册/登录
```
用户输入 email+password → apiRegister/apiLogin (src/api.js)
  → Supabase Auth (signUp/signInWithPassword)
  → 自动触发 handle_new_user() → 创建 profiles 行
  → 前端存储 session，加载 profile + metrics + analyses
```

### 4.2 八字计算（纯前端，无 API）
```
用户输入 出生年月日时 → App.jsx 内置天干地支算法
  → 计算四柱（年柱/月柱/日柱/时柱）
  → 计算五行能量百分比（destWX）
  → 计算大运流年
  → 可选：真太阳时校正（基于经度）
  → 所有 BaZi 计算在客户端完成，不依赖服务器
```

### 4.3 双脑对撞分析
```
用户点击"启动双脑对撞"按钮 → startAnalysisCeremony()
  ├── Step 1: 科学脑 (doSci)
  │     前端收集所有指标（正常+异常）→ POST /api/science
  │     → GLM-4-Plus 分析 → 返回 {sentinel, items[], summary}
  │
  └── Step 2: 命理脑 (doDst)
        前端构建 chartData（四柱+五行+大运+流年+健康发现）
        → POST /api/destiny
        → Step 2a: GLM-5 (thinking=enabled) 生成自由文本分析
        → Step 2b: GLM-4-Plus 将文本转为结构化 JSON
        → 返回 {bazi_analysis, collision_items[], temporal_outlook, key_dates[]}
```

### 4.4 Impact Cards 渲染
```
5个五行卡片（木火土金水）：
  左栏 CLINICAL: sciItem.clinical_fact + recommendation
  右栏 ENERGETIC: dstItem.current_forces + prevention + risk_window
  底部: "展开详情" 按钮（expandedCards state 控制折叠）
  默认折叠: 只显示第一句摘要
  展开: 显示完整分析 + recommendation + risk_window
```

### 4.5 深度对话
```
用户选择 科学脑/命理脑 → 输入问题或点击推荐问题
  → POST /api/chat {brain, question, context, lang}
  → 命理脑: GLM-5 (thinking=enabled, 45s超时)
  → 科学脑: GLM-4-Plus (20s超时)
  → 返回 {answer}
  → 推荐问题: 30题/脑, 随机显示3个, 发送后自动刷新
```

---

## 五、API 端点详解

### POST /api/science
**功能**：临床指标分析（科学脑）
**输入**：`{age, sex, anomalies[], allMetrics[], lang}`
**AI**：GLM-4-Plus（智谱）→ Claude 备份
**输出**：`{sentinel, items[{metric, organ_system, severity, clinical_fact, recommendation}], summary}`
**Prompt 角色**：Clinical Intelligence — 诊断医师精准+关怀温度

### POST /api/destiny
**功能**：八字命理分析（命理脑）
**输入**：`{chartData, baziStr, lang}`
**AI**：两步法 — GLM-5(thinking) 生成分析 → GLM-4-Plus 转 JSON
**输出**：`{bazi_analysis, collision_items[{organ_wuxing, current_forces, risk_window, prevention}], temporal_outlook, key_dates[], _thinking}`
**Prompt 角色**：Digital Alchemist — 数字炼金术师，精通子平八字+功能医学

### POST /api/chat
**功能**：深度对话
**输入**：`{brain:"science"|"destiny", question, context, lang}`
**AI**：命理脑用 GLM-5(thinking)，科学脑用 GLM-4-Plus
**输出**：`{answer}`

### POST /api/ocr
**功能**：体检报告 OCR
**输入**：`{base64, mediaType}`
**AI**：图片 → GLM-4V-Plus，PDF → GLM-OCR (layout_parsing) → GLM-4-Plus 结构化
**输出**：`{metrics[{name, code, value, unit}], report_date, institution}`
**限制**：Vercel body 4.5MB 限制，PDF 实际限 ~3MB

### POST /api/user-data
**功能**：Supabase 数据代理
**操作**：profile CRUD, metrics UPSERT, analyses save/load

---

## 六、Vercel 环境变量

| 变量名 | 用途 | 示例值 |
|--------|------|--------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL | `https://bbubmwldwmtyyvgczela.supabase.co` |
| `VITE_SUPABASE_KEY` | Supabase publishable key | `sb_publishable_...` |
| `ZHIPU_API_KEY` | 智谱 AI API Key（主力） | `8839ecb...` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（备份） | `sk-...` |
| `CLAUDE_API_KEY` | Claude 代理 API Key（备份） | `sk-...`（通过 gptsapi.net） |

---

## 七、Supabase 数据库

### 表结构
- **profiles** — 用户资料（birth info, tier, stripe_customer_id）
- **metrics** — 体检指标（user_id + key UNIQUE, UPSERT）
- **analyses** — AI 分析缓存（science/destiny 类型，JSONB）
- **payments** — 支付记录（预留，未启用）

### 安全
- 所有表启用 RLS（Row Level Security）
- 用户只能访问自己的数据
- Auth trigger 自动创建 profile

---

## 八、前端核心组件（App.jsx ~2700行）

### 八字算法（纯前端）
- 天干地支表、五行映射、十神关系
- 大运流年计算
- 真太阳时校正（经度→时差）
- 五行能量百分比计算（destWX）

### 15 项标准指标
```
ALT, AST, TBIL (肝胆/木)
SBP, DBP, RHR (心血管/火)
FBG, HbA1c, TG (脾胃代谢/土)
FVC, SpO2, LDL_C (呼吸/金)
Cr, UA, VitD (肾脏/水)
```
每项指标有年龄+性别相关的参考范围（gR 函数）。

### 五维雷达图（InteractiveRadar）
- D3.js SVG 渲染
- 双层多边形：命理层（金色）+ 医学层（白色）
- 悬浮提示：divergence + resonance 百分比
- 时空推演滑块（Time Slider）

### 页面 Tab
1. **数据中心** — 上传/OCR/手动录入指标 + 分析仪式按钮
2. **对撞分析** — 雷达图 + Impact Cards + Temporal Outlook
3. **生命微调** — 从 collision_items 提取的调理建议
4. **深度对话** — 双脑对话 + 推荐问题 + 免责提示
5. **体检指标** — 原始数据查看/编辑

### 移动端适配
- `isMobile` = `window.innerWidth ≤ 860`
- 移动端：底部 Tab Bar + 顶部横向滚动摘要条
- 桌面端：左侧 Sidebar + 顶部 Tab

---

## 九、AI Prompt 架构

### 命理脑 — Digital Alchemist（数字炼金术师）

**对撞分析 (destiny.js)**：
```
角色：精通子平八字与现代功能医学的"数字炼金术师"
知识框架：
  1. 基础建模：四柱天干地支
  2. 能量动态：天干生克 + 地支刑冲破害合会
  3. 强弱审计：旺相休囚死 + 十二长生
  4. 格局与平衡：格局识别 + 调候 + 通关
  5. 神煞预警：羊刃/血支/白虎等
对撞逻辑：五行→脏腑映射 + 指标异常→能量冲突搜索
语调：神秘、冷峻、数据驱动
```

**深度对话 (chat.js meta brain)**：
```
角色：数字炼金术师 — 咨询模式
风格：教练感，温暖共情但基于命盘数据
结构：直接回答→命盘推导→具体建议
术语翻译：能量冲突(not 六冲)，资源流(not 印星生身)
```

### 科学脑 — Clinical Intelligence（临床健康智能）

**对撞分析 (science.js)**：
```
角色：临床健康分析师
知识框架：
  1. 指标解读：临床语境分析
  2. 系统思维：代谢综合征、心血管级联、肝肾轴
  3. 风险分层：短期+长期，共病聚集
  4. 全面评估：正常指标也评论（边界值、年龄特异性）
  5. 预防智能：亚临床趋势识别
语调：专业但温暖，像关心你的医生
```

---

## 十、当前已知问题 & 待办

### 已知问题
1. **命理脑 ENERGETIC 列内容不稳定** — GLM-5 深度思考生成的分析在转 JSON 时可能丢失内容。两步法（思考→转换）有时第二步缩短了内容。
2. **展开详情按钮**：在某些浏览器中点击反馈不明显，需要增强视觉反馈。
3. **analyses 表累积** — 每次分析都 INSERT，没有去重/清理机制。
4. **英文模式** — 部分 UI 标签可能仍显示中文（需逐项排查）。

### 待办功能
- [ ] Stripe 支付集成（profiles.tier + payments 表已就绪）
- [ ] 社交媒体分享卡 1080×1080（设计已确定，代码未写）
- [ ] 真太阳时：扩展城市数据库
- [ ] Push 通知基础设施
- [ ] 域名绑定 anatomyself.com
- [ ] 大报告 PDF 视觉升级（已完成周报升级，主报告待做）

---

## 十一、本地开发

```bash
# 克隆
git clone https://github.com/romarogu/AnatomySelf.git
cd AnatomySelf

# 安装
npm install

# 环境变量（创建 .env）
VITE_SUPABASE_URL=https://bbubmwldwmtyyvgczela.supabase.co
VITE_SUPABASE_KEY=sb_publishable_...
ZHIPU_API_KEY=...
DEEPSEEK_API_KEY=...

# 启动（需要同时启动 Vite dev server 和本地 API server）
npm run dev          # 前端 :3000
node server/index.js # 后端 :4000（本地代理 /api/*）

# 构建
npm run build
```

### Vercel 部署
推送到 `main` 分支自动部署。Vercel 会：
1. 运行 `npx vite build`
2. 将 `dist/` 部署为静态站
3. 将 `api/*.js` 部署为 Serverless Functions

---

## 十二、设计原则

1. **去土味化** — 八字概念用现代神秘学语言表达，不是传统算命风格
2. **BioSelf / MetaSelf 严格分离** — 临床数据和命理数据永远在独立的列中
3. **Oracle vs Coach** — 对撞分析用神谕语调（冷峻精准），深度对话用教练语调（温暖可执行）
4. **古籍美学** — 暗色背景 + 暗金色系 + 宣纸纹理 + Noto Serif SC
5. **双语原生** — 不是翻译，而是两套独立的文案体系
