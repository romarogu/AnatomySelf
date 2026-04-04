function parseJson(txt) {
  if (!txt) return null;
  let s = txt.trim().replace(/^```+\s*(?:json)?\s*\n?/i, '').replace(/\n?\s*```+\s*$/g, '').trim();
  const start = s.indexOf('{');
  if (start < 0) return null;
  s = s.substring(start);
  let depth = 0, end = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') depth++;
    if (s[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end > 0) s = s.substring(0, end + 1);
  try { return JSON.parse(s); } catch {
    try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { age, sex, anomalies } = req.body;
    if (!anomalies || !anomalies.length) return res.json({ items: [], summary: '所有指标均在正常范围内。' });

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) return res.status(500).json({ error: '服务器未配置 ANTHROPIC_API_KEY' });

    const desc = anomalies.map(a => `${a.cn}(${a.key}): 实测值 ${a.value} ${a.unit}，参考范围 ${a.low}-${a.high}，状态: ${a.status}`).join('\n');
    const sexCn = sex === 'M' ? '男' : '女';
    const group = age < 13 ? '儿童' : age < 18 ? '青少年' : age < 60 ? '成年人' : '老年人';

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: '你是临床医学专家。直接返回纯JSON，不要使用markdown代码块。',
        messages: [{
          role: 'user',
          content: `你是一位资深临床医学专家。\n\n【患者】${age}岁 ${sexCn}性（${group}）\n\n【异常指标】\n${desc}\n\n针对每个异常给出解剖学/生理学解读，体现人口统计学差异。\n\n返回纯JSON:\n{"items":[{"metric":"代码","metric_cn":"中文名","organ_system":"五行","severity":"mild/moderate/severe","anatomical_context":"解剖学定位","physiological_analysis":"病理分析","demographic_specific":"${age}岁${sexCn}性特殊说明","recommendation":"建议"}],"summary":"总结"}`
        }]
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: 'Claude API: ' + err.substring(0, 200) });
    }

    const data = await resp.json();
    const txt = (data.content || []).map(c => c.text || '').join('');
    const parsed = parseJson(txt);
    res.json(parsed || { items: [], summary: txt.substring(0, 500) });
  } catch (e) {
    res.status(500).json({ error: '科学分析失败: ' + e.message });
  }
}
