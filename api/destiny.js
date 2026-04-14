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

const SYSTEM_ZH = `你是"精密玄学"算法的解释层AI。你不是算命先生，而是将严密的数学排盘结果翻译为人性化洞察的学术翻译官。

【铁律 - 严禁幻觉】
1. 禁止计算：严禁重新计算五行百分比、生肖、十神或真太阳时。用户已在输入中提供了精确的排盘数据。你的任务是"朗读并解释"这些数据，而非"推导"它们。
2. 确定性原则：严格对照输入数据回答，不得凭感觉修改任何数值。

【解释框架】
1. 生理映射：木=神经/肝、火=心血管/热情、土=消化/稳定、金=呼吸/界限、水=内分泌/恐惧
2. 哲学基调：斯多葛学派。"了解倾向是为了优化选择，而非屈服于宿命"
3. 输出格式：纯JSON，每字段≤80字。organ_wuxing用单个中文字符(木/火/土/金/水)`;

const SYSTEM_EN = `You are the interpretive voice of a deterministic Chinese Metaphysics engine called "Precision BaZi".
You are NOT an oracle. You are a technical translator converting a strict mathematical chart into accessible, Stoic-inspired life guidance.

IRON RULES:
1. NO CALCULATION: You are FORBIDDEN from calculating timezones, solar time, or Five Elements ratios. The input JSON contains the EXACT chart and percentages. Trust the data absolutely. If you recalculate, you introduce errors.
2. ANALOGICAL MAPPING: Translate elements to modern physiology — Wood=Nervous system/Liver, Fire=Cardiovascular/Drive, Earth=Digestion/Stability, Metal=Respiratory/Boundaries, Water=Endocrine/Fear-response.
3. TONE: Academic yet profound. Frame "Destiny" as "Biological & Circumstantial Inclination". Stoic philosophy.
4. HALLUCINATION PREVENTION: If asked about timezone or calculation, reply: "The chart was computed by the server using IANA TZ database and True Solar Time corrections."

Return pure JSON, no markdown. Each field ≤80 words. organ_wuxing MUST be a single Chinese character: 木/火/土/金/水.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const body = await readBody(req);
    const { baziStr, dayMaster, dayMasterElement, dayun, liunian, wuxing, findings, lang, solarCorrection } = body;
    const isEn = lang === 'en';

    const KEY = process.env.DEEPSEEK_API_KEY;
    if (!KEY) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

    const Y = new Date().getFullYear();
    const M = new Date().getMonth() + 1;

    // Build astronomical note if solar correction is available
    const astroNote = solarCorrection
      ? (isEn
        ? `Astronomical Note: True Solar Time correction of ${solarCorrection.description} was applied. Solar noon on this date occurred at approximately ${solarCorrection.solarNoonOffset} local time.`
        : `天文备注：已应用真太阳时校正 ${solarCorrection.description}。该日太阳正午约在当地时间 ${solarCorrection.solarNoonOffset}。`)
      : '';

    // Deterministic chart data — AI must NOT recalculate these
    const chartData = isEn ? `
【DETERMINISTIC CHART DATA — DO NOT RECALCULATE】
Chart: ${baziStr}
Day Master: ${dayMaster} (${dayMasterElement})
Current Luck Pillar: ${dayun.lbl} (${dayun.el})
Annual Pillar ${Y}: ${liunian.lbl} (${liunian.el})
Elements Balance: Wood ${wuxing['木']}% | Fire ${wuxing['火']}% | Earth ${wuxing['土']}% | Metal ${wuxing['金']}% | Water ${wuxing['水']}%
${astroNote}
Health Findings: ${findings || 'All biomarkers within normal range'}

Based on the EXACT data above, provide interpretation for ${Y}/${M} to ${Y+1}. ALL text in English.` : `
【确定性排盘数据 — 严禁重新计算】
八字: ${baziStr}
日主: ${dayMaster}（${dayMasterElement}）
大运: ${dayun.lbl}（${dayun.el}）
流年${Y}: ${liunian.lbl}（${liunian.el}）
五行力量: 木${wuxing['木']}% 火${wuxing['火']}% 土${wuxing['土']}% 金${wuxing['金']}% 水${wuxing['水']}%
${astroNote}
健康发现: ${findings || '无明显异常'}

基于以上精确数据，解读${Y}年${M}月至${Y+1}年趋势。`;

    const jsonTemplate = `
{"bazi_analysis":{"pillars":"","pattern":"","health_map":""},"collision_items":[{"organ_wuxing":"木/火/土/金/水","current_forces":"","evolution_path":"","risk_window":"","prevention":""}],"life_tuning":{"medical_advice":["","",""],"destiny_advice":["","",""]},"temporal_outlook":"","key_dates":[""]}`;

    const prompt = `${chartData}\n${isEn?'Return JSON:':'返回JSON:'}${jsonTemplate}`;

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 3000,
        temperature: 0.3,
        messages: [
          { role: 'system', content: isEn ? SYSTEM_EN : SYSTEM_ZH },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      const msg = err.startsWith('<') ? `API gateway error (${resp.status})` : err.substring(0, 200);
      return res.status(500).json({ error: `DeepSeek error (${resp.status}): ${msg}` });
    }

    const rawText = await resp.text();
    if (rawText.startsWith('<') || rawText.startsWith('<!')) {
      return res.status(502).json({ error: 'Meta API returned invalid response. Please retry.' });
    }

    let data;
    try { data = JSON.parse(rawText); } catch {
      return res.status(502).json({ error: 'Meta API response parse error. Please retry.' });
    }

    const txt = data.choices?.[0]?.message?.content || '';
    const parsed = parseJson(txt);
    res.json(parsed || { collision_items: [], temporal_outlook: txt.substring(0, 800) });
  } catch (e) {
    res.status(500).json({ error: 'Destiny analysis error: ' + e.message });
  }
}
