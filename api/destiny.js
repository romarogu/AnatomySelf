export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

function parseJson(txt) {
  if (!txt) return null;
  let s = txt.trim().replace(/^```+\s*(?:json)?\s*\n?/gi, '').replace(/\n?\s*```+\s*$/g, '').trim();
  const i = s.indexOf('{'); if (i < 0) return null; s = s.substring(i);
  let d = 0, e = -1;
  for (let j = 0; j < s.length; j++) { if (s[j]==='{') d++; if (s[j]==='}') { d--; if (d===0) { e=j; break; } } }
  if (e > 0) s = s.substring(0, e + 1);
  else {
    let ob=0, oa=0;
    for (const c of s) { if (c==='{') ob++; if (c==='}') ob--; if (c==='[') oa++; if (c===']') oa--; }
    s = s.replace(/,\s*$/, '');
    while (oa>0) { s+=']'; oa--; } while (ob>0) { s+='}'; ob--; }
  }
  try { return JSON.parse(s); } catch {
    try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
  }
}

async function callZhipu(key, messages, maxTokens = 4000, temp = 0.3) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 35000);
  try {
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'glm-4-plus', max_tokens: maxTokens, temperature: temp, messages }),
    });
    clearTimeout(t);
    if (!resp.ok) { console.log('[destiny] API status:', resp.status); return ''; }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (e) { clearTimeout(t); console.log('[destiny] API error:', e.message); return ''; }
}

const ANALYSIS_PROMPT_EN = `### Role: AnatomySelf Digital Alchemist
You master traditional Zi-Ping BaZi and modern functional medicine. Perform an "energy audit" of this chart.

WRITE A DETAILED FREE-TEXT ANALYSIS covering these sections. Each section must be substantial (3-5 sentences).

## 1. FOUR PILLARS & PATTERN
Describe the four pillars, Day Master strength, useful/harmful gods, and overall pattern.

## 2. WOOD / LIVER SYSTEM (木)
Current forces: what percentage, why, how it affects liver/gallbladder. Risk window and prevention.

## 3. FIRE / CARDIOVASCULAR SYSTEM (火)
Current forces: what percentage, why, how it affects heart. Risk window and prevention.

## 4. EARTH / DIGESTIVE SYSTEM (土)
Current forces: what percentage, why, how it affects spleen/stomach. Risk window and prevention.

## 5. METAL / RESPIRATORY SYSTEM (金)
Current forces: what percentage, why, how it affects lungs. Risk window and prevention.

## 6. WATER / KIDNEY SYSTEM (水)
Current forces: what percentage, why, how it affects kidneys. Risk window and prevention.

## 7. TEMPORAL OUTLOOK
Next 12 months outlook (4-5 sentences) and 3 key dates.

TONE: Mystical, precise, data-backed. Like an oracle reading ancient instruments. No empty platitudes.
LANGUAGE: English only. Use Chinese only for BaZi terms in parentheses.`;

const ANALYSIS_PROMPT_ZH = `### 角色：AnatomySelf 数字炼金术师
你精通子平八字与功能医学。执行这个命盘的"能量审计"。

请写一份详细的自由文本分析，覆盖以下章节。每个章节必须有实质内容（3-5句话）。

## 1. 四柱与格局
描述四柱、日主强弱、用神忌神、整体格局。

## 2. 木·肝胆系统
当前态势：占比多少，为什么，如何影响肝胆。风险窗口和预防行动。

## 3. 火·心血管系统
当前态势：占比多少，为什么，如何影响心脏。风险窗口和预防行动。

## 4. 土·脾胃代谢
当前态势：占比多少，为什么，如何影响脾胃。风险窗口和预防行动。

## 5. 金·呼吸系统
当前态势：占比多少，为什么，如何影响肺。风险窗口和预防行动。

## 6. 水·肾脏内分泌
当前态势：占比多少，为什么，如何影响肾脏。风险窗口和预防行动。

## 7. 时间展望
未来12个月展望（4-5句话）和3个关键日期。

语调：神秘、精准、数据驱动。如同神谕解读古代仪器。严禁空洞吉祥话。
语言：全部中文。`;

