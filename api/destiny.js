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

// Read body manually to avoid Vercel default parser issues
async function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
  });
}

const SYSTEM = `你是精通八字命理学的顶级命理师，深谙中医藏象学说。

分析框架（按优先级，合并输出）：
1. 四柱拆解：逐柱说明天干地支、五行阴阳
2. 天干生克+地支刑冲合会：重点列出命局中实际存在的关系
3. 格局判定：格局名称、用神、忌神
4. 调候+通关：寒暖燥湿、五行相战的化解
5. 十二长生+旺相休囚死：日主状态、当令五行状态
6. 神煞：仅列出命局中实际存在的（天乙贵人、驿马、桃花、华盖、天医、羊刃等）
7. 健康对撞：木=肝胆(甲胆乙肝)、火=心小肠(丙小肠丁心)、土=脾胃(戊胃己脾)、金=肺大肠(庚大肠辛肺)、水=肾膀胱(壬膀胱癸肾)。分析大运流年对脏腑的生克泄耗。

直接返回纯JSON，不要markdown代码块。每个字段控制在100字以内。`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const body = await readBody(req);
    const { baziPillars, baziStr, dayMaster, dayMasterElement, dayun, liunian, wuxing, findings, lang } = body;
    const isEn = lang === 'en';

    const KEY = process.env.DEEPSEEK_API_KEY;
    if (!KEY) return res.status(500).json({ error: isEn ? 'DEEPSEEK_API_KEY not configured' : '未配置 DEEPSEEK_API_KEY' });

    // Build detailed pillar description
    let pillarDesc = '';
    if (baziPillars) {
      pillarDesc = `年柱: ${baziPillars.year || '未知'}\n月柱: ${baziPillars.month || '未知'}\n日柱: ${baziPillars.day || '未知'}（日主）\n时柱: ${baziPillars.hour || '未知'}\n`;
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const prompt = `【当前日期】${currentYear}年${currentMonth}月

【用户八字命盘】
${pillarDesc}完整八字: ${baziStr}
日主: ${dayMaster}（${dayMasterElement}）

【当前时运】
大运: ${dayun.lbl}（${dayun.el}）
流年（${currentYear}年）: ${liunian.lbl}（${liunian.el}）

【原局五行力量分布（含大运流年修正）】
木: ${wuxing['木']}% | 火: ${wuxing['火']}% | 土: ${wuxing['土']}% | 金: ${wuxing['金']}% | 水: ${wuxing['水']}%

【科学大脑发现的健康异常】
${findings || '无明显异常'}

请严格按照系统提示中的十大分析框架，逐一进行完整分析，并与健康异常进行对撞。

重要：所有时间预测必须基于当前${currentYear}年${currentMonth}月，预测${currentYear}年剩余月份和${currentYear + 1}年的趋势。不要出现过去年份的预测。

返回纯JSON格式：
{
  "bazi_analysis": {
    "pillars_detail": "四柱逐柱拆解",
    "tiangang_relations": "天干生克反应（含天干五合）",
    "dizhi_relations": "地支刑冲破害合会反应",
    "pattern": "格局判定（格局名称、用神、忌神）",
    "tiaohou": "调候用神分析",
    "tongguan": "通关用神分析",
    "twelve_stages": "日主十二长生在四柱的状态",
    "wangxiang": "当令五行旺相休囚死判断",
    "shenshas": "命局中出现的所有神煞"
  },
  "collision_items": [
    {
      "metric": "异常指标代码",
      "organ_wuxing": "对应五行",
      "current_forces": "当前大运流年对该脏腑的五行作用力分析",
      "evolution_path": "未来演化趋势预判",
      "risk_window": "高风险时间窗口（必须是${currentYear}年或${currentYear + 1}年）",
      "prevention": "基于命理的预防性养生建议"
    }
  ],
  "life_tuning": {
    "medical_advice": ["左脑（医学）建议1", "左脑（医学）建议2", "左脑（医学）建议3"],
    "destiny_advice": ["右脑（命理）建议1：包含具体的五行调节方法（颜色、方位、食物、时间等）", "右脑（命理）建议2", "右脑（命理）建议3"]
  },
  "temporal_outlook": "从${currentYear}年${currentMonth}月起未来12个月整体运势与健康走向",
  "key_dates": ["${currentYear}年X月：原因", "${currentYear + 1}年X月：原因"]
}`;

    // Add language instruction
    const langInstruction = isEn
      ? '\n\nCRITICAL LANGUAGE INSTRUCTION: You MUST respond entirely in English. For organ_wuxing field, use ONLY the Chinese element character (木/火/土/金/水). For all text fields (current_forces, evolution_path, prevention, temporal_outlook, etc), write fluent English. Use original Chinese terms naturally in parentheses where helpful, e.g. "the Wood element (木) governs the Liver". Do NOT output any code, variable names, function calls, or system references like "systemMap" or ".organ". Write as a wise counselor, not a programmer.'
      : '';

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 4000,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM + langInstruction },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: 'DeepSeek error(' + resp.status + '): ' + err.substring(0, 300) });
    }

    const data = await resp.json();
    const txt = data.choices?.[0]?.message?.content || '';
    const parsed = parseJson(txt);
    res.json(parsed || { collision_items: [], temporal_outlook: txt.substring(0, 800) });
  } catch (e) {
    res.status(500).json({ error: 'Destiny analysis error: ' + e.message });
  }
}
