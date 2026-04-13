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

    const KEY = process.env.CLAUDE_API_KEY;
    if (!KEY) return res.status(500).json({ error: isEn ? 'CLAUDE_API_KEY not configured' : '未配置 CLAUDE_API_KEY' });

    const sexLabel = isEn ? (sex === 'M' ? 'male' : 'female') : (sex === 'M' ? '男' : '女');
    const groupLabel = isEn
      ? (age < 13 ? 'child' : age < 18 ? 'adolescent' : age < 60 ? 'adult' : 'elderly')
      : (age < 13 ? '儿童' : age < 18 ? '青少年' : age < 60 ? '成年人' : '老年人');

    const systemPrompt = isEn
      ? 'Clinical medicine expert. Depth ≠ length. Use precise clinical terminology (e.g. "hepatocellular injury" not "liver problem"). Return pure JSON, no markdown.'
      : '临床医学专家。深度≠长度。使用精准临床术语。返回纯JSON，不要markdown。';

    let prompt;
    if (anomalies && anomalies.length > 0) {
      const desc = anomalies.map(a => `${a.cn}(${a.key}): ${a.value} ${a.unit}, ref ${a.low}-${a.high}, ${a.status}`).join('\n');
      prompt = isEn
        ? `${age}y/o ${sexLabel} (${groupLabel}), abnormal biomarkers:\n${desc}\n\nReturn JSON. Use precise clinical language. Each field ≤40 words:\n{"sentinel":"ONE sentence: the most critical health contradiction right now","items":[{"metric":"code","metric_cn":"name","organ_system":"木/火/土/金/水","severity":"mild/moderate/severe/critical","clinical_fact":"precise clinical finding ≤30w","recommendation":"bullet-point action ≤20w"}],"summary":"clinical synthesis ≤60w"}`
        : `${age}岁${sexLabel}(${groupLabel})，异常指标:\n${desc}\n\n返回JSON。使用精准临床术语。每字段≤40字:\n{"sentinel":"一句话：当前最核心的健康矛盾","items":[{"metric":"代码","metric_cn":"中文名","organ_system":"木/火/土/金/水","severity":"mild/moderate/severe/critical","clinical_fact":"精准临床发现≤30字","recommendation":"要点式建议≤20字"}],"summary":"临床综合≤60字"}`;
    } else if (allMetrics && allMetrics.length > 0) {
      const desc = allMetrics.map(a => `${a.cn}(${a.key}/${a.organ}): ${a.value} ${a.unit}, ref ${a.low}-${a.high}, ${a.status}`).join('\n');
      prompt = isEn
        ? `${age}y/o ${sexLabel} (${groupLabel}), all normal:\n${desc}\n\nReturn JSON:\n{"sentinel":"ONE sentence health status","items":[{"metric":"code","metric_cn":"name","organ_system":"木/火/土/金/水","severity":"info","clinical_fact":"boundary assessment ≤30w","recommendation":"preventive action ≤20w"}],"summary":"overall assessment ≤60w"}`
        : `${age}岁${sexLabel}(${groupLabel})，全部正常:\n${desc}\n\n返回JSON:\n{"sentinel":"一句话健康状态","items":[{"metric":"代码","metric_cn":"中文名","organ_system":"木/火/土/金/水","severity":"info","clinical_fact":"边界评估≤30字","recommendation":"预防建议≤20字"}],"summary":"整体评估≤60字"}`;
    } else {
      return res.json({ items: [], summary: isEn ? 'No biomarkers entered. Please enter data in Data Center first.' : '暂无录入指标，请先在数据中心录入体检数据。' });
    }

    const resp = await fetch('https://api.gptsapi.net/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`,
        'x-api-key': KEY,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      const msg = err.startsWith('<') ? `API gateway error (${resp.status})` : err.substring(0, 200);
      return res.status(500).json({ error: `Science API error (${resp.status}): ${msg}` });
    }

    const rawText = await resp.text();
    // Guard against HTML error pages
    if (rawText.startsWith('<') || rawText.startsWith('<!')) {
      return res.status(502).json({ error: 'Science API returned invalid response. Please retry.' });
    }

    let data;
    try { data = JSON.parse(rawText); } catch {
      return res.status(502).json({ error: 'Science API response parse error. Please retry.' });
    }

    const txt = (data.content || []).map(c => c.text || '').join('');
    const parsed = parseJson(txt);
    res.json(parsed || { items: [], summary: txt.substring(0, 500) });
  } catch (e) {
    res.status(500).json({ error: 'Science analysis error: ' + e.message });
  }
}
