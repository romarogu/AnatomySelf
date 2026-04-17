function parseJson(txt) {
  if (!txt) return null;
  let s = txt.trim().replace(/^```+\s*(?:json)?\s*\n?/i, '').replace(/\n?\s*```+\s*$/g, '').trim();
  const i = s.indexOf('{'); if (i < 0) return null; s = s.substring(i);
  let d = 0, e = -1;
  for (let j = 0; j < s.length; j++) { if (s[j] === '{') d++; if (s[j] === '}') { d--; if (d === 0) { e = j; break; } } }
  if (e > 0) s = s.substring(0, e + 1);
  try { return JSON.parse(s); } catch { try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch { return null; } }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { age, sex, anomalies, allMetrics, lang } = req.body;
    const isEn = lang === 'en';

    // Try Zhipu first, fall back to Claude proxy
    const ZHIPU_KEY = process.env.ZHIPU_API_KEY;
    const CLAUDE_KEY = process.env.CLAUDE_API_KEY;
    
    const useZhipu = !!ZHIPU_KEY;
    const KEY = ZHIPU_KEY || CLAUDE_KEY;
    if (!KEY) return res.status(500).json({ error: 'No AI API key configured' });

    const sexLabel = isEn ? (sex === 'M' ? 'male' : 'female') : (sex === 'M' ? '男' : '女');
    const groupLabel = isEn
      ? (age < 13 ? 'child' : age < 18 ? 'adolescent' : age < 60 ? 'adult' : 'elderly')
      : (age < 13 ? '儿童' : age < 18 ? '青少年' : age < 60 ? '成年人' : '老年人');

    const systemPrompt = isEn
      ? 'Clinical medicine expert. Depth ≠ length. Use precise clinical terminology. Return pure JSON only, no markdown.'
      : '临床医学专家。深度≠长度。使用精准临床术语。返回纯JSON，不要markdown。';

    let prompt;
    if (anomalies && anomalies.length > 0) {
      const desc = anomalies.map(a => `${a.cn}(${a.key}): ${a.value} ${a.unit}, ref ${a.low}-${a.high}, ${a.status}`).join('\n');
      prompt = isEn
        ? `${age}y/o ${sexLabel} (${groupLabel}), abnormal biomarkers:\n${desc}\n\nReturn JSON:\n{"sentinel":"ONE sentence: most critical health finding","items":[{"metric":"code","metric_cn":"name","organ_system":"木/火/土/金/水","severity":"mild/moderate/severe/critical","clinical_fact":"precise finding ≤30w","recommendation":"action ≤20w"}],"summary":"synthesis ≤60w"}`
        : `${age}岁${sexLabel}(${groupLabel})，异常指标:\n${desc}\n\n返回JSON:\n{"sentinel":"一句话核心发现","items":[{"metric":"代码","metric_cn":"中文名","organ_system":"木/火/土/金/水","severity":"mild/moderate/severe/critical","clinical_fact":"临床发现≤30字","recommendation":"建议≤20字"}],"summary":"综合≤60字"}`;
    } else if (allMetrics && allMetrics.length > 0) {
      const desc = allMetrics.map(a => `${a.cn}(${a.key}/${a.organ}): ${a.value} ${a.unit}, ref ${a.low}-${a.high}, ${a.status}`).join('\n');
      prompt = isEn
        ? `${age}y/o ${sexLabel} (${groupLabel}), all normal:\n${desc}\n\nReturn JSON:\n{"sentinel":"ONE sentence health status","items":[{"metric":"code","metric_cn":"name","organ_system":"木/火/土/金/水","severity":"info","clinical_fact":"boundary assessment ≤30w","recommendation":"preventive action ≤20w"}],"summary":"overall ≤60w"}`
        : `${age}岁${sexLabel}(${groupLabel})，全部正常:\n${desc}\n\n返回JSON:\n{"sentinel":"一句话健康状态","items":[{"metric":"代码","metric_cn":"中文名","organ_system":"木/火/土/金/水","severity":"info","clinical_fact":"边界评估≤30字","recommendation":"预防建议≤20字"}],"summary":"整体评估≤60字"}`;
    } else {
      return res.json({ items: [], summary: isEn ? 'No biomarkers entered.' : '暂无录入指标，请先在数据中心录入体检数据。' });
    }

    let resp;
    if (useZhipu) {
      // Zhipu API (OpenAI compatible)
      resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
        body: JSON.stringify({
          model: 'glm-4-plus', max_tokens: 2000, temperature: 0.3,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
        }),
      });
    } else {
      // Claude proxy (Anthropic format)
      resp = await fetch('https://api.gptsapi.net/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}`, 'x-api-key': KEY },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 2000, system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    }

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: `Science API error (${resp.status}): ${err.substring(0, 200)}` });
    }

    const data = await resp.json();
    // Parse response based on API format
    const txt = useZhipu
      ? (data.choices?.[0]?.message?.content || '')
      : (data.content || []).map(c => c.text || '').join('');
    const parsed = parseJson(txt);
    res.json(parsed || { items: [], summary: txt.substring(0, 500) });
  } catch (e) {
    res.status(500).json({ error: 'Science error: ' + e.message });
  }
}
