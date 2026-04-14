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

// ═══════════════════════════════════════
// SYSTEM PROMPTS — "Interpreter, not Calculator"
// ═══════════════════════════════════════

const SYSTEM_EN = `You are the interpretive voice of a deterministic Chinese Metaphysics engine named "AnatomySelf".
You are NOT an oracle or fortune teller. You are a technical translator converting a strict mathematical chart into accessible, Stoic-inspired life guidance.

IRON RULES:
1. NO CALCULATION: You are FORBIDDEN from calculating time zones, solar time, Five Elements ratios, or BaZi pillars. The user has provided the EXACT computed chart and elemental percentages. Trust the provided data absolutely. If you recalculate, you WILL introduce errors.
2. ANALOGICAL MAPPING: Translate elements to modern physiology: Wood=Liver/Autonomic nervous system, Fire=Heart/Cardiovascular drive, Earth=Spleen/Digestive metabolism, Metal=Lung/Respiratory immune barrier, Water=Kidney/Endocrine & electrolyte balance. Use Greek Four Humors or systems biology as bridges.
3. TONE: Respectful, academic, yet profound. Frame "Destiny" as "Biological & Circumstantial Inclination" — Nature informing Nurture. Avoid mystical fluff.
4. PRECISION: Use clinical language. Say "hepatic enzyme elevation risk" not "liver might feel weak". Say "cardiovascular systolic strain" not "heart pressure".
5. HALLUCINATION PREVENTION: If asked about timezone or solar calculations, reply: "The chart was computed by the server using IANA TZ database and True Solar Time corrections. Refer to the Methodology page."

OUTPUT: Return pure JSON, no markdown. Each field ≤100 words.`;

const SYSTEM_ZH = `你是一款名为"AnatomySelf"的确定性命理引擎的解释层AI。
你不是算命先生，而是将严密的数学排盘结果翻译为人性化洞察的学术翻译官。

铁律：
1. 禁止计算：严禁重新计算五行百分比、生肖、十神或真太阳时。用户已在输入中提供了精确的排盘数据。你的任务是"朗读并解释"这些数据，而非"推导"它们。如果你重新计算，你会引入错误。
2. 生理映射：木=肝胆/自主神经调节，火=心/心血管循环，土=脾胃/消化代谢，金=肺/呼吸免疫屏障，水=肾/内分泌电解质平衡。
3. 精准用词：说"肝细胞代谢压力"而非"肝不太好"。说"心血管收缩压负荷"而非"心脏有点累"。
4. 哲学基调：斯多葛倾向。了解倾向是为了优化选择，而非屈服于宿命。
5. 确定性原则：所有五行数值必须严格引用输入数据，不得凭感觉修改。

输出：返回纯JSON，不要markdown。每字段≤100字。`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const body = await readBody(req);
    const { baziPillars, baziStr, dayMaster, dayMasterElement, dayun, liunian, wuxing, findings, lang, solarCorrection } = body;
    const isEn = lang === 'en';

    const KEY = process.env.DEEPSEEK_API_KEY;
    if (!KEY) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

    const Y = new Date().getFullYear();
    const M = new Date().getMonth() + 1;

    // Build the deterministic JSON user message — AI must NOT recalculate these
    const chartData = {
      computed_chart: {
        pillars: baziPillars,
        full_bazi: baziStr,
        day_master: `${dayMaster} (${dayMasterElement})`,
      },
      elements_balance: {
        wood: wuxing['木'] || 0,
        fire: wuxing['火'] || 0,
        earth: wuxing['土'] || 0,
        metal: wuxing['金'] || 0,
        water: wuxing['水'] || 0,
      },
      current_cycles: {
        luck_pillar: `${dayun.lbl} (${dayun.el})`,
        annual_pillar: `${liunian.lbl} (${liunian.el})`,
        current_date: `${Y}/${M}`,
      },
      health_findings: findings || (isEn ? 'All biomarkers within normal range' : '无明显异常'),
    };

    // Add astronomical note if solar correction was performed
    if (solarCorrection) {
      chartData.astronomical_note = isEn
        ? `True Solar Time correction applied: ${solarCorrection.description}. The birth hour pillar was adjusted based on longitude offset (${solarCorrection.lonCorrection} min) and Equation of Time (${solarCorrection.eot} min).`
        : `已应用真太阳时校正：${solarCorrection.description}。时柱基于经度偏移(${solarCorrection.lonCorrection}分钟)和均时差(${solarCorrection.eot}分钟)进行了调整。`;
    }

    const jsonTemplate = isEn ? `Based on the EXACT computed data above (do NOT recalculate), provide your interpretation.
Return JSON:
{"bazi_analysis":{"pillars":"describe each pillar's nature ≤60w","pattern":"pattern + useful/harmful gods ≤60w","health_map":"organ strengths and weaknesses from the chart ≤60w"},
"collision_items":[{"organ_wuxing":"木/火/土/金/水","current_forces":"current cycle forces ≤50w","risk_window":"high-risk period","prevention":"preventive advice ≤40w"}],
"life_tuning":{"medical_advice":["clinical recommendation ≤30w","",""],"destiny_advice":["energetic recommendation with colors/directions/foods ≤30w","",""]},
"temporal_outlook":"12-month outlook ≤80w",
"key_dates":["Month Year: reason"]}`
    : `基于以上精确计算数据（禁止重新计算），提供你的解读。
返回JSON:
{"bazi_analysis":{"pillars":"四柱性质描述≤60字","pattern":"格局+用神忌神≤60字","health_map":"脏腑强弱≤60字"},
"collision_items":[{"organ_wuxing":"木/火/土/金/水","current_forces":"当前时运作用力≤50字","risk_window":"高风险窗口","prevention":"预防建议≤40字"}],
"life_tuning":{"medical_advice":["临床建议≤30字","",""],"destiny_advice":["能量调节建议(颜色方位食物)≤30字","",""]},
"temporal_outlook":"12个月展望≤80字",
"key_dates":["年月：原因"]}`;

    const userMessage = isEn
      ? `【DETERMINISTIC CHART DATA — computed by server, absolutely accurate】\n${JSON.stringify(chartData, null, 2)}\n\nPredict from ${Y}/${M} to ${Y+1}. ALL text must be in English.\n${jsonTemplate}`
      : `【确定性排盘数据 — 由服务器计算，绝对准确】\n${JSON.stringify(chartData, null, 2)}\n\n预测${Y}年${M}月至${Y+1}年。\n${jsonTemplate}`;

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
          { role: 'user', content: userMessage }
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
