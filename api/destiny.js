export const config = { api: { bodyParser: false } };

function parseJson(txt) {
  if (!txt) return null;
  let s = txt.trim();
  // Strip markdown code blocks
  s = s.replace(/^```+\s*(?:json)?\s*\n?/gi, '').replace(/\n?\s*```+\s*$/g, '').trim();
  // Find first { 
  const i = s.indexOf('{'); if (i < 0) return null; s = s.substring(i);
  // Find matching }
  let d = 0, e = -1;
  for (let j = 0; j < s.length; j++) {
    if (s[j] === '{') d++; if (s[j] === '}') { d--; if (d === 0) { e = j; break; } }
  }
  if (e > 0) s = s.substring(0, e + 1);
  else {
    // Truncated — auto-close
    let ob = 0, oa = 0;
    for (const c of s) { if (c==='{') ob++; if (c==='}') ob--; if (c==='[') oa++; if (c===']') oa--; }
    s = s.replace(/,\s*$/, '');
    while (oa > 0) { s += ']'; oa--; }
    while (ob > 0) { s += '}'; ob--; }
  }
  try { return JSON.parse(s); } catch {
    try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
  }
}

async function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
  });
}

const SYSTEM_EN = `You are "Precision BaZi" — a cold, precise oracle that translates mathematical destiny charts into life guidance.

RULES:
1. NEVER recalculate. Trust the input JSON absolutely.
2. Respond ENTIRELY in English. Use Chinese only for organ_wuxing (木火土金水) and BaZi terms in parentheses.
3. NEVER mention years before the current year shown in the data.
4. Oracle tone: each insight should feel like a revelation carved in stone. No filler words.
5. Each collision_items.current_forces MUST be 2-3 full sentences analyzing elemental dynamics. NEVER just state a number like "Wood is at 30" — always explain WHY and WHAT IT MEANS.
6. Return ONLY valid JSON. No markdown, no code blocks, no text before or after the JSON.

EXAMPLE of a GOOD current_forces (follow this style):
"Wood dominates at 46.8%, fueled by the Day Master's deep root in Mao. The current Fire luck pillar channels Wood's excess into Heart strain, elevating systolic pressure. Liver Qi stagnation manifests as tension headaches and irritability."

EXAMPLE of a BAD current_forces (NEVER do this):
"Wood is at 30." ← TOO SHORT. This is unacceptable.`;

const SYSTEM_ZH = `你是"精密玄学"——冷峻精准的生命神谕，将数学化的命盘翻译为生命指引。

【规则】
1. 严禁重新计算。绝对信任输入数据。
2. 全部用中文回答。
3. 严禁提到输入数据中当前年份之前的年份。
4. 神谕语调：每句洞察如刻石铭文。不要废话。
5. 每个collision_items.current_forces必须是2-3句完整分析。绝对禁止只写"木占30"这样的数字——必须解释原因和影响。
6. 只返回有效JSON。不要markdown，不要代码块，JSON前后不要有任何文字。

【正确示例】current_forces应该这样写：
"木气以46.8%占据绝对主导，日主乙木深根于卯。当前丁卯火运引木气入心，推高收缩压。肝气郁结外显为偏头痛与急躁。"

【错误示例】绝对不要这样写：
"木占30。" ← 太短，不可接受。必须分析原因和身体影响。`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const body = await readBody(req);
    const { chartData, baziStr, lang } = body;
    const isEn = lang === 'en';

    const KEY = process.env.DEEPSEEK_API_KEY;
    if (!KEY) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

    const Y = new Date().getFullYear();
    const M = new Date().getMonth() + 1;
    const astro = chartData?.astronomicalNote || '';
    const health = chartData?.healthFindings || '';

    const userMsg = isEn
