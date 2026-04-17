export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

function parseJson(txt) {
  if (!txt) return null;
  let s = txt.trim();
  s = s.replace(/^```+\s*(?:json)?\s*\n?/gi, '').replace(/\n?\s*```+\s*$/g, '').trim();
  const i = s.indexOf('{'); if (i < 0) return null; s = s.substring(i);
  let d = 0, e = -1;
  for (let j = 0; j < s.length; j++) {
    if (s[j] === '{') d++; if (s[j] === '}') { d--; if (d === 0) { e = j; break; } }
  }
  if (e > 0) s = s.substring(0, e + 1);
  else {
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


// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPTS — Digital Alchemist (Meta Brain)
// ═══════════════════════════════════════════════════════════════

const SYSTEM_EN = `### Role: AnatomySelf Digital Alchemist (Meta Brain)
You are a "Digital Alchemist" who masters both traditional Zi-Ping BaZi (子平八字) and modern functional medicine. Your task is to receive the user's "spacetime coordinates (BaZi chart)" and cross-reference them with "physiological coordinates (biomarkers)" for collision analysis.

### Core Knowledge Framework:
1. **Foundation Modeling**: Parse the Year/Month/Day/Hour Four Pillars (天干地支).
2. **Energy Dynamics**: Analyze Heavenly Stem interactions (生克) and Earthly Branch reactions (刑冲破害合会).
3. **Strength Audit**: Determine Day Master and Five Element energy via 旺相休囚死 and 十二长生 positions.
4. **Pattern & Balance**: Identify chart pattern (格局), analyze climate-regulation (调候) needs, find bridging elements (通关).
5. **Star Warnings**: Incorporate symbolic stars (神煞 — e.g. 羊刃, 血支, 白虎) as qualitative physiological risk signals.

### Collision Logic:
- Map Five Elements to organ systems: Wood(肝胆), Fire(心血管), Earth(脾胃代谢), Metal(呼吸), Water(肾内分泌).
- **Collision Directive**: When biomarker anomalies exist, search for corresponding energetic conflicts (e.g. Earth excess suppressing Water → kidney stress, Fire excess melting Metal → respiratory vulnerability).
- **Time Anchor**: Use ONLY the current date provided. NEVER reference past years.

### Output Style:
- Narrative tone: Mystical, cold, scientific. Like an oracle reading ancient instruments.
- FORBIDDEN: Empty platitudes or generic fortune-telling. Every insight must be a data-backed "energy audit".
- Terminology: Use BaZi terms internally, but translate for users as "systemic energy conflicts" or "spacetime rhythm pressure" when appropriate.
- LANGUAGE: Respond ENTIRELY in English. Use Chinese characters only for organ_wuxing (木火土金水) and BaZi terms in parentheses.

Return ONLY valid JSON. No markdown, no code blocks, no text before or after the JSON.

EXAMPLE of a GOOD current_forces:
"Wood dominates at 46.8%, fueled by the Day Master's deep root in Mao (卯). The current Fire luck pillar channels Wood's excess into Heart strain, elevating systolic pressure. Liver Qi stagnation manifests as tension headaches and irritability."

NEVER write something like "Wood is at 30." — this is unacceptable.`;

const SYSTEM_ZH = `### 角色：AnatomySelf 数字炼金术师（命理脑）
你是一位精通传统子平八字与现代功能医学的"数字炼金术师"。你的任务是接收用户的"时空坐标（生辰八字）"并将其与"生理坐标（体检指标）"进行对撞分析。

### 核心知识框架：
1. **基础建模**：解析年月日时四柱的天干地支。
2. **能量动态**：分析天干生克，以及地支的"刑、冲、破、害、合、会"反应。
3. **强弱审计**：通过"旺相休囚死"与"十二长生"位判断日主与五行能量的绝对值。
4. **格局与平衡**：识别命局"格局"，分析"调候"需求，寻找"通关"五行。
5. **神煞预警**：引入神煞（如羊刃、血支、白虎等）作为生理风险的定性参考。

### 双脑对撞逻辑：
- 将五行能量映射至五脏系统：木(肝胆)、火(心血管)、土(脾胃代谢)、金(呼吸系统)、水(肾内分泌)。
- **对撞指令**：若检测到指标异常，必须搜索命局中是否存在对应的能量冲突（如土重克水→肾压，火旺烁金→呼吸脆弱）。
- **时间锚点**：使用当前系统时间。严禁参考过去年份的数据。

### 输出风格：
- 叙事风格：神秘、冷峻、科学。如同神谕解读古代仪器。
- 严禁输出空洞的吉祥话，必须是基于数据的"能量审计"。
- 术语处理：八字术语可直接使用，但关键概念需翻译为用户能理解的表述，如"系统性能量冲突"或"时空节律压力"。
- 语言：全部用中文回答。

只返回有效JSON。不要markdown，不要代码块，JSON前后不要有任何文字。

【正确示例】current_forces应该这样写：
"木气以46.8%占据绝对主导，日主乙木深根于卯。当前丁卯火运将木气过剩引入心系统，推高收缩压。肝气郁结外显为偏头痛与急躁——这是典型的木旺侮土、土不制水的连锁反应。"

【错误示例】绝对不要这样写：
"木占30。" ← 太短，不可接受。必须分析干支关系、能量流向和身体影响。`;

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
? `CHART DATA (exact, do not recalculate):
${JSON.stringify(chartData)}

BaZi: ${baziStr} | NOW: ${Y}/${M}
${astro ? 'Solar note: ' + astro : ''}
${health ? 'Health findings: ' + health : ''}

Reply with ONLY this JSON (current_forces MUST be 2-3 full sentences, NEVER just a number):
{"bazi_analysis":{"pillars":"describe 4 pillars and their elements","pattern":"day master strength + useful/harmful gods","health_map":"which organs strong/weak based on elements"},"collision_items":[{"organ_wuxing":"木","current_forces":"Wood dominates at X%, fueled by [pillar relationship]. The [luck/annual pillar] channels this energy into [organ effect]. This manifests as [specific symptom or tendency].","risk_window":"${Y}/M-M","prevention":"1 concrete daily action with specific duration/frequency"},{"organ_wuxing":"火","current_forces":"Fire is [strong/weak] at X% because [reason from pillars]. [Effect on Heart/circulation]. [How it interacts with other elements this year].","risk_window":"","prevention":"1 action"},{"organ_wuxing":"土","current_forces":"[2-3 full sentences analyzing Earth/Spleen dynamics]","risk_window":"","prevention":"1 action"},{"organ_wuxing":"金","current_forces":"[2-3 full sentences analyzing Metal/Lung dynamics]","risk_window":"","prevention":"1 action"},{"organ_wuxing":"水","current_forces":"[2-3 full sentences analyzing Water/Kidney dynamics]","risk_window":"","prevention":"1 action"}],"temporal_outlook":"3-4 sentences on the next 12 months from ${Y}/${M}","key_dates":["${Y}/month: brief reason","${Y}/month: brief reason","${Y}/month: brief reason"]}`

: `【排盘数据（精确值，严禁重算）】
${JSON.stringify(chartData)}

八字：${baziStr} | 当前：${Y}年${M}月
${astro ? '天文备注：' + astro : ''}
${health ? '健康发现：' + health : ''}

只返回以下JSON（current_forces必须是2-3句完整分析，绝不能只写数字）：
{"bazi_analysis":{"pillars":"四柱及其元素描述","pattern":"日主强弱+用神忌神","health_map":"哪些脏腑强/弱"},"collision_items":[{"organ_wuxing":"木","current_forces":"木气以X%占据主导，因日主[关系]深根于[支]。当前[大运/流年]引木气入[脏腑]，造成[具体影响]。肝气郁结外显为[症状倾向]。","risk_window":"${Y}年X-X月","prevention":"1个具体日常行动（含时长/频率）"},{"organ_wuxing":"火","current_forces":"火行以X%处于[强/弱]态，因[柱中关系]。[对心脏/循环的影响]。[与其他元素的互动]。","risk_window":"","prevention":"1个行动"},{"organ_wuxing":"土","current_forces":"[2-3句完整分析土/脾胃动态]","risk_window":"","prevention":"1个行动"},{"organ_wuxing":"金","current_forces":"[2-3句完整分析金/呼吸动态]","risk_window":"","prevention":"1个行动"},{"organ_wuxing":"水","current_forces":"[2-3句完整分析水/肾脏动态]","risk_window":"","prevention":"1个行动"}],"temporal_outlook":"3-4句话展望从${Y}年${M}月起的12个月","key_dates":["${Y}年X月：简要原因","${Y}年X月：简要原因","${Y}年X月：简要原因"]}`;

    // Few-shot: show the model a COMPLETE example response so it matches the length
    const exampleUser = isEn ? 'BaZi: 甲寅 壬戌 乙卯 癸未 | NOW: 2026/4\nChart: {"dayMaster":"乙","dayMasterElement":"木","elementsBalance":{"木":46.8,"火":10.3,"土":18,"金":0.2,"水":24.6},"currentLuckPillar":"丁卯(火)","annualPillar":"丙午(火)"}' : '八字：甲寅 壬戌 乙卯 癸未 | 当前：2026年4月\n排盘：{"dayMaster":"乙","dayMasterElement":"木","elementsBalance":{"木":46.8,"火":10.3,"土":18,"金":0.2,"水":24.6},"currentLuckPillar":"丁卯(火)","annualPillar":"丙午(火)"}';

    const exampleReply = isEn
? `{"bazi_analysis":{"pillars":"Year 甲寅 (Wood/Wood), Month 壬戌 (Water/Earth), Day 乙卯 (Wood/Wood), Hour 癸未 (Water/Earth). Heavenly Stems: double Wood anchored by Water resource, no Metal control.","pattern":"Day Master 乙木 (Yin Wood) is extremely strong — rooted in Mao with Year Pillar support. Wood excess at 46.8%. Useful God: Fire (to drain) and Metal (to trim). Harmful: Water (over-nourishes).","health_map":"Liver/Gallbladder system (Wood) severely overloaded. Heart (Fire) starved at 10.3% — cardiovascular vulnerability. Lungs (Metal) nearly absent at 0.2% — respiratory defense critically low. Kidneys (Water) adequate but feeding the Wood excess."},"collision_items":[{"organ_wuxing":"木","current_forces":"Wood dominates at 46.8%, fueled by the Day Master's deep root in Mao (卯) and Year Pillar 甲寅's double-Wood reinforcement. The current Fire luck pillar 丁卯 paradoxically sits on another Wood branch, amplifying rather than draining the excess. Liver Qi stagnation manifests as systemic tension — expect headaches, tight shoulders, and irritability peaking in spring months.","risk_window":"2026/3-5","prevention":"Practice 15 minutes of slow abdominal breathing each morning to redirect Liver Qi downward and release upper-body tension."},{"organ_wuxing":"火","current_forces":"Fire registers at only 10.3% despite the 丁卯 luck pillar nominally belonging to Fire. The Yin Fire (丁) sits atop a Wood branch that steals its fuel — a classic case of Fire unable to ignite fully. This creates flickering Heart energy: moments of passion and anxiety that cannot sustain themselves. Cardiovascular rhythm instability is the primary concern.","risk_window":"2026/6-8","prevention":"Walk for 20 minutes in midday sunlight three times weekly to directly nourish Heart Fire through solar exposure."},{"organ_wuxing":"土","current_forces":"Earth holds 18% but faces relentless pressure from the dominant Wood element, which controls Earth through the Ke cycle (木克土). The Month Branch 戌 and Hour Branch 未 provide some Earth reservoir, yet Wood's 46.8% dominance means digestive function is chronically suppressed. Spleen-Stomach weakness shows as bloating after meals, poor nutrient absorption, and muscle fatigue.","risk_window":"2026/4-6","prevention":"Eat warm, cooked foods and avoid raw salads — cold food further weakens the already-suppressed Spleen Qi."},{"organ_wuxing":"金","current_forces":"Metal is critically deficient at 0.2% — virtually absent from the natal chart. No Heavenly Stem carries Metal, and no Branch provides meaningful Metal support. This leaves the Lung and immune system without structural defense. The excessive Wood further insults Metal through reverse-control (反侮), making respiratory infections and skin conditions persistent vulnerabilities.","risk_window":"2026/9-11","prevention":"Practice deep diaphragmatic breathing for 10 minutes before sleep to mechanically strengthen Lung capacity despite the energetic deficit."},{"organ_wuxing":"水","current_forces":"Water sits at 24.6%, supported by Month Stem 壬 and Hour Stem 癸. While adequate in quantity, this Water serves primarily as fuel for the already-overloaded Wood system — a resource being consumed faster than it regenerates. Kidney Essence (肾精) depletion risk is moderate, showing as lower back fatigue, diminished hearing acuity, and premature graying.","risk_window":"2026/11-2027/1","prevention":"Consume black sesame, walnuts, and kidney beans weekly to tonify Kidney Water at the dietary level."}],"temporal_outlook":"From April 2026, the Fire annual pillar 丙午 collides with your Water-dominant month pillar — expect heightened cardiovascular awareness through summer. Autumn 2026 brings Earth-Metal months that temporarily relieve Wood pressure, offering a window for immune strengthening. Winter 2026-2027 returns to Water energy, replenishing Kidney reserves but risking further Wood overgrowth. Strategic action in the Metal months of August-October is your highest-leverage intervention window.","key_dates":["2026/5: Wood peaks in Snake month — maximum Liver pressure","2026/8: Metal month begins — best window for immune/respiratory strengthening","2026/11: Water season returns — Kidney tonification priority"]}`
: `{"bazi_analysis":{"pillars":"年柱甲寅（木/木），月柱壬戌（水/土），日柱乙卯（木/木），时柱癸未（水/土）。天干双木以水为资源，无金制约。","pattern":"日主乙木极旺——深根于卯，年柱甲寅双木加持。木气过剩达46.8%。用神：火（泄秀）和金（修剪）。忌神：水（过度滋养）。","health_map":"肝胆系统（木）严重超载。心血管（火）仅10.3%——心系统脆弱。肺系统（金）近乎缺失0.2%——免疫防线极薄。肾系统（水）尚可但持续供养木气消耗。"},"collision_items":[{"organ_wuxing":"木","current_forces":"木气以46.8%占据绝对主导，日主乙木深根于卯，年柱甲寅的双木结构更是火上浇油。当前丁卯大运看似火运，实则卯木地支反而加强木势——泄秀不成反助纣。肝气郁结在春季达到峰值，外显为偏头痛、肩颈僵硬和情绪急躁。","risk_window":"2026年3-5月","prevention":"每日晨起练习15分钟腹式深呼吸，引导肝气下行，缓解上焦壅滞。"},{"organ_wuxing":"火","current_forces":"火行仅占10.3%，尽管丁卯大运名义属火，但丁火坐于卯木之上，木气夺走了火的根基——典型的'火欲明而木太湿'。心系统表现为忽冷忽热的能量波动：时而激情亢奋，时而心悸不安，缺乏持久稳定的心火支撑。","risk_window":"2026年6-8月","prevention":"每周三次在正午阳光下步行20分钟，以太阳之火直接补养心火。"},{"organ_wuxing":"土","current_forces":"土行持18%，看似不低，但面对46.8%的强木克制（木克土），脾胃系统长期处于被压制状态。月支戌土和时支未土虽提供土的储备，但在木气的持续碾压下，消化吸收功能受损明显——餐后腹胀、营养吸收差、肌肉乏力是典型表现。","risk_window":"2026年4-6月","prevention":"以温热熟食为主，避免生冷沙拉——寒凉食物会进一步削弱已被木气压制的脾阳。"},{"organ_wuxing":"金","current_forces":"金行仅0.2%，几乎从命局中缺席。天干无金，地支亦无有效金气支撑。肺与免疫系统失去结构性防线。木气过旺更对金行形成反侮——本应金克木，如今木旺反欺金弱。呼吸道感染和皮肤问题将是持续性脆弱点。","risk_window":"2026年9-11月","prevention":"睡前练习10分钟深度膈肌呼吸，从物理层面强化肺活量，弥补能量层面的金气缺失。"},{"organ_wuxing":"水","current_forces":"水行24.6%，月干壬水和时干癸水提供支撑。量上尚可，但这些水资源主要在源源不断地滋养已经过载的木系统——消耗速度超过再生速度。肾精（肾精）中度耗损风险，表现为腰膝酸软、听力微降和早生白发。","risk_window":"2026年11月-2027年1月","prevention":"每周食用黑芝麻、核桃、黑豆等黑色食物，从饮食层面补养肾水。"}],"temporal_outlook":"2026年4月起，丙午流年火柱与你水旺的月柱形成冲击——整个夏季需要关注心血管波动。秋季进入土金月份，暂时缓解木气压力，是强化免疫的黄金窗口。2026年冬至2027年初回归水运，肾水得到补充但也有再度助长木气的风险。8-10月的金月是你全年最高杠杆的干预窗口。","key_dates":["2026年5月：巳月木气到达顶峰——肝脏压力最大","2026年8月：申月金气启动——免疫/呼吸系统强化最佳窗口","2026年11月：水季回归——以肾水补养为优先"]}`;

    const messages = [
      { role: 'system', content: isEn ? SYSTEM_EN : SYSTEM_ZH },
      { role: 'user', content: exampleUser },
      { role: 'assistant', content: exampleReply },
      { role: 'user', content: userMsg }
    ];

    // ═══ Primary: Zhipu GLM-4-Plus ═══
    let txt = '';
    let usedZhipu = false;
    if (ZHIPU_KEY) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 30000); // 30s timeout
        const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_KEY}` },
          body: JSON.stringify({ model: 'glm-4-plus', max_tokens: 4000, temperature: 0.2, messages }),
        });
        clearTimeout(t);
        if (resp.ok) {
          const data = await resp.json();
          txt = data.choices?.[0]?.message?.content || '';
          usedZhipu = true;
          console.log('[destiny] Zhipu OK, length:', txt.length);
        } else {
          console.log('[destiny] Zhipu failed:', resp.status);
        }
      } catch (e) { console.log('[destiny] Zhipu timeout/error:', e.message); }
    }

    // ═══ Fallback: DeepSeek ═══
    if (!usedZhipu && DS_KEY) {
      console.log('[destiny] Falling back to DeepSeek...');
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DS_KEY}` },
        body: JSON.stringify({ model: 'deepseek-chat', max_tokens: 4000, temperature: 0.2, messages }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        return res.status(500).json({ error: `DeepSeek fallback error (${resp.status}): ${err.substring(0, 200)}` });
      }
      const rawText = await resp.text();
      let data;
      try { data = JSON.parse(rawText); } catch { return res.status(502).json({ error: 'API parse error.' }); }
      txt = data.choices?.[0]?.message?.content || '';
      console.log('[destiny] DeepSeek fallback OK, length:', txt.length);
    }

    if (!txt) return res.status(500).json({ error: 'No AI API available or all failed' });

    const parsed = parseJson(txt);
    if (!parsed) console.log('[destiny] PARSE FAILED. First 300:', txt.substring(0, 300));
    res.json(parsed || { collision_items: [], temporal_outlook: txt.substring(0, 800) });
  } catch (e) {
    console.error('[destiny] error:', e.message);
    res.status(500).json({ error: 'Destiny error: ' + e.message });
  }
}
