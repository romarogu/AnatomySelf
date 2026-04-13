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

const SYSTEM_ZH = `你是精通八字命理学的顶级命理师，深谙中医藏象学说。

分析框架（按优先级，合并输出）：
1. 四柱拆解：逐柱说明天干地支、五行阴阳
2. 天干生克+地支刑冲合会：重点列出命局中实际存在的关系
3. 格局判定：格局名称、用神、忌神
4. 调候+通关：寒暖燥湿、五行相战的化解
5. 十二长生+旺相休囚死：日主状态、当令五行状态
6. 神煞：仅列出命局中实际存在的（天乙贵人、驿马、桃花、华盖、天医、羊刃等）
7. 健康对撞：木=肝胆(甲胆乙肝)、火=心小肠(丙小肠丁心)、土=脾胃(戊胃己脾)、金=肺大肠(庚大肠辛肺)、水=肾膀胱(壬膀胱癸肾)。分析大运流年对脏腑的生克泄耗。

直接返回纯JSON，不要markdown代码块。每个字段控制在100字以内。`;

const SYSTEM_EN = `You are a master of BaZi (Chinese Four Pillars of Destiny) and traditional Chinese organ theory.

Analysis framework (by priority, merged output):
1. Four Pillars: each pillar's Heavenly Stem, Earthly Branch, element, yin/yang
2. Stem interactions + Branch clashes/combinations/punishments
3. Pattern: pattern name, useful god, harmful god
4. Seasonal balance + mediating element
5. Twelve Life Stages + seasonal element strength
6. Spirit Stars: only those present (Noble Star, Traveling Horse, Peach Blossom, etc.)
7. Health collision: Wood=Liver/Gallbladder, Fire=Heart/Small Intestine, Earth=Spleen/Stomach, Metal=Lung/Large Intestine, Water=Kidney/Bladder. Analyze how current cycles affect each organ.

Return pure JSON, no markdown. Each field ≤100 words. Write fluent English. Use Chinese terms in parentheses naturally, e.g. "Wood element (木)". The organ_wuxing field MUST be a single Chinese character: 木/火/土/金/水.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const body = await readBody(req);
    const { baziStr, dayMaster, dayMasterElement, dayun, liunian, wuxing, findings, lang } = body;
    const isEn = lang === 'en';

    const KEY = process.env.DEEPSEEK_API_KEY;
    if (!KEY) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

    const Y = new Date().getFullYear();
    const M = new Date().getMonth() + 1;

    const jsonTemplate = isEn ? `Return JSON:
{
  "bazi_analysis": {
    "pillars_detail": "pillar breakdown",
    "pattern": "pattern + useful/harmful gods",
    "health_map": "organ strengths and weaknesses from the chart"
  },
  "collision_items": [
    {"organ_wuxing": "木or火or土or金or水", "current_forces": "current cycle forces on this organ", "evolution_path": "future trend", "risk_window": "high-risk period in ${Y}-${Y+1}", "prevention": "preventive advice"}
  ],
  "life_tuning": {
    "medical_advice": ["clinical recommendation 1", "2", "3"],
    "destiny_advice": ["energetic recommendation with colors/directions/foods/timing", "2", "3"]
  },
  "temporal_outlook": "12-month outlook from ${Y}/${M}",
  "key_dates": ["${Y} Month: reason", "${Y+1} Month: reason"]
}` : `返回JSON:
{
  "bazi_analysis": {
    "pillars_detail": "四柱拆解",
    "pattern": "格局+用神忌神",
    "health_map": "命局中各脏腑的强弱分析"
  },
  "collision_items": [
    {"organ_wuxing": "对应五行(木/火/土/金/水)", "current_forces": "当前大运流年对该脏腑的作用力", "evolution_path": "演化趋势", "risk_window": "${Y}-${Y+1}年高风险窗口", "prevention": "预防性养生建议"}
  ],
  "life_tuning": {
    "medical_advice": ["医学建议1", "2", "3"],
    "destiny_advice": ["命理建议(含颜色方位食物时间)", "2", "3"]
  },
  "temporal_outlook": "从${Y}年${M}月起12个月展望",
  "key_dates": ["${Y}年X月：原因", "${Y+1}年X月：原因"]
}`;

    const prompt = isEn
      ? `${baziStr} | Day Master: ${dayMaster} (${dayMasterElement}) | Major Cycle: ${dayun.lbl} (${dayun.el}) | Annual Cycle ${Y}: ${liunian.lbl} (${liunian.el})
Five Elements: Wood ${wuxing['木']}% | Fire ${wuxing['火']}% | Earth ${wuxing['土']}% | Metal ${wuxing['金']}% | Water ${wuxing['水']}%
Health findings: ${findings || 'All biomarkers within normal range'}
Predict from ${Y}/${M} to ${Y+1}. ALL text must be in English.
${jsonTemplate}`
      : `${baziStr} | 日主: ${dayMaster}（${dayMasterElement}）| 大运: ${dayun.lbl}（${dayun.el}）| 流年${Y}: ${liunian.lbl}（${liunian.el}）
五行: 木${wuxing['木']}% 火${wuxing['火']}% 土${wuxing['土']}% 金${wuxing['金']}% 水${wuxing['水']}%
健康发现: ${findings || '无明显异常'}
预测${Y}年${M}月至${Y+1}年。
${jsonTemplate}`;

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
