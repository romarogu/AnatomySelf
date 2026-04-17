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

    const messages = [
      { role: 'system', content: isEn ? SYSTEM_EN : SYSTEM_ZH },
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
