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

// ═══ System Prompts ═══
const SYSTEM_EN = `### Role: AnatomySelf Digital Alchemist (Meta Brain)
You are a "Digital Alchemist" mastering traditional Zi-Ping BaZi (子平八字) and modern functional medicine. You perform "energy audits" by cross-referencing spacetime coordinates (BaZi) with physiological data.

### Knowledge Framework:
1. Parse Four Pillars — Heavenly Stems and Earthly Branches
2. Analyze Stem interactions (生克) and Branch reactions (刑冲破害合会)  
3. Assess Day Master strength via 旺相休囚死 and 十二长生
4. Identify pattern (格局), climate needs (调候), bridging elements (通关)
5. Use Shen-Sha stars (羊刃/血支/白虎 etc.) as physiological risk signals

### Collision Logic:
Map Five Elements → Organs: Wood(肝胆), Fire(心血管), Earth(脾胃), Metal(呼吸), Water(肾内分泌)
When biomarker anomalies exist, find the corresponding energetic conflict.

### CRITICAL OUTPUT RULES:
- LANGUAGE: English only. Chinese only for organ_wuxing (木火土金水) and BaZi terms in parentheses.
- Each current_forces MUST be 50-100 words (3 sentences minimum). Explain the elemental dynamics, how they affect the organ, and what symptoms to expect.
- Each prevention MUST be a specific daily action with duration/frequency.
- temporal_outlook MUST be 60-100 words.
- NEVER write short answers like "Wood at 30" — this will be rejected.
- Return ONLY valid JSON.`;

const SYSTEM_ZH = `### 角色：AnatomySelf 数字炼金术师（命理脑）
你是一位精通子平八字与现代功能医学的"数字炼金术师"。通过将"时空坐标（八字）"与"生理坐标（体检数据）"进行对撞，执行"能量审计"。

### 知识框架：
1. 解析四柱天干地支
2. 分析天干生克与地支刑冲破害合会
3. 通过旺相休囚死与十二长生判断日主强弱
4. 识别格局、调候需求、通关五行
5. 引入神煞（羊刃/血支/白虎等）作为生理风险信号

### 对撞逻辑：
五行→脏腑映射：木(肝胆)、火(心血管)、土(脾胃)、金(呼吸)、水(肾内分泌)
当存在指标异常时，必须搜索命局中对应的能量冲突。

### 关键输出规则：
- 语言：全部中文。
- 每个current_forces必须50-100字（至少3句话）。分析元素动态、对脏腑的影响、预期症状。
- 每个prevention必须是具体日常行动（含时长/频率）。
- temporal_outlook必须60-100字。
- 绝对禁止写"木占30"这样的短答案——这会被系统拒绝。
- 只返回有效JSON。`;

async function callAI(messages, zhipuKey, dsKey) {
  // Primary: Zhipu GLM-4-Plus
  if (zhipuKey) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 30000);
      const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${zhipuKey}` },
        body: JSON.stringify({ model: 'glm-4-plus', max_tokens: 4000, temperature: 0.3, messages }),
      });
      clearTimeout(t);
      if (resp.ok) {
        const data = await resp.json();
        return data.choices?.[0]?.message?.content || '';
      }
      console.log('[destiny] Zhipu failed:', resp.status);
    } catch (e) { console.log('[destiny] Zhipu error:', e.message); }
  }
  // Fallback: DeepSeek
  if (dsKey) {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dsKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', max_tokens: 4000, temperature: 0.3, messages }),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.choices?.[0]?.message?.content || '';
    }
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { chartData, baziStr, lang } = req.body;
    const isEn = lang === 'en';

    const ZHIPU_KEY = process.env.ZHIPU_API_KEY;
    const DS_KEY = process.env.DEEPSEEK_API_KEY;
    if (!ZHIPU_KEY && !DS_KEY) return res.status(500).json({ error: 'No AI API key configured' });

    const Y = new Date().getFullYear();
    const M = new Date().getMonth() + 1;
    const astro = chartData?.astronomicalNote || '';
    const health = chartData?.healthFindings || '';

    const userMsg = isEn
? `CHART (do not recalculate): ${JSON.stringify(chartData)}
BaZi: ${baziStr} | NOW: ${Y}/${M}
${astro ? 'Note: ' + astro : ''}${health ? '\nHealth: ' + health : ''}

