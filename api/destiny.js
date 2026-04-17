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

const SYSTEM_EN = `### Role: AnatomySelf Digital Alchemist (Meta Brain)
You are a "Digital Alchemist" mastering traditional Zi-Ping BaZi and modern functional medicine. Perform an "energy audit" by cross-referencing spacetime coordinates (BaZi) with physiological data.

### Knowledge Framework:
1. Parse Four Pillars — Heavenly Stems and Earthly Branches, their elements and interactions
2. Analyze Stem interactions (生克) and Branch reactions (刑冲破害合会)
3. Assess Day Master strength via 旺相休囚死 and 十二长生
4. Identify pattern (格局), climate needs (调候), bridging elements (通关)
5. Use Shen-Sha stars (羊刃/血支/白虎 etc.) as physiological risk signals

### Collision Logic:
Map Five Elements → Organs: Wood(肝胆), Fire(心血管), Earth(脾胃), Metal(呼吸), Water(肾内分泌)
When biomarker anomalies exist, find corresponding energetic conflicts.

### Output Rules:
- LANGUAGE: English only. Chinese only for organ_wuxing (木火土金水) and BaZi terms in parentheses.
- Each current_forces: 3-5 sentences analyzing elemental dynamics → organ impact → symptoms.
- Each prevention: specific daily action with duration/frequency.
- temporal_outlook: 4-5 sentences covering next 12 months.
- Tone: Mystical, precise, data-backed oracle. No empty platitudes.
- Return ONLY valid JSON. No markdown wrapping.`;

const SYSTEM_ZH = `### 角色：AnatomySelf 数字炼金术师（命理脑）
你是一位精通子平八字与现代功能医学的"数字炼金术师"。通过将"时空坐标（八字）"与"生理坐标（体检数据）"对撞，执行"能量审计"。

### 知识框架：
1. 解析四柱天干地支及其五行属性与相互作用
2. 分析天干生克与地支刑冲破害合会
3. 通过旺相休囚死与十二长生判断日主强弱
4. 识别格局、调候需求、通关五行
5. 引入神煞（羊刃/血支/白虎等）作为生理风险信号

### 对撞逻辑：
五行→脏腑映射：木(肝胆)、火(心血管)、土(脾胃)、金(呼吸)、水(肾内分泌)
当存在指标异常时，搜索命局中对应的能量冲突。

### 输出规则：
- 语言：全部中文。
- 每个current_forces：3-5句话，分析元素动态→脏腑影响→症状表现。
- 每个prevention：具体日常行动（含时长/频率）。
- temporal_outlook：4-5句话覆盖未来12个月。
- 语调：神秘、精准、数据驱动的神谕。严禁空洞吉祥话。
- 只返回有效JSON。不要用markdown包裹。`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { chartData, baziStr, lang } = req.body;
    const isEn = lang === 'en';

    const KEY = process.env.ZHIPU_API_KEY;
    if (!KEY) return res.status(500).json({ error: 'ZHIPU_API_KEY not configured' });

    const Y = new Date().getFullYear();
    const M = new Date().getMonth() + 1;
    const astro = chartData?.astronomicalNote || '';
    const health = chartData?.healthFindings || '';

    const userMsg = isEn
? `CHART (do not recalculate): ${JSON.stringify(chartData)}
BaZi: ${baziStr} | NOW: ${Y}/${M}
${astro ? 'Note: '+astro : ''}${health ? '\nHealth: '+health : ''}

Think deeply about the elemental dynamics, then return this JSON:
{"bazi_analysis":{"pillars":"describe all 4 pillars and elements","pattern":"day master strength + useful/harmful gods","health_map":"organ strengths/weaknesses"},"collision_items":[{"organ_wuxing":"木","current_forces":"3-5 sentences on Wood/Liver","risk_window":"${Y}/M-M","prevention":"specific action"},{"organ_wuxing":"火","current_forces":"3-5 sentences on Fire/Heart","risk_window":"","prevention":"action"},{"organ_wuxing":"土","current_forces":"3-5 sentences on Earth/Spleen","risk_window":"","prevention":"action"},{"organ_wuxing":"金","current_forces":"3-5 sentences on Metal/Lung","risk_window":"","prevention":"action"},{"organ_wuxing":"水","current_forces":"3-5 sentences on Water/Kidney","risk_window":"","prevention":"action"}],"temporal_outlook":"4-5 sentences on next 12 months","key_dates":["${Y}/M: reason","${Y}/M: reason","${Y}/M: reason"]}`
: `排盘数据（严禁重算）：${JSON.stringify(chartData)}
八字：${baziStr} | 当前：${Y}年${M}月
${astro ? '备注：'+astro : ''}${health ? '\n健康：'+health : ''}

请深度思考五行动态关系，然后返回以下JSON：
{"bazi_analysis":{"pillars":"四柱及五行描述","pattern":"日主强弱+用神忌神","health_map":"脏腑强弱"},"collision_items":[{"organ_wuxing":"木","current_forces":"3-5句分析木/肝胆","risk_window":"${Y}年X-X月","prevention":"具体行动"},{"organ_wuxing":"火","current_forces":"3-5句分析火/心血管","risk_window":"","prevention":"行动"},{"organ_wuxing":"土","current_forces":"3-5句分析土/脾胃","risk_window":"","prevention":"行动"},{"organ_wuxing":"金","current_forces":"3-5句分析金/呼吸","risk_window":"","prevention":"行动"},{"organ_wuxing":"水","current_forces":"3-5句分析水/肾脏","risk_window":"","prevention":"行动"}],"temporal_outlook":"4-5句话覆盖未来12个月","key_dates":["${Y}年X月：原因","${Y}年X月：原因","${Y}年X月：原因"]}`;

    // ═══ GLM-5 with Deep Thinking enabled ═══
    console.log('[destiny] Calling GLM-5 with thinking enabled...');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60000); // 60s for deep thinking
    
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
      body: JSON.stringify({
        model: 'glm-5',
        max_tokens: 16000,
        temperature: 1.0, // Required for thinking mode
        thinking: { type: 'enabled' },
        messages: [
          { role: 'system', content: isEn ? SYSTEM_EN : SYSTEM_ZH },
          { role: 'user', content: userMsg }
        ],
      }),
    });
    clearTimeout(t);

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[destiny] GLM-5 error:', resp.status, err.substring(0, 300));
      return res.status(500).json({ error: `GLM-5 error (${resp.status}): ${err.substring(0, 200)}` });
    }

    const data = await resp.json();
    const choice = data.choices?.[0]?.message || {};
    const thinking = choice.reasoning_content || '';
    const content = choice.content || '';
    
    console.log('[destiny] thinking length:', thinking.length, 'content length:', content.length);

    const parsed = parseJson(content);
    if (parsed) {
      // Attach thinking process for frontend display if desired
      parsed._thinking = thinking.substring(0, 2000);
      console.log('[destiny] Success! Items:', parsed.collision_items?.length);
    } else {
      console.log('[destiny] JSON parse failed. Content first 300:', content.substring(0, 300));
      // Try parsing from thinking if content failed
      const fromThinking = parseJson(thinking);
      if (fromThinking) {
        fromThinking._thinking = thinking.substring(0, 2000);
        return res.json(fromThinking);
      }
      return res.json({ collision_items: [], temporal_outlook: content.substring(0, 1000) || thinking.substring(0, 1000), _thinking: thinking.substring(0, 2000) });
    }

    res.json(parsed);
  } catch (e) {
    console.error('[destiny] error:', e.message);
    res.status(500).json({ error: 'Destiny error: ' + e.message });
  }
}
