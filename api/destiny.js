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
1. NO CALCULATION: FORBIDDEN from recalculating Five Elements ratios, zodiac, or solar time. The chart data is EXACT. Trust it absolutely.
2. ANALOGICAL MAPPING: Wood="Growth & Nervous regulation", Fire="Charisma & Cardiovascular drive", Earth="Stability & Digestive grounding", Metal="Structure & Respiratory discipline", Water="Adaptability & Endocrine depth".
3. TONE: Academic yet profound. "Destiny" = "Biological & Circumstantial Inclination".
4. DEPTH != LENGTH. Use precise terminology. Each field max 80 words.
5. If the astronomical note mentions solar time correction, naturally weave it into your interpretation.

Return pure JSON only.`;

const SYSTEM_ZH = `你是"精密玄学"算法的解释层AI。你不是算命先生，而是将严密的数学排盘结果翻译为人性化洞察的学术翻译官。

【铁律】
1. 禁止计算：严禁重新计算五行百分比、十神或真太阳时。输入数据是精确的，你只负责解释。
2. 生理映射：木-神经/肝，火-心血管，土-消化/稳定，金-呼吸/界限，水-内分泌。
3. 哲学基调：斯多葛倾向。了解倾向为了优化选择，非屈服宿命。
4. 深度不等于长度。每字段最多80字。
5. 若天文备注提到真太阳时校正，在解释中自然引用。

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

BaZi: ${baziStr} | Date: ${Y}/${M}
${astroNote ? 'ASTRONOMICAL NOTE: ' + astroNote : ''}

Interpret the EXACT data above. Return JSON:
{"bazi_analysis":{"pillars":"pillar breakdown","pattern":"pattern+gods","health_map":"organ strengths/weaknesses"},
"collision_items":[{"organ_wuxing":"element char","current_forces":"","risk_window":"","prevention":""}],
"life_tuning":{"medical_advice":["","",""],"destiny_advice":["with colors/directions/foods","",""]},
"temporal_outlook":"12-month from ${Y}/${M}",
"key_dates":["Month Year: reason"]}` :

`【确定性排盘数据 — 服务器计算，严禁重新推导】
${JSON.stringify(chartData, null, 2)}

八字：${baziStr} | 日期：${Y}年${M}月
${astroNote ? '【天文备注】' + astroNote : ''}

基于以上精确数据解释。返回JSON：
{"bazi_analysis":{"pillars":"四柱","pattern":"格局+用忌神","health_map":"脏腑强弱"},
"collision_items":[{"organ_wuxing":"五行字","current_forces":"","risk_window":"","prevention":""}],
"life_tuning":{"medical_advice":["","",""],"destiny_advice":["含颜色方位食物","",""]},
"temporal_outlook":"${Y}年${M}月起12月展望",
"key_dates":["年月：原因"]}`;

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