Return this JSON structure. REMEMBER: each current_forces = 3 sentences (50-100 words), NOT just a number:
{"bazi_analysis":{"pillars":"describe all 4 pillars","pattern":"day master strength analysis","health_map":"organ strengths and weaknesses"},"collision_items":[{"organ_wuxing":"木","current_forces":"[3 sentences: Wood % + why from pillars + organ impact + symptoms]","risk_window":"${Y}/M-M","prevention":"specific action with frequency"},{"organ_wuxing":"火","current_forces":"[3 sentences]","risk_window":"","prevention":"specific action"},{"organ_wuxing":"土","current_forces":"[3 sentences]","risk_window":"","prevention":"specific action"},{"organ_wuxing":"金","current_forces":"[3 sentences]","risk_window":"","prevention":"specific action"},{"organ_wuxing":"水","current_forces":"[3 sentences]","risk_window":"","prevention":"specific action"}],"temporal_outlook":"[4 sentences covering next 12 months]","key_dates":["${Y}/M: reason","${Y}/M: reason","${Y}/M: reason"]}`
: `排盘数据（严禁重算）：${JSON.stringify(chartData)}
八字：${baziStr} | 当前：${Y}年${M}月
${astro ? '备注：' + astro : ''}${health ? '\n健康：' + health : ''}

返回以下JSON。切记：每个current_forces必须3句话（50-100字），不能只写数字：
{"bazi_analysis":{"pillars":"四柱描述","pattern":"日主强弱分析","health_map":"脏腑强弱"},"collision_items":[{"organ_wuxing":"木","current_forces":"[3句话：木气比例+四柱原因+脏腑影响+症状预期]","risk_window":"${Y}年X-X月","prevention":"含频率的具体行动"},{"organ_wuxing":"火","current_forces":"[3句话]","risk_window":"","prevention":"具体行动"},{"organ_wuxing":"土","current_forces":"[3句话]","risk_window":"","prevention":"具体行动"},{"organ_wuxing":"金","current_forces":"[3句话]","risk_window":"","prevention":"具体行动"},{"organ_wuxing":"水","current_forces":"[3句话]","risk_window":"","prevention":"具体行动"}],"temporal_outlook":"[4句话覆盖未来12个月]","key_dates":["${Y}年X月：原因","${Y}年X月：原因","${Y}年X月：原因"]}`;

    const messages = [
      { role: 'system', content: isEn ? SYSTEM_EN : SYSTEM_ZH },
      { role: 'user', content: userMsg }
    ];

    let txt = await callAI(messages, ZHIPU_KEY, DS_KEY);
    if (!txt) return res.status(500).json({ error: 'All AI APIs failed' });

    let parsed = parseJson(txt);

    // ═══ Quality Gate: reject too-short responses and retry once ═══
    if (parsed?.collision_items) {
      const tooShort = parsed.collision_items.some(it => (it.current_forces || '').length < 30);
      if (tooShort) {
        console.log('[destiny] Quality gate: current_forces too short, retrying with emphasis...');
        const retryMsg = isEn
          ? 'Your previous response had current_forces that were too short (under 30 characters). This is NOT acceptable. Each current_forces MUST be 3 full sentences analyzing: (1) the elemental percentage and WHY from the pillars, (2) HOW it affects the corresponding organ system, (3) WHAT symptoms or tendencies to expect. Please regenerate the complete JSON with proper-length analysis for ALL five elements.'
          : '你上一次的回答中current_forces太短（不到30个字）。这是不可接受的。每个current_forces必须是3句完整分析：(1)该行的百分比及四柱原因，(2)如何影响对应脏腑，(3)预期的症状或倾向。请重新生成完整JSON，所有五行都要有足够长度的分析。';
        messages.push({ role: 'assistant', content: txt });
        messages.push({ role: 'user', content: retryMsg });
        const txt2 = await callAI(messages, ZHIPU_KEY, DS_KEY);
        if (txt2) {
          const parsed2 = parseJson(txt2);
          if (parsed2?.collision_items) parsed = parsed2;
        }
      }
    }

    console.log('[destiny] final items:', parsed?.collision_items?.length, 'forces lengths:', parsed?.collision_items?.map(i => (i.current_forces||'').length));
    res.json(parsed || { collision_items: [], temporal_outlook: txt.substring(0, 800) });
  } catch (e) {
    console.error('[destiny] error:', e.message);
    res.status(500).json({ error: 'Destiny error: ' + e.message });
  }
}