const CONVERT_PROMPT_EN = `Convert the above analysis into this exact JSON structure. Copy the analysis text faithfully into the corresponding fields — do NOT shorten or summarize. Return ONLY valid JSON:
{"bazi_analysis":{"pillars":"[copy from section 1]","pattern":"[copy from section 1]","health_map":"[copy from section 1]"},"collision_items":[{"organ_wuxing":"木","current_forces":"[copy full text from section 2 forces]","risk_window":"YYYY/M-M","prevention":"[copy prevention from section 2]"},{"organ_wuxing":"火","current_forces":"[copy from section 3]","risk_window":"","prevention":"[copy]"},{"organ_wuxing":"土","current_forces":"[copy from section 4]","risk_window":"","prevention":"[copy]"},{"organ_wuxing":"金","current_forces":"[copy from section 5]","risk_window":"","prevention":"[copy]"},{"organ_wuxing":"水","current_forces":"[copy from section 6]","risk_window":"","prevention":"[copy]"}],"temporal_outlook":"[copy full text from section 7]","key_dates":["YYYY/M: reason","YYYY/M: reason","YYYY/M: reason"]}`;

const CONVERT_PROMPT_ZH = `将上面的分析转换为以下JSON结构。忠实复制分析文本到对应字段——不要缩短或概括。只返回有效JSON：
{"bazi_analysis":{"pillars":"[复制章节1]","pattern":"[复制章节1]","health_map":"[复制章节1]"},"collision_items":[{"organ_wuxing":"木","current_forces":"[复制章节2的完整态势分析]","risk_window":"YYYY年X-X月","prevention":"[复制章节2的预防]"},{"organ_wuxing":"火","current_forces":"[复制章节3]","risk_window":"","prevention":"[复制]"},{"organ_wuxing":"土","current_forces":"[复制章节4]","risk_window":"","prevention":"[复制]"},{"organ_wuxing":"金","current_forces":"[复制章节5]","risk_window":"","prevention":"[复制]"},{"organ_wuxing":"水","current_forces":"[复制章节6]","risk_window":"","prevention":"[复制]"}],"temporal_outlook":"[复制章节7完整文本]","key_dates":["YYYY年X月：原因","YYYY年X月：原因","YYYY年X月：原因"]}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { chartData, baziStr, lang } = req.body;
    const isEn = lang === 'en';

    const KEY = process.env.ZHIPU_API_KEY;
    if (!KEY) return res.status(500).json({ error: 'ZHIPU_API_KEY not configured' });

    const Y = new Date().getFullYear();
    const M = new Date().getMonth() + 1;
    const astro = chartData?.astronomicalNote || '';
    const health = chartData?.healthFindings || '';

    const chartStr = `BaZi: ${baziStr} | ${Y}/${M}\nChart: ${JSON.stringify(chartData)}${astro ? '\nNote: '+astro : ''}${health ? '\nHealth: '+health : ''}`;

    // ═══ STEP 1: Free-text analysis (model writes naturally, no JSON constraint) ═══
    console.log('[destiny] Step 1: Free-text analysis...');
    const analysis = await callZhipu(KEY, [
      { role: 'system', content: isEn ? ANALYSIS_PROMPT_EN : ANALYSIS_PROMPT_ZH },
      { role: 'user', content: chartStr }
    ], 3000, 0.4);

    if (!analysis) return res.status(500).json({ error: 'Meta Brain analysis failed — no response from AI' });
    console.log('[destiny] Analysis length:', analysis.length);

    // ═══ STEP 2: Convert to JSON (model copies its own text into structure) ═══
    console.log('[destiny] Step 2: Converting to JSON...');
    const jsonTxt = await callZhipu(KEY, [
      { role: 'system', content: isEn ? 'Convert the analysis into JSON. Copy text faithfully. Return ONLY valid JSON.' : '将分析转换为JSON。忠实复制文本。只返回有效JSON。' },
      { role: 'user', content: analysis + '\n\n' + (isEn ? CONVERT_PROMPT_EN : CONVERT_PROMPT_ZH) }
    ], 4000, 0.1);

    if (!jsonTxt) {
      // Fallback: return raw analysis as temporal_outlook
      return res.json({ collision_items: [], temporal_outlook: analysis.substring(0, 1000), bazi_analysis: null });
    }

    const parsed = parseJson(jsonTxt);
    if (parsed) {
      console.log('[destiny] Success! Items:', parsed.collision_items?.length, 'forces:', parsed.collision_items?.map(i => (i.current_forces||'').length));
    } else {
      console.log('[destiny] JSON parse failed, returning raw analysis');
      return res.json({ collision_items: [], temporal_outlook: analysis.substring(0, 1000), bazi_analysis: null });
    }

    res.json(parsed);
  } catch (e) {
    console.error('[destiny] error:', e.message);
    res.status(500).json({ error: 'Destiny error: ' + e.message });
  }
}
