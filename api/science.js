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

    const resp = await fetch('https://api.gptsapi.net/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          { role: 'system', content: '你是一位资深临床医学专家，精通人体解剖学和生理学。你的分析必须体现患者年龄和性别的人口统计学差异。直接返回纯JSON，不要markdown代码块。' },
          { role: 'user', content: `【患者】${age}岁 ${sexCn}性（${group}）\n\n【异常指标】\n${desc}\n\n针对每个异常给出解剖学/生理学解读，必须体现人口统计学差异。\n\n返回纯JSON：\n{"items":[{"metric":"指标代码","metric_cn":"中文名","organ_system":"对应五行（木火土金水）","severity":"mild/moderate/severe","anatomical_context":"解剖学位置和功能","physiological_analysis":"病理生理学机制分析","demographic_specific":"针对${age}岁${sexCn}性的特殊说明","recommendation":"具体建议"}],"summary":"整体健康风险评估总结"}` }
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: 'Claude Science 失败(' + resp.status + '): ' + err.substring(0, 300) });
    }

    const data = await resp.json();
    const txt = data.choices?.[0]?.message?.content || '';
    const parsed = parseJson(txt);
    res.json(parsed || { items: [], summary: txt.substring(0, 500) });
  } catch (e) {
    res.status(500).json({ error: '科学分析失败: ' + e.message });
  }
}
