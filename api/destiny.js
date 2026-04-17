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

async function callZhipu(key, model, messages, opts = {}) {
  const timeout = opts.timeout || 30000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const body = { model, messages, max_tokens: opts.maxTokens || 4000, temperature: opts.temperature ?? 0.3 };
    if (opts.thinking) body.thinking = { type: 'enabled' };
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    clearTimeout(t);
    if (!resp.ok) { console.log(`[destiny] ${model} status:`, resp.status); return null; }
    const data = await resp.json();
    const choice = data.choices?.[0]?.message || {};
    return { content: choice.content || '', thinking: choice.reasoning_content || '' };
  } catch (e) { clearTimeout(t); console.log(`[destiny] ${model} error:`, e.message); return null; }
}

const SYSTEM_EN = `### Role: AnatomySelf Digital Alchemist
You master traditional Zi-Ping BaZi and modern functional medicine. Perform an energy audit.

Write a DETAILED analysis covering ALL these sections (3-5 sentences each):

1. FOUR PILLARS & PATTERN: Describe pillars, Day Master strength, useful/harmful gods
2. WOOD/LIVER (木): Percentage, why, organ impact, symptoms, risk window, prevention
3. FIRE/HEART (火): Same depth
4. EARTH/SPLEEN (土): Same depth
5. METAL/LUNG (金): Same depth  
6. WATER/KIDNEY (水): Same depth
7. TEMPORAL OUTLOOK: 4-5 sentences + 3 key dates for the year

Tone: Mystical oracle, data-backed. English only. Chinese for BaZi terms in parentheses.`;

const SYSTEM_ZH = `### 角色：AnatomySelf 数字炼金术师
你精通子平八字与功能医学。执行能量审计。

请写详细分析，覆盖以下所有章节（每章3-5句话）：

1. 四柱与格局：描述四柱、日主强弱、用神忌神
2. 木·肝胆系统：占比、原因、脏腑影响、症状、风险窗口、预防
3. 火·心血管系统：同等深度
4. 土·脾胃代谢：同等深度
5. 金·呼吸系统：同等深度
6. 水·肾脏内分泌：同等深度
7. 时间展望：4-5句话+今年3个关键日期

语调：神秘神谕，数据驱动。全部中文。`;

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
    const chartStr = `BaZi: ${baziStr} | ${Y}/${M}\nChart: ${JSON.stringify(chartData)}${astro?'\nNote: '+astro:''}${health?'\nHealth: '+health:''}`;

    // ═══ STEP 1: GLM-5 Deep Thinking — free text analysis ═══
    console.log('[destiny] Step 1: GLM-5 deep thinking...');
    const step1 = await callZhipu(KEY, 'glm-5', [
      { role: 'system', content: isEn ? SYSTEM_EN : SYSTEM_ZH },
      { role: 'user', content: chartStr }
    ], { thinking: true, temperature: 1.0, maxTokens: 8000, timeout: 60000 });

    if (!step1?.content) {
      console.log('[destiny] Step 1 failed');
      return res.status(500).json({ error: 'Meta Brain analysis failed' });
    }
    console.log('[destiny] Step 1 OK. Content:', step1.content.length, 'Thinking:', step1.thinking.length);

    // ═══ STEP 2: GLM-4-Plus — convert text to JSON (structured, fast, reliable) ═══
    const convertPrompt = isEn
      ? `Convert this BaZi analysis into JSON. COPY the analysis text faithfully into each field — do NOT shorten.

Analysis to convert:
${step1.content}

Return ONLY this JSON:
{"bazi_analysis":{"pillars":"[from section 1]","pattern":"[from section 1]","health_map":"[from section 1]"},"collision_items":[{"organ_wuxing":"木","current_forces":"[FULL text from section 2]","risk_window":"${Y}/M-M","prevention":"[from section 2]"},{"organ_wuxing":"火","current_forces":"[FULL text from section 3]","risk_window":"","prevention":"[from section 3]"},{"organ_wuxing":"土","current_forces":"[FULL text from section 4]","risk_window":"","prevention":"[from section 4]"},{"organ_wuxing":"金","current_forces":"[FULL text from section 5]","risk_window":"","prevention":"[from section 5]"},{"organ_wuxing":"水","current_forces":"[FULL text from section 6]","risk_window":"","prevention":"[from section 6]"}],"temporal_outlook":"[FULL text from section 7]","key_dates":["${Y}/M: reason","${Y}/M: reason","${Y}/M: reason"]}`
      : `将这份八字分析转换为JSON。将分析文本忠实复制到每个字段——不要缩短。

待转换的分析：
${step1.content}

只返回以下JSON：
{"bazi_analysis":{"pillars":"[来自章节1]","pattern":"[来自章节1]","health_map":"[来自章节1]"},"collision_items":[{"organ_wuxing":"木","current_forces":"[章节2完整文本]","risk_window":"${Y}年X-X月","prevention":"[来自章节2]"},{"organ_wuxing":"火","current_forces":"[章节3完整文本]","risk_window":"","prevention":"[来自章节3]"},{"organ_wuxing":"土","current_forces":"[章节4完整文本]","risk_window":"","prevention":"[来自章节4]"},{"organ_wuxing":"金","current_forces":"[章节5完整文本]","risk_window":"","prevention":"[来自章节5]"},{"organ_wuxing":"水","current_forces":"[章节6完整文本]","risk_window":"","prevention":"[来自章节6]"}],"temporal_outlook":"[章节7完整文本]","key_dates":["${Y}年X月：原因","${Y}年X月：原因","${Y}年X月：原因"]}`;

    console.log('[destiny] Step 2: GLM-4-Plus JSON conversion...');
    const step2 = await callZhipu(KEY, 'glm-4-plus', [
      { role: 'system', content: isEn ? 'You convert text to JSON. Copy faithfully. Return ONLY valid JSON, no markdown.' : '你负责将文本转换为JSON。忠实复制。只返回有效JSON，不要markdown。' },
      { role: 'user', content: convertPrompt }
    ], { temperature: 0.1, maxTokens: 8000, timeout: 30000 });

    if (!step2?.content) {
      console.log('[destiny] Step 2 failed, returning raw analysis');
      return res.json({ collision_items: [], temporal_outlook: step1.content.substring(0, 1500), bazi_analysis: null, _thinking: step1.thinking.substring(0, 2000) });
    }

    const parsed = parseJson(step2.content);
    if (parsed) {
      parsed._thinking = step1.thinking.substring(0, 2000);
      console.log('[destiny] Success! Items:', parsed.collision_items?.length, 'forces:', parsed.collision_items?.map(i=>(i.current_forces||'').length));
      return res.json(parsed);
    }

    console.log('[destiny] JSON parse failed. Returning raw.');
    res.json({ collision_items: [], temporal_outlook: step1.content.substring(0, 1500), bazi_analysis: null, _thinking: step1.thinking.substring(0, 2000) });
  } catch (e) {
    console.error('[destiny] error:', e.message);
    res.status(500).json({ error: 'Destiny error: ' + e.message });
  }
}
