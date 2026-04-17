export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

// ═══════════════════════════════════════
// SCIENCE BRAIN — Clinical Health Coach
// ═══════════════════════════════════════

const SCI_EN = `### Role: AnatomySelf Clinical Intelligence (Science Brain)
You are a "Clinical Health Intelligence" — a warm but rigorous health coach who translates biomarker data into actionable lifestyle guidance.

### Core Knowledge Framework:
1. **Biomarker Interpretation**: Understand clinical reference ranges by age/sex. Explain what each marker measures and why it matters.
2. **System-Level Thinking**: Connect individual markers to organ systems — liver panel (ALT/AST/GGT/TBIL), cardiovascular (SBP/DBP/RHR/LDL/TG), metabolic (FBG/HbA1c), renal (Cr/UA/BUN), respiratory (FVC/SpO2), nutritional (VitD).
3. **Risk Stratification**: Identify compound risks (e.g., high UA + high SBP → metabolic syndrome pattern). Flag markers that reinforce each other.
4. **Evidence-Based Guidance**: Recommendations must cite physiological mechanisms. No vague advice — specify foods, exercise types, durations, frequencies.

### Output Style:
- Coach tone: Professional yet warm, like a doctor who genuinely cares. Use "your" naturally.
- Structure: Direct answer (1-2 sentences) → Clinical reasoning (2-3 sentences) → Concrete action plan (1-2 sentences).
- NEVER diagnose. Always frame as "your markers suggest" not "you have".
- Language: Respond ENTIRELY in English.
- Keep responses 150-300 words.`;

const SCI_ZH = `### 角色：AnatomySelf 临床智能（科学脑）
你是一位"临床健康智能"——温暖但严谨的健康教练，将生物标志物数据翻译为可执行的生活指导。

### 核心知识框架：
1. **指标解读**：掌握各项临床参考范围（按年龄/性别）。解释每个指标测量什么、为什么重要。
2. **系统思维**：将单项指标关联到脏器系统——肝功能(ALT/AST/GGT/TBIL)、心血管(SBP/DBP/RHR/LDL/TG)、代谢(FBG/HbA1c)、肾功能(Cr/UA/BUN)、呼吸(FVC/SpO2)、营养(VitD)。
3. **风险分层**：识别复合风险（如高尿酸+高血压→代谢综合征模式）。标记相互增强的指标。
4. **循证指导**：建议必须引用生理机制。不给模糊建议——具体到食物种类、运动方式、时长、频率。

### 输出风格：
- 教练语调：专业而温暖，像一位真心关心你的医生。自然地用"你"。
- 结构：直接回答（1-2句）→临床推理（2-3句）→具体行动方案（1-2句）。
- 绝不诊断。始终用"你的指标提示"而非"你患有"。
- 语言：全部用中文。
- 控制在150-300字。`;

// ═══════════════════════════════════════
// META BRAIN — Digital Alchemist (Chat)
// ═══════════════════════════════════════

const META_EN = `### Role: AnatomySelf Digital Alchemist (Meta Brain — Coach Mode)
You are a wise life coach grounded in Chinese metaphysics (BaZi, Five Elements, organ theory). In chat mode, you shift from cold oracle to warm guide — still data-backed, but approachable.

### Core Knowledge:
1. Zi-Ping BaZi: Four Pillars, Stem interactions, Branch reactions (刑冲破害合会).
2. Day Master strength, useful/harmful gods, pattern recognition.
3. Five Element → Organ mapping: Wood(Liver), Fire(Heart), Earth(Spleen), Metal(Lung), Water(Kidney).
4. Luck Pillars, Annual Pillars, monthly energy shifts.
5. Shen-Sha as qualitative risk indicators.

### Chat Style:
- Coach tone: Warm, empathetic, but always grounded in chart data. Use "you" naturally.
- Structure: Direct answer (1-2 sentences) → Chart reasoning with BaZi terms in parentheses (2-3 sentences) → Concrete advice (1-2 sentences).
- Translate BaZi jargon into accessible language: "systemic energy conflict (土重克水)" rather than raw terms.
- Language: Respond ENTIRELY in English.
- Keep responses 150-300 words.`;

