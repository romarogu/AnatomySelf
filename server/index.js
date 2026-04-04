/**
 * AnatomySelf — Backend API Server
 * 
 * Endpoints:
 *   POST /api/ocr          — Upload PDF/image → Claude multimodal OCR
 *   POST /api/science      — Anomaly data → Claude medical analysis
 *   POST /api/destiny      — BaZi + anomalies → DeepSeek destiny analysis
 *   POST /api/auth/register — User registration
 *   POST /api/auth/login    — User login
 *   GET  /api/user/:id      — Get user data
 *   PUT  /api/user/:id      — Update user data
 * 
 * Environment variables (set in .env):
 *   ANTHROPIC_API_KEY  — Claude API key
 *   DEEPSEEK_API_KEY   — DeepSeek API key  
 *   PORT               — Server port (default 4000)
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env manually (no dotenv dependency) ──
function loadEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (existsSync(envPath)) {
    readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const [key, ...vals] = line.split('=');
      if (key && vals.length) {
        process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}
loadEnv();

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const PORT = process.env.PORT || 4000;

if (!ANTHROPIC_KEY) console.warn('⚠ ANTHROPIC_API_KEY not set — OCR and science brain will fail');
if (!DEEPSEEK_KEY) console.warn('⚠ DEEPSEEK_API_KEY not set — destiny brain will fall back to Claude');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Serve static files in production ──
const distPath = join(__dirname, '..', 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// ── Simple SQLite user store ──
let db;
try {
  const require = createRequire(import.meta.url);
  const Database = require('better-sqlite3');
  db = new Database(join(__dirname, '..', 'anatomyself.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      data TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ SQLite database ready');
} catch (e) {
  console.warn('⚠ SQLite not available, using in-memory store:', e.message);
  // Fallback: in-memory store
  const memStore = {};
  db = {
    prepare: (sql) => ({
      get: (...args) => memStore[args[0]] || null,
      run: (...args) => { memStore[args[0]] = { id: args[0], username: args[1], data: args[3] || '{}' }; },
      all: () => Object.values(memStore),
    }),
  };
}

function hashPw(pw) { return crypto.createHash('sha256').update(pw + 'anatomyself_salt').digest('hex'); }

// ════════════════════════════════════════
// AUTH ENDPOINTS
// ════════════════════════════════════════

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.toLowerCase());
    if (existing) return res.status(409).json({ error: '用户名已存在' });

    const id = crypto.randomUUID();
    const hash = hashPw(password);
    db.prepare('INSERT INTO users (id, username, password_hash, data) VALUES (?, ?, ?, ?)').run(id, username.toLowerCase(), hash, '{}');
    res.json({ success: true, userId: id, username: username.toLowerCase() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase());
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (user.password_hash !== hashPw(password)) return res.status(401).json({ error: '密码错误' });
    res.json({ success: true, userId: user.id, username: user.username, data: JSON.parse(user.data || '{}') });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/user/:id', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({ userId: user.id, username: user.username, data: JSON.parse(user.data || '{}') });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/user/:id', (req, res) => {
  try {
    db.prepare('UPDATE users SET data = ? WHERE id = ?').run(JSON.stringify(req.body.data || {}), req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// HELPER: Call Claude API
// ════════════════════════════════════════
async function callClaude(messages, system, maxTokens = 4000) {
  const body = { model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, messages };
  if (system) body.system = system;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${errText.substring(0, 300)}`);
  }

  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content || []).map(c => c.text || '').join('');
}

// ════════════════════════════════════════
// HELPER: Call DeepSeek API (OpenAI-compatible)
// ════════════════════════════════════════
async function callDeepSeek(prompt, system) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  // If DeepSeek key is available, use DeepSeek; otherwise fall back to Claude
  if (DEEPSEEK_KEY) {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.warn(`DeepSeek API failed (${resp.status}), falling back to Claude`);
      // Fall back to Claude
      return await callClaude([{ role: 'user', content: prompt }], system);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  } else {
    // No DeepSeek key — use Claude
    return await callClaude([{ role: 'user', content: prompt }], system);
  }
}

// ════════════════════════════════════════
// HELPER: Parse JSON from AI response
// ════════════════════════════════════════
function parseAIJson(txt) {
  if (!txt) return null;
  let s = txt.trim();
  // Remove markdown fences
  s = s.replace(/^```+\s*(?:json)?\s*\n?/i, '').replace(/\n?\s*```+\s*$/g, '').trim();
  // Find JSON object
  const start = s.indexOf('{');
  if (start < 0) return null;
  s = s.substring(start);
  // Brace-depth match
  let depth = 0, end = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') depth++;
    if (s[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end > 0) s = s.substring(0, end + 1);
  // Parse
  try { return JSON.parse(s); } catch {
    try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
  }
}

// ════════════════════════════════════════
// POST /api/ocr — Multimodal OCR via Claude
// ════════════════════════════════════════
app.post('/api/ocr', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传文件' });

    const b64 = req.file.buffer.toString('base64');
    const isPdf = req.file.mimetype === 'application/pdf';
    const mediaType = req.file.mimetype;

    const doc = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } };

    const txt = await callClaude([{
      role: 'user',
      content: [doc, {
        type: 'text',
        text: `提取体检报告中的所有医学检验指标。返回纯JSON（不要markdown标记）:
{"metrics":[{"name":"中文名","code":"英文缩写如ALT/FBG/RHR/FVC/Cr/BP/TC","value":数值,"unit":"单位","ref_low":参考下限,"ref_high":参考上限}],"report_date":"报告日期","institution":"检测机构","raw_summary":"其他重要信息"}`
      }]
    }], '你是专业的体检报告OCR解析器。直接返回纯JSON，不要使用markdown代码块。');

    const parsed = parseAIJson(txt);
    res.json(parsed || { metrics: [], raw_summary: txt.substring(0, 500) });
  } catch (e) {
    res.status(500).json({ error: 'OCR 失败: ' + e.message });
  }
});

// ════════════════════════════════════════
// POST /api/science — Medical Science Brain (Claude)
// ════════════════════════════════════════
app.post('/api/science', async (req, res) => {
  try {
    const { age, sex, anomalies } = req.body;
    if (!anomalies || !anomalies.length) return res.json({ items: [], summary: '所有指标均在正常范围内。' });

    const desc = anomalies.map(a => `${a.cn}(${a.key}): 实测值 ${a.value} ${a.unit}，参考范围 ${a.low}-${a.high}，状态: ${a.status}`).join('\n');

    const prompt = `你是一位资深的临床医学专家，精通人体解剖学和生理学。

【患者信息】
年龄: ${age}岁
性别: ${sex === 'M' ? '男' : '女'}性
人群分类: ${age < 13 ? '儿童' : age < 18 ? '青少年' : age < 60 ? '成年人' : '老年人'}

【异常指标】
${desc}

请针对每个异常指标给出基于解剖学和生理学的科学解读。解读必须体现该患者年龄和性别的人口统计学特征。

直接返回纯JSON（不要markdown标记）:
{"items":[{"metric":"指标代码","metric_cn":"中文名","organ_system":"对应五行（木火土金水）","severity":"mild/moderate/severe","anatomical_context":"解剖学位置和功能","physiological_analysis":"病理生理学机制","demographic_specific":"针对${age}岁${sex === 'M' ? '男' : '女'}性的特殊说明","recommendation":"建议"}],"summary":"整体健康风险评估总结"}`;

    const txt = await callClaude(
      [{ role: 'user', content: prompt }],
      '你是临床医学专家。直接返回纯JSON，不要使用markdown代码块。'
    );

    const parsed = parseAIJson(txt);
    res.json(parsed || { items: [], summary: txt.substring(0, 500) });
  } catch (e) {
    res.status(500).json({ error: '科学分析失败: ' + e.message });
  }
});

// ════════════════════════════════════════
// POST /api/destiny — BaZi Destiny Brain (DeepSeek)
// ════════════════════════════════════════

const DESTINY_SYSTEM = `你是一位精通八字命理学的顶级命理师，同时深谙中医藏象学说。你的分析必须包含以下维度：

【核心分析框架】
1. 八字组成：年柱、月柱、日柱、时柱的天干地支完整拆解
2. 天干生克反应：十天干之间的生克关系（甲木克戊土、丙火生戊土等）
3. 地支刑冲破害合会反应：
   - 六合：子丑合、寅亥合、卯戌合、辰酉合、巳申合、午未合
   - 三合：申子辰水局、寅午戌火局、亥卯未木局、巳酉丑金局
   - 三会：寅卯辰东方木、巳午未南方火、申酉戌西方金、亥子丑北方水
   - 六冲：子午冲、丑未冲、寅申冲、卯酉冲、辰戌冲、巳亥冲
   - 三刑：寅巳申无恩刑、丑未戌恃势刑、子卯无礼刑
   - 六害：子未害、丑午害、寅巳害、卯辰害、申亥害、酉戌害
   - 破：子酉破、丑辰破、寅亥破、卯午破、巳申破、未戌破
4. 格局判定：正官格、七杀格、正财格、偏财格、食神格、伤官格、正印格、偏印格等
5. 调候用神：根据日主出生月份判断寒暖燥湿，确定调候所需五行
6. 通关用神：当两行相战时，找出通关的五行
7. 十二长生：长生、沐浴、冠带、临官、帝旺、衰、病、死、墓、绝、胎、养
8. 旺相休囚死：根据月令判断日主及各五行的旺衰状态
9. 神煞：天乙贵人、文昌贵人、驿马星、桃花星、华盖星、天德月德、羊刃、亡神、劫煞等

【健康关联分析】
将上述命理分析与五脏六腑的中医对应关系结合，分析健康趋势。

直接返回纯JSON，不要使用markdown代码块。`;

app.post('/api/destiny', async (req, res) => {
  try {
    const { baziStr, dayMaster, dayMasterElement, dayun, liunian, wuxing, findings } = req.body;

    const prompt = `【用户八字命盘】
完整八字: ${baziStr}
日主: ${dayMaster} (${dayMasterElement})

【当前时运】
大运: ${dayun.lbl} (${dayun.el})
流年: ${liunian.lbl} (${liunian.el})

【五行力量分布】
木: ${wuxing['木']}% | 火: ${wuxing['火']}% | 土: ${wuxing['土']}% | 金: ${wuxing['金']}% | 水: ${wuxing['水']}%

【科学大脑发现的健康异常】
${findings}

请进行完整的命理分析（天干生克、地支刑冲破害合会、格局、调候、通关、十二长生、旺相休囚死、神煞），并将命理分析与健康异常进行对撞。

返回纯JSON:
{"bazi_analysis":{"tiangang_relations":"天干生克","dizhi_relations":"地支刑冲破害合会","pattern":"格局","tiaohou":"调候","tongguan":"通关","twelve_stages":"十二长生","wangxiang":"旺相休囚死","shenshas":"神煞"},"collision_items":[{"metric":"指标代码","organ_wuxing":"五行","current_forces":"五行作用力分析","evolution_path":"演化趋势","risk_window":"风险窗口","prevention":"养生建议"}],"temporal_outlook":"未来6月展望","key_dates":["关键日期"]}`;

    const txt = await callDeepSeek(prompt, DESTINY_SYSTEM);
    const parsed = parseAIJson(txt);
    res.json(parsed || { collision_items: [], temporal_outlook: txt.substring(0, 600) });
  } catch (e) {
    res.status(500).json({ error: '命理分析失败: ' + e.message });
  }
});

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    claude: !!ANTHROPIC_KEY,
    deepseek: !!DEEPSEEK_KEY,
    timestamp: new Date().toISOString(),
  });
});

// ── SPA fallback ──
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Not found. Run `npm run build` first.' });
  }
});

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║   AnatomySelf · 个人生命实验室            ║
  ║   Backend API running on port ${PORT}        ║
  ║   Claude API: ${ANTHROPIC_KEY ? '✓ configured' : '✗ missing'}            ║
  ║   DeepSeek API: ${DEEPSEEK_KEY ? '✓ configured' : '✗ missing (fallback: Claude)'}     ║
  ╚═══════════════════════════════════════════╝
  `);
});
