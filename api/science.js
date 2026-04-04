function parseJson(txt) {
  if (!txt) return null;
  let s = txt.trim().replace(/^```+\s*(?:json)?\s*\n?/i, '').replace(/\n?\s*```+\s*$/g, '').trim();
  const i = s.indexOf('{'); if (i < 0) return null; s = s.substring(i);
  let d = 0, e = -1;
  for (let j = 0; j < s.length; j++) { if (s[j]==='{') d++; if (s[j]==='}') { d--; if (d===0) { e=j; break; } } }
  if (e > 0) s = s.substring(0, e+1);
  try { return JSON.parse(s); } catch { try { return JSON.parse(s.replace(/,\s*([}\]])/g,'$1')); } catch { return null; } }
}

const SYS = '你是一位资深临床医学专家，精通人体解剖学和生理学。你的分析必须体现患者年龄和性别的人口统计学差异。直接返回纯JSON，不要markdown代码块。';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { age, sex, anomalies } = req.body;
    if (!anomalies || !anomalies.length) return res.json({ items: [], summary: '所有指标均在正常范围内。' });

    const sexCn = sex === 'M' ? '男' : '女';
    const group = age < 13 ? '儿童' : age < 18 ? '青少年' : age < 60 ? '成年人' : '老年人';
    const desc = anomalies.map(a => `${a.cn}(${a.key}): ${a.value} ${a.unit}，参考 ${a.low}-${a.high}，${a.status}`).join('\n');

    const prompt = `【患者】${age}岁 ${sexCn}性（${group}）\n\n【异常指标】\n${desc}\n\n针对每个异常给出解剖学/生理学解读。\n\n返回纯JSON：\n{"items":[{"metric":"代码","metric_cn":"中文名","organ_system":"五行","severity":"mild/moderate/severe","anatomical_context":"解剖学定位","physiological_analysis":"病理分析","demographic_specific":"${age}岁${sexCn}性特殊说明","recommendation":"建议"}],"summary":"总结"}`;

    let txt = null;

    // 1) Try DeepSeek
    const DSK = process.env.DEEPSEEK_API_KEY;
    if (DSK) {
      try {
        const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DSK },
          body: JSON.stringify({ model: 'deepseek-chat', max_tokens: 4000, temperature: 0.3,
            messages: [{ role: 'system', content: SYS }, { role: 'user', content: prompt }] })
        });
        if (r.ok) { const d = await r.json(); txt = d.choices?.[0]?.message?.content || null; }
        else { console.warn('DeepSeek science failed:', r.status); }
      } catch (e) { console.warn('DeepSeek science err:', e.message); }
    }

    // 2) Fallback: Claude
    if (!txt) {
      const AK = process.env.ANTHROPIC_API_KEY;
      if (AK) {
        try {
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': AK, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, system: SYS,
              messages: [{ role: 'user', content: prompt }] })
          });
          if (r.ok) { const d = await r.json(); txt = (d.content||[]).map(c=>c.text||'').join(''); }
        } catch (e) { console.warn('Claude science err:', e.message); }
      }
    }

    if (!txt) return res.status(500).json({ error: '需要配置 DEEPSEEK_API_KEY 或 ANTHROPIC_API_KEY' });
    res.json(parseJson(txt) || { items: [], summary: txt.substring(0, 500) });
  } catch (e) { res.status(500).json({ error: '科学分析失败: ' + e.message }); }
}
