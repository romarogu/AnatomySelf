export const config = { api: { bodyParser: false } };

function parseJson(txt) {
  if (!txt) return null;
  let s = txt.trim().replace(/^```+\s*(?:json)?\s*\n?/i, '').replace(/\n?\s*```+\s*$/g, '').trim();
  const i = s.indexOf('{'); if (i < 0) return null; s = s.substring(i);
  let d = 0, e = -1;
  for (let j = 0; j < s.length; j++) { if (s[j] === '{') d++; if (s[j] === '}') { d--; if (d === 0) { e = j; break; } } }
  if (e > 0) s = s.substring(0, e + 1);
  try { return JSON.parse(s); } catch { try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch { return null; } }
}

async function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
  });
}

const SYSTEM_EN = `You are the interpretive voice of a deterministic Chinese Metaphysics engine named "Precision BaZi".
You are NOT an oracle or fortune teller. You are a technical translator converting a strict mathematical chart into accessible, Stoic-inspired life guidance.

IRON RULES:
1. NO CALCULATION: FORBIDDEN from recalculating. Trust the provided JSON absolutely.
2. CURRENT DATE: The current year and month are provided in the user message. NEVER reference years before the current year in your analysis. All temporal predictions must be about the current year and future.
3. TONE: Mystical yet actionable. Like a cold, precise oracle — not a chatty astrologer. Each insight should feel like a revelation, not a lecture.
4. BREVITY: collision_items current_forces ≤30 words. prevention ≤20 words. temporal_outlook ≤60 words. Think haiku, not essay.
5. ACTIONABLE: Every prevention must be a concrete daily action (food, exercise, sleep habit) — not vague advice like "pay attention to health".
6. ANALOGICAL MAPPING: Wood="Nervous system/Liver", Fire="Cardiovascular/Spirit", Earth="Digestive/Stability", Metal="Respiratory/Boundaries", Water="Endocrine/Depth".

Return pure JSON only.`;

const SYSTEM_ZH = `你是"精密玄学"算法的解释层AI。你不是算命先生，而是冷峻的生命审计官。

【铁律】
1. 禁止计算：严禁重新计算。信任输入数据。
2. 当前日期：用户消息中提供了当前年月。严禁提到当前年份之前的年份。所有时间预测必须是当前年份及以后。
3. 语调：神秘但可执行。像冷峻的神谕——不是啰嗦的算命先生。每句洞察应该像启示，不像讲座。
4. 精简：collision_items的current_forces≤30字。prevention≤20字。temporal_outlook≤60字。惜字如金。
5. 可执行：每条prevention必须是具体的日常行动（饮食/运动/作息）——不要"注意健康"这种空话。
6. 生理映射：木-神经/肝，火-心血管/精神，土-消化/稳定，金-呼吸/界限，水-内分泌/深度。

返回纯JSON。`;

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

    const astroNote = chartData?.astronomicalNote || '';

    const userMsg = isEn ? `DETERMINISTIC CHART DATA (server-computed, DO NOT recalculate):
${JSON.stringify(chartData, null, 2)}

BaZi: ${baziStr}
⚠ CURRENT DATE: ${Y}/${M} — ALL predictions must reference ${Y} or later. NEVER mention ${Y-1} or earlier years.
${astroNote ? 'ASTRONOMICAL NOTE: ' + astroNote : ''}

Generate collision_items for ALL 5 elements. organ_wuxing MUST be Chinese character: 木/火/土/金/水.
Keep current_forces ≤30 words, prevention ≤20 words (concrete daily action). temporal_outlook ≤60 words.

Return JSON:
{"bazi_analysis":{"pillars":"≤40w","pattern":"≤40w","health_map":"≤40w"},
"collision_items":[
  {"organ_wuxing":"木","current_forces":"≤30w","risk_window":"month range in ${Y}","prevention":"concrete action ≤20w"},
  {"organ_wuxing":"火","current_forces":"≤30w","risk_window":"","prevention":"≤20w"},
  {"organ_wuxing":"土","current_forces":"≤30w","risk_window":"","prevention":"≤20w"},
  {"organ_wuxing":"金","current_forces":"≤30w","risk_window":"","prevention":"≤20w"},
  {"organ_wuxing":"水","current_forces":"≤30w","risk_window":"","prevention":"≤20w"}
],
"life_tuning":{"medical_advice":["concrete action","",""],"destiny_advice":["food/color/direction","",""]},
"temporal_outlook":"≤60w outlook from ${Y}/${M}",
"key_dates":["${Y}/Month: reason"]}` :

`【确定性排盘数据 — 服务器计算，严禁重新推导】
${JSON.stringify(chartData, null, 2)}

八字：${baziStr}
⚠ 当前日期：${Y}年${M}月 — 所有预测必须是${Y}年或以后。严禁提到${Y-1}年或更早的年份。
${astroNote ? '【天文备注】' + astroNote : ''}

为五行全部生成collision_items（木火土金水）。current_forces≤30字，prevention≤20字（具体日常行动）。temporal_outlook≤60字。

返回JSON：
{"bazi_analysis":{"pillars":"≤40字","pattern":"≤40字","health_map":"≤40字"},
"collision_items":[
  {"organ_wuxing":"木","current_forces":"≤30字","risk_window":"${Y}年月份范围","prevention":"具体行动≤20字"},
  {"organ_wuxing":"火","current_forces":"≤30字","risk_window":"","prevention":"≤20字"},
  {"organ_wuxing":"土","current_forces":"≤30字","risk_window":"","prevention":"≤20字"},
  {"organ_wuxing":"金","current_forces":"≤30字","risk_window":"","prevention":"≤20字"},
  {"organ_wuxing":"水","current_forces":"≤30字","risk_window":"","prevention":"≤20字"}
],
"life_tuning":{"medical_advice":["具体行动","",""],"destiny_advice":["食物/颜色/方位","",""]},
"temporal_outlook":"从${Y}年${M}月起≤60字展望",
"key_dates":["${Y}年X月：原因"]}`;

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 3000,
        temperature: 0.3,
        messages: [
          { role: 'system', content: isEn ? SYSTEM_EN : SYSTEM_ZH },
          { role: 'user', content: userMsg }
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      const msg = err.startsWith('<') ? `Gateway error (${resp.status})` : err.substring(0, 200);
      return res.status(500).json({ error: `DeepSeek error (${resp.status}): ${msg}` });
    }

    const rawText = await resp.text();
    if (rawText.startsWith('<')) return res.status(502).json({ error: 'Meta API invalid response. Please retry.' });

    let data;
    try { data = JSON.parse(rawText); } catch { return res.status(502).json({ error: 'Meta API parse error.' }); }

    const txt = data.choices?.[0]?.message?.content || '';
    const parsed = parseJson(txt);
    res.json(parsed || { collision_items: [], temporal_outlook: txt.substring(0, 800) });
  } catch (e) {
    res.status(500).json({ error: 'Destiny error: ' + e.message });
  }
}
