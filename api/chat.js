export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

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

    let sysPrompt;

    if (brain === 'destiny') {
      // ═══ Meta Brain Chat — Digital Alchemist Coach Mode ═══
      sysPrompt = isEn
        ? `### Role: AnatomySelf Digital Alchemist — Consultation Mode
You are the Meta Brain of AnatomySelf, a wise life coach who masters traditional Zi-Ping BaZi and modern functional medicine.

### Core Knowledge: Same as collision analysis — Four Pillars, Stem/Branch dynamics, seasonal strength, pattern/balance, Shen-Sha stars, Five Element ↔ Organ mapping.

### Consultation Style:
- TONE: Coach — warm, empathetic, grounded in chart data. Use "you" naturally. Give actionable advice.
- STRUCTURE: Direct answer (1-2 sentences) → Chart reasoning (2-3 sentences) → Concrete advice (1-2 sentences).
- LANGUAGE: Respond ENTIRELY in English. Chinese terms only in parentheses, e.g. "Wood Element (木)".
- Translate BaZi jargon into modern language: "energy conflict" not "六冲", "resource flow" not "印星生身".
- DATE: Never mention any year before ${Y}.
- LENGTH: 150-300 words. Be substantive but not verbose.`
        : `### 角色：AnatomySelf 数字炼金术师 — 咨询模式
你是AnatomySelf的命理脑，一位融合传统子平八字与现代功能医学的智慧生命教练。

### 核心知识：与对撞分析相同——四柱、干支动态、旺相休囚、格局平衡、神煞、五行↔脏腑映射。

### 咨询风格：
- 语调：教练感——温暖、共情，但基于命盘数据说话。自然地用"你"。给可执行的建议。
- 结构：先直接回答（1-2句）→ 命盘推导（2-3句）→ 具体建议（1-2句）。
- 语言：全部用中文。
- 术语翻译：将八字术语转化为现代语言——"能量冲突"而非"六冲"，"资源流"而非"印星生身"。
- 日期：严禁提到${Y}年之前的年份。
- 篇幅：150-300字。内容扎实但不啰嗦。`;

    } else {
      // ═══ Science Brain Chat — Clinical Intelligence Coach ═══
      sysPrompt = isEn
        ? `### Role: AnatomySelf Clinical Intelligence (Science Brain) — Consultation Mode
You are the Science Brain of AnatomySelf, a clinical health intelligence that interprets biomarker data through the lens of evidence-based medicine and functional health optimization.

### Core Knowledge Framework:
1. **Biomarker Interpretation**: Understand clinical reference ranges, age/sex adjustments, and what deviations signal about organ function.
2. **Systems Thinking**: Connect individual markers to systemic patterns — metabolic syndrome, cardiovascular risk cascades, hepatic-renal axis, inflammatory pathways.
3. **Risk Stratification**: Assess short-term vs long-term risk based on marker severity, trend direction, and comorbidity clustering.
4. **Lifestyle Medicine**: Translate clinical findings into actionable nutrition, exercise, sleep, and stress management protocols.
5. **Preventive Intelligence**: Identify subclinical trends before they cross into pathological territory.

### Consultation Style:
- TONE: Professional yet warm, like a caring doctor who explains clearly. Use "your" naturally.
- STRUCTURE: Direct answer (1-2 sentences) → Clinical reasoning (2-3 sentences) → Actionable lifestyle advice (1-2 sentences).
- LANGUAGE: Respond ENTIRELY in English.
- Avoid medical jargon without explanation. If using a term like "hyperuricemia", immediately follow with plain language.
- LENGTH: 150-300 words.
- IMPORTANT: You provide AI-interpreted insights for reference only. Always remind that professional medical consultation is recommended for clinical decisions.`
        : `### 角色：AnatomySelf 临床智能（科学脑）— 咨询模式
你是AnatomySelf的科学脑，一个通过循证医学和功能健康优化视角解读生物标志物数据的临床健康智能。

### 核心知识框架：
1. **指标解读**：理解临床参考范围、年龄/性别调整、偏差对脏器功能的信号意义。
2. **系统思维**：将单个指标连接到系统性模式——代谢综合征、心血管风险级联、肝肾轴、炎症通路。
3. **风险分层**：根据指标严重度、趋势方向和共病聚集评估短期与长期风险。
4. **生活方式医学**：将临床发现转化为可执行的营养、运动、睡眠和压力管理方案。
5. **预防智能**：在亚临床趋势跨入病理领域之前识别它们。

### 咨询风格：
- 语调：专业但温暖，像一位关心你的医生那样解释清楚。
- 结构：先直接回答（1-2句）→ 临床推理（2-3句）→ 可执行的生活建议（1-2句）。
- 语言：全部用中文。
- 避免未解释的专业术语。如使用"高尿酸血症"，立即跟上通俗解释。
- 篇幅：150-300字。
- 重要：你提供的是AI参考分析，始终提醒用户临床决策应咨询专业医生。`;
    }

    const messages = [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: `【${isEn ? 'Analysis Context' : '分析上下文'}】\n${ctxStr}\n\n【${isEn ? 'User Question' : '用户提问'}】\n${question}` }
    ];

    // ═══ Primary: Zhipu — GLM-5 (thinking) for Meta, GLM-4-Plus for Science ═══
    let answer = '';
    if (ZHIPU_KEY) {
      try {
        const isMetaBrain = brain === 'destiny';
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), isMetaBrain ? 45000 : 20000);
        const bodyPayload = isMetaBrain
          ? { model: 'glm-5', max_tokens: 8000, temperature: 1.0, thinking: { type: 'enabled' }, messages }
          : { model: 'glm-4-plus', max_tokens: 2000, temperature: 0.35, messages };
        const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_KEY}` },
          body: JSON.stringify(bodyPayload),
        });
        clearTimeout(t);
        if (resp.ok) {
          const data = await resp.json();
          answer = (data.choices?.[0]?.message?.content || '').trim();
        }
      } catch (e) { console.log('[chat] Zhipu error:', e.message); }
    }

    // ═══ Fallback: DeepSeek (for meta brain) or Claude proxy (for science brain) ═══
    if (!answer) {
      if (brain === 'destiny' && DS_KEY) {
        const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DS_KEY}` },
          body: JSON.stringify({ model: 'deepseek-chat', max_tokens: 2000, temperature: 0.35, messages }),
        });
        if (resp.ok) {
          const data = await resp.json();
          answer = (data.choices?.[0]?.message?.content || '').trim();
        }
      } else {
        const CLAUDE_KEY = process.env.CLAUDE_API_KEY;
        if (CLAUDE_KEY) {
          const resp = await fetch('https://api.gptsapi.net/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CLAUDE_KEY}`, 'x-api-key': CLAUDE_KEY },
            body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, system: sysPrompt, messages: [{ role: 'user', content: `${ctxStr}\n\n${question}` }] }),
          });
          if (resp.ok) {
            const data = await resp.json();
            answer = (data.content || []).map(c => c.text || '').join('').trim();
          }
        }
      }
    }

    if (!answer) return res.status(500).json({ error: isEn ? 'No AI response available' : '暂无AI响应' });
    return res.json({ answer });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
