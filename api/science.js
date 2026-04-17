export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

function parseJson(txt) {
  if (!txt) return null;
  let s = txt.trim().replace(/^```+\s*(?:json)?\s*\n?/gi, '').replace(/\n?\s*```+\s*$/g, '').trim();
  const i = s.indexOf('{'); if (i < 0) return null; s = s.substring(i);
  let d = 0, e = -1;
  for (let j = 0; j < s.length; j++) { if (s[j]==='{') d++; if (s[j]==='}') { d--; if (d===0) { e=j; break; } } }
  if (e > 0) s = s.substring(0, e + 1);
  else {
    let ob=0, oa=0;
    for (const c of s) { if (c==='{') ob++; if (c==='}') ob--; if (c==='[') oa++; if (c===']') oa--; }
    s = s.replace(/,\s*$/, '');
    while (oa>0) { s+=']'; oa--; } while (ob>0) { s+='}'; ob--; }
  }
  try { return JSON.parse(s); } catch {
    try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
  }
}

const SYSTEM_EN = `### Role: AnatomySelf Clinical Intelligence (Science Brain)
You are a clinical health analyst that interprets biomarker data with the precision of a diagnostician and the warmth of a caring physician.

### Core Framework:
1. **Biomarker Interpretation**: Analyze each marker in clinical context — not just "high/low" but what it means for the patient's organ systems.
2. **Systems Thinking**: Connect individual markers to systemic patterns — metabolic syndrome, cardiovascular cascade, hepato-renal axis, inflammation pathways.
3. **Risk Stratification**: Assess both short-term and long-term risk based on severity, trend direction, and co-morbidity clustering.
4. **Holistic Assessment**: Even NORMAL markers deserve commentary — borderline values, optimal vs. acceptable ranges, age-specific considerations.
5. **Preventive Intelligence**: Identify sub-clinical trends before they cross into pathological territory.

### Output Rules:
- LANGUAGE: Respond ENTIRELY in English. organ_system field uses Chinese characters (木/火/土/金/水).
- Evaluate ALL markers, not just abnormal ones. Normal markers get severity "info" with preventive commentary.
- clinical_fact: 1-2 sentences explaining what the value means clinically.
- recommendation: 1 concrete action (diet, exercise, or follow-up).
- Return ONLY valid JSON. No markdown.`;

const SYSTEM_ZH = `### 角色：AnatomySelf 临床健康智能（科学脑）
你是一位临床健康分析师，以诊断医师的精准和关怀医生的温度解读生物标志物数据。

### 核心框架：
1. **指标解读**：在临床语境中分析每项指标——不只是"偏高/偏低"，而是对患者脏腑系统的具体意义。
2. **系统思维**：将单项指标关联到系统性模式——代谢综合征、心血管级联、肝肾轴、炎症通路。
3. **风险分层**：根据严重度、趋势方向和共病聚集评估短期与长期风险。
4. **全面评估**：即使正常指标也值得评论——边界值、最优vs可接受范围、年龄特异性考量。
5. **预防智能**：在亚临床趋势跨入病理领域之前识别它们。

### 输出规则：
- 语言：全部用中文回答。organ_system字段用中文字符（木/火/土/金/水）。
- 评估所有指标，不只是异常的。正常指标给severity"info"并附预防性评论。
- clinical_fact：1-2句话解释该值在临床上的含义。
- recommendation：1个具体行动（饮食、运动或随访）。
- 只返回有效JSON。不要markdown。`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { age, sex, anomalies, allMetrics, lang } = req.body;
    const isEn = lang === 'en';

    const ZHIPU_KEY = process.env.ZHIPU_API_KEY;
    const CLAUDE_KEY = process.env.CLAUDE_API_KEY;
    if (!ZHIPU_KEY && !CLAUDE_KEY) return res.status(500).json({ error: 'No AI API key configured' });

    const sexLabel = isEn ? (sex==='M'?'male':'female') : (sex==='M'?'男':'女');

    // Build marker description — include ALL markers, flag anomalies
    const markers = allMetrics && allMetrics.length > 0 ? allMetrics : anomalies;
    if (!markers || markers.length === 0) {
      return res.json({ items: [], summary: isEn ? 'No biomarkers entered.' : '暂无录入指标。' });
    }

    const desc = markers.map(a =>
      `${a.cn||a.key}(${a.key}/${a.organ||'?'}): ${a.value} ${a.unit}, ref ${a.low}-${a.high}, ${a.status}`
    ).join('\n');

    const hasAnomalies = markers.some(m => m.status !== '正常' && m.status !== 'normal');

    const userPrompt = isEn
      ? `Patient: ${age}y/o ${sexLabel}. Biomarkers:\n${desc}\n\nAnalyze ALL markers (normal AND abnormal). Return JSON:\n{"sentinel":"1 sentence: the single most important health finding or reassurance","items":[{"metric":"code","metric_cn":"Chinese name","organ_system":"木 or 火 or 土 or 金 or 水","severity":"info/mild/moderate/severe/critical","clinical_fact":"1-2 sentences: what this value means clinically for this patient","recommendation":"1 concrete preventive or corrective action"}],"summary":"2-3 sentence synthesis of overall health status"}`
      : `患者：${age}岁${sexLabel}。生物标志物：\n${desc}\n\n分析所有指标（正常和异常均需评估）。返回JSON：\n{"sentinel":"一句话：最重要的健康发现或健康确认","items":[{"metric":"代码","metric_cn":"中文名","organ_system":"木 或 火 或 土 或 金 或 水","severity":"info/mild/moderate/severe/critical","clinical_fact":"1-2句话：该值对此患者的临床含义","recommendation":"1个具体的预防或纠正行动"}],"summary":"2-3句综合评估整体健康状态"}`;

    const messages = [
      { role: 'system', content: isEn ? SYSTEM_EN : SYSTEM_ZH },
      { role: 'user', content: userPrompt }
    ];

    // Primary: Zhipu
    let txt = '';
    if (ZHIPU_KEY) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 25000);
        const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_KEY}` },
          body: JSON.stringify({ model: 'glm-4-plus', max_tokens: 4000, temperature: 0.15, messages }),
        });
        clearTimeout(t);
        if (resp.ok) {
          const data = await resp.json();
          txt = data.choices?.[0]?.message?.content || '';
        }
      } catch (e) { console.log('[science] Zhipu error:', e.message); }
    }

    // Fallback: Claude
    if (!txt && CLAUDE_KEY) {
      try {
        const resp = await fetch('https://api.gptsapi.net/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CLAUDE_KEY}`, 'x-api-key': CLAUDE_KEY },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6', max_tokens: 4000, system: isEn ? SYSTEM_EN : SYSTEM_ZH,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          txt = (data.content || []).map(c => c.text || '').join('');
        }
      } catch (e) { console.log('[science] Claude error:', e.message); }
    }

    if (!txt) return res.status(500).json({ error: 'All AI APIs failed' });

    const parsed = parseJson(txt);
    console.log('[science] parsed items:', parsed?.items?.length, 'sentinel:', parsed?.sentinel?.substring(0, 50));
    res.json(parsed || { items: [], summary: txt.substring(0, 500) });
  } catch (e) {
    console.error('[science] error:', e.message);
    res.status(500).json({ error: 'Science error: ' + e.message });
  }
}
