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
      ? 'You are a clinical medicine expert. Return pure JSON only, no markdown. Keep each analysis under 60 words. Respond entirely in English.'
      : '临床医学专家。返回纯JSON，不要markdown。每项分析控制在50字以内。';

    let prompt;
    if (anomalies && anomalies.length > 0) {
      const desc = anomalies.map(a => `${a.cn}(${a.key}): ${a.value} ${a.unit}, ref ${a.low}-${a.high}, ${a.status}`).join('\n');
      prompt = isEn
        ? `${age}y/o ${sexLabel} (${groupLabel}), abnormal biomarkers:\n${desc}\n\nReturn JSON:{"items":[{"metric":"code","metric_cn":"name","organ_system":"element(木/火/土/金/水)","severity":"mild/moderate/severe","anatomical_context":"anatomical location","physiological_analysis":"pathological analysis","demographic_specific":"age/sex specific note","recommendation":"recommendation"}],"summary":"summary"}`
        : `${age}岁${sexLabel}(${groupLabel})，异常指标:\n${desc}\n\n返回JSON:{"items":[{"metric":"代码","metric_cn":"中文名","organ_system":"五行(木/火/土/金/水)","severity":"mild/moderate/severe","anatomical_context":"解剖定位","physiological_analysis":"病理分析","demographic_specific":"年龄性别特殊说明","recommendation":"建议"}],"summary":"总结"}`;
    } else if (allMetrics && allMetrics.length > 0) {
      const desc = allMetrics.map(a => `${a.cn}(${a.key}/${a.organ}): ${a.value} ${a.unit}, ref ${a.low}-${a.high}, ${a.status}`).join('\n');
      prompt = isEn
        ? `${age}y/o ${sexLabel} (${groupLabel}), all biomarkers normal:\n${desc}\n\nProvide health confirmation analysis: 1) which markers are near boundary values; 2) key health focus areas for this age; 3) preventive recommendations.\n\nReturn JSON:{"items":[{"metric":"code","metric_cn":"name","organ_system":"element(木/火/土/金/水)","severity":"info","anatomical_context":"anatomical location","physiological_analysis":"health assessment","demographic_specific":"age/sex note","recommendation":"preventive advice"}],"summary":"overall health assessment"}`
        : `${age}岁${sexLabel}(${groupLabel})，体检指标全部正常:\n${desc}\n\n请做健康确认分析，指出：1) 哪些指标虽在正常范围但接近边界值需留意；2) 该年龄段需要重点关注的健康方向；3) 预防性建议。\n\n返回JSON:{"items":[{"metric":"代码","metric_cn":"中文名","organ_system":"五行(木/火/土/金/水)","severity":"info","anatomical_context":"解剖定位","physiological_analysis":"健康评估","demographic_specific":"年龄性别特殊说明","recommendation":"预防建议"}],"summary":"整体健康评估总结"}`;
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