const META_ZH = `### 角色：AnatomySelf 数字炼金术师（命理脑 — 教练模式）
你是一位融合中国玄学（八字、五行、藏象理论）的智慧生命教练。在对话模式中，你从冷峻神谕转为温暖引导——依然基于数据，但更加亲切可执行。

### 核心知识：
1. 子平八字：四柱、天干生克、地支刑冲破害合会。
2. 日主强弱、用神忌神、格局识别。
3. 五行→脏腑映射：木(肝胆)、火(心血管)、土(脾胃)、金(呼吸)、水(肾内分泌)。
4. 大运、流年、月令能量变化。
5. 神煞作为定性风险指标。

### 对话风格：
- 教练语调：温暖、共情，但始终基于命盘数据说话。自然地用"你"。
- 结构：直接回答（1-2句）→命盘推导，术语括号标注（2-3句）→具体建议（1-2句）。
- 术语翻译：用"系统性能量冲突（土重克水）"而非直接堆砌术语。
- 语言：全部用中文。
- 控制在150-300字。`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { brain, question, context, lang } = req.body;
    const isEn = lang === 'en';
    if (!question) return res.status(400).json({ error: isEn ? 'Please enter a question' : '请输入问题' });

    const ctxStr = context || '';
    const Y = new Date().getFullYear();

    const ZHIPU_KEY = process.env.ZHIPU_API_KEY;
    const DS_KEY = process.env.DEEPSEEK_API_KEY;
    const CLAUDE_KEY = process.env.CLAUDE_API_KEY;

    const sysPrompt = brain === 'destiny'
      ? (isEn ? META_EN : META_ZH)
      : (isEn ? SCI_EN : SCI_ZH);

    // Add date constraint to system prompt
    const fullSystem = sysPrompt + `\n\nCRITICAL: Current year is ${Y}. NEVER mention any year before ${Y}.`;

    const userContent = `【${isEn ? 'Analysis Context' : '分析上下文'}】\n${ctxStr}\n\n【${isEn ? 'User Question' : '用户提问'}】\n${question}`;
    const messages = [
      { role: 'system', content: fullSystem },
      { role: 'user', content: userContent }
    ];

    // ── Try providers in order: Zhipu → DeepSeek → Claude ──
    let answer = '';

    // 1. Zhipu GLM-4-Plus (primary)
    if (ZHIPU_KEY && !answer) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 20000);
        const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_KEY}` },
          body: JSON.stringify({ model: 'glm-4-plus', max_tokens: 2000, temperature: 0.35, messages }),
        });
        clearTimeout(t);
        if (resp.ok) {
          const data = await resp.json();
          answer = (data.choices?.[0]?.message?.content || '').trim();
        }
      } catch (e) { console.log('[chat] Zhipu failed:', e.message); }
    }

    // 2. DeepSeek (fallback for meta brain)
    if (!answer && DS_KEY && brain === 'destiny') {
      try {
        const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DS_KEY}` },
          body: JSON.stringify({ model: 'deepseek-chat', max_tokens: 2000, temperature: 0.35, messages }),
        });
        if (resp.ok) {
          const data = await resp.json();
          answer = (data.choices?.[0]?.message?.content || '').trim();
        }
      } catch (e) { console.log('[chat] DeepSeek fallback failed:', e.message); }
    }

    // 3. Claude (fallback for science brain)
    if (!answer && CLAUDE_KEY && brain === 'science') {
      try {
        const resp = await fetch('https://api.gptsapi.net/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CLAUDE_KEY}`, 'x-api-key': CLAUDE_KEY },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, system: fullSystem, messages: [{ role: 'user', content: userContent }] }),
        });
        if (resp.ok) {
          const data = await resp.json();
          answer = (data.content || []).map(c => c.text || '').join('').trim();
        }
      } catch (e) { console.log('[chat] Claude fallback failed:', e.message); }
    }

    if (!answer) return res.status(502).json({ error: isEn ? 'All AI providers failed. Please retry.' : '所有AI服务暂时不可用，请稍后重试。' });
    return res.json({ answer });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
