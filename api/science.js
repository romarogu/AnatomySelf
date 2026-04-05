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
    const { age, sex, anomalies } = req.body;
    if (!anomalies || !anomalies.length) return res.json({ items: [], summary: '所有指标均在正常范围内。' });

    const KEY = process.env.CLAUDE_API_KEY;
    if (!KEY) return res.status(500).json({ error: '未配置 CLAUDE_API_KEY' });

    const sexCn = sex === 'M' ? '男' : '女';
    const group = age < 13 ? '儿童' : age < 18 ? '青少年' : age < 60 ? '成年人' : '老年人';
    const desc = anomalies.map(a => `${a.cn}(${a.key}): ${a.value} ${a.unit}，参考 ${a.low}-${a.high}，${a.status}`).join('\n');

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
        system: '临床医学专家。返回纯JSON，不要markdown。每项分析控制在50字以内。',
        messages: [{
          role: 'user',
          content: `${age}岁${sexCn}(${group})，异常指标:\n${desc}\n\n返回JSON:{"items":[{"metric":"代码","metric_cn":"中文名","organ_system":"五行","severity":"mild/moderate/severe","anatomical_context":"解剖定位","physiological_analysis":"病理分析","demographic_specific":"年龄性别特殊说明","recommendation":"建议"}],"summary":"总结"}`
        }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: 'Claude Science 失败(' + resp.status + '): ' + err.substring(0, 300) });
    }

    const data = await resp.json();
    // Anthropic Messages format: content: [{type:"text", text:"..."}]
    const txt = (data.content || []).map(c => c.text || '').join('');
    const parsed = parseJson(txt);
    res.json(parsed || { items: [], summary: txt.substring(0, 500) });
  } catch (e) {
    res.status(500).json({ error: '科学分析失败: ' + e.message });
  }
}