? `CHART DATA (exact, do not recalculate):
${JSON.stringify(chartData, null, 2)}

BaZi: ${baziStr} | NOW: ${Y}/${M}
${astro ? 'Solar note: ' + astro : ''}
${health ? 'Health findings: ' + health : ''}

Reply with ONLY this JSON structure (current_forces MUST be 2-3 full sentences like the example below, NEVER just a number):
{"bazi_analysis":{"pillars":"describe 4 pillars and their elements","pattern":"day master strength + useful/harmful gods","health_map":"which organs strong/weak based on elements"},"collision_items":[{"organ_wuxing":"木","current_forces":"Wood dominates at X%, fueled by [pillar relationship]. The [luck/annual pillar] channels this energy into [organ effect]. This manifests as [specific symptom or tendency].","risk_window":"${Y}/M-M","prevention":"1 concrete daily action with specific duration/frequency"},{"organ_wuxing":"火","current_forces":"Fire is [strong/weak] at X% because [reason from pillars]. [Effect on Heart/circulation]. [How it interacts with other elements this year].","risk_window":"","prevention":"1 action"},{"organ_wuxing":"土","current_forces":"[2-3 full sentences analyzing Earth/Spleen dynamics]","risk_window":"","prevention":"1 action"},{"organ_wuxing":"金","current_forces":"[2-3 full sentences analyzing Metal/Lung dynamics]","risk_window":"","prevention":"1 action"},{"organ_wuxing":"水","current_forces":"[2-3 full sentences analyzing Water/Kidney dynamics]","risk_window":"","prevention":"1 action"}],"temporal_outlook":"3-4 sentences on the next 12 months from ${Y}/${M}","key_dates":["${Y}/month: brief reason","${Y}/month: brief reason","${Y}/month: brief reason"]}`

: `【排盘数据（精确值，严禁重算）】
${JSON.stringify(chartData, null, 2)}

八字：${baziStr} | 当前：${Y}年${M}月
${astro ? '天文备注：' + astro : ''}
${health ? '健康发现：' + health : ''}

只返回以下JSON结构（current_forces必须是2-3句完整分析，绝不能只写一个数字）：
{"bazi_analysis":{"pillars":"四柱及其元素描述","pattern":"日主强弱+用神忌神","health_map":"哪些脏腑强/弱"},"collision_items":[{"organ_wuxing":"木","current_forces":"木气以X%占据主导，因日主[关系]深根于[支]。当前[大运/流年]引木气入[脏腑]，造成[具体影响]。肝气郁结外显为[症状倾向]。","risk_window":"${Y}年X-X月","prevention":"1个具体日常行动（含时长/频率）"},{"organ_wuxing":"火","current_forces":"火行以X%处于[强/弱]态，因[柱中关系]。[对心脏/循环的影响]。[与其他元素的互动]。","risk_window":"","prevention":"1个行动"},{"organ_wuxing":"土","current_forces":"[2-3句完整分析土/脾胃动态]","risk_window":"","prevention":"1个行动"},{"organ_wuxing":"金","current_forces":"[2-3句完整分析金/呼吸动态]","risk_window":"","prevention":"1个行动"},{"organ_wuxing":"水","current_forces":"[2-3句完整分析水/肾脏动态]","risk_window":"","prevention":"1个行动"}],"temporal_outlook":"3-4句话展望从${Y}年${M}月起的12个月","key_dates":["${Y}年X月：简要原因","${Y}年X月：简要原因","${Y}年X月：简要原因"]}`;

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 4000,
        temperature: 0.2,
        messages: [
          { role: 'system', content: isEn ? SYSTEM_EN : SYSTEM_ZH },
          { role: 'user', content: userMsg }
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: `DeepSeek error (${resp.status}): ${err.substring(0, 200)}` });
    }

    const rawText = await resp.text();
    if (rawText.startsWith('<')) return res.status(502).json({ error: 'Meta API invalid response.' });

    let data;
    try { data = JSON.parse(rawText); } catch { return res.status(502).json({ error: 'Meta API parse error.' }); }

    const txt = data.choices?.[0]?.message?.content || '';
    console.log('[destiny] raw length:', txt.length);
    const parsed = parseJson(txt);
    if (!parsed) console.log('[destiny] PARSE FAILED. First 300:', txt.substring(0, 300));
    res.json(parsed || { collision_items: [], temporal_outlook: txt.substring(0, 800) });
  } catch (e) {
    console.error('[destiny] error:', e.message);
    res.status(500).json({ error: 'Destiny error: ' + e.message });
  }
}
