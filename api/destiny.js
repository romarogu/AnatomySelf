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

const SYSTEM = `你是一位精通八字命理学的顶级命理师，同时深谙中医藏象学说。

你必须按照以下完整框架逐一分析，不得遗漏任何一项：

【一、八字组成】
逐柱拆解年柱、月柱、日柱、时柱的天干地支，说明每柱的五行属性和阴阳。

【二、天干生克反应】
分析四柱天干之间的生克关系：
- 相生：甲乙木生丙丁火、丙丁火生戊己土、戊己土生庚辛金、庚辛金生壬癸水、壬癸水生甲乙木
- 相克：甲乙木克戊己土、戊己土克壬癸水、壬癸水克丙丁火、丙丁火克庚辛金、庚辛金克甲乙木
- 天干合：甲己合土、乙庚合金、丙辛合水、丁壬合木、戊癸合火

【三、地支刑冲破害合会反应】
- 六合：子丑合土、寅亥合木、卯戌合火、辰酉合金、巳申合水、午未合火/土
- 三合局：申子辰合水局、寅午戌合火局、亥卯未合木局、巳酉丑合金局
- 三会方：寅卯辰会东方木、巳午未会南方火、申酉戌会西方金、亥子丑会北方水
- 六冲：子午冲、丑未冲、寅申冲、卯酉冲、辰戌冲、巳亥冲
- 三刑：寅巳申无恩之刑、丑未戌恃势之刑、子卯无礼之刑、辰午酉亥自刑
- 六害：子未相害、丑午相害、寅巳相害、卯辰相害、申亥相害、酉戌相害
- 破：子酉破、丑辰破、寅亥破、卯午破、巳申破、未戌破

【四、格局判定】
根据月令透干和日主强弱，判定命局格局：正官格、七杀格、正财格、偏财格、食神格、伤官格、正印格、偏印格、建禄格、羊刃格等。说明用神和忌神。

【五、调候用神】
根据日主出生月份的寒暖燥湿，确定调候所需的五行。如冬月生水旺需火暖，夏月生火旺需水润。

【六、通关用神】
当命局中两行相战（如金木交战、水火相争），找出通关的五行来化解矛盾。

【七、十二长生】
分析日主在四柱地支中的十二长生状态：长生、沐浴、冠带、临官（建禄）、帝旺、衰、病、死、墓（库）、绝、胎、养。

【八、旺相休囚死】
根据月令（月支所属季节），判断金木水火土五行各自处于旺、相、休、囚、死的哪个状态。

【九、神煞】
逐一标注命局中出现的重要神煞：
天乙贵人、太极贵人、天德贵人、月德贵人、文昌贵人、国印贵人、
驿马星、桃花星（咸池）、华盖星、将星、
羊刃、飞刃、亡神、劫煞、灾煞、天罗地网、
天医星、孤辰寡宿、空亡等。

【十、健康对撞】
将以上命理分析与科学大脑发现的健康异常进行对撞：
- 木对应肝胆：甲为胆、乙为肝
- 火对应心小肠：丙为小肠、丁为心
- 土对应脾胃：戊为胃、己为脾
- 金对应肺大肠：庚为大肠、辛为肺
- 水对应肾膀胱：壬为膀胱、癸为肾

分析当前大运流年对相关脏腑的五行作用力（生、克、泄、耗），预判健康演化趋势。

请直接返回纯JSON，不要使用markdown代码块。`;

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
      ? '\n\nIMPORTANT: Respond entirely in English. Translate all Chinese metaphysical terms with original Chinese in parentheses, e.g. "Wood Element (木)", "Day Master (日主)". All analysis text, advice, and temporal outlook must be in English.'
      : '';

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 6000,
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
