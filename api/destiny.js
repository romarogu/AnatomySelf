function parseJson(txt) {
  if (!txt) return null;
  let s = txt.trim().replace(/^```+\s*(?:json)?\s*\n?/i, '').replace(/\n?\s*```+\s*$/g, '').trim();
  const i = s.indexOf('{'); if (i < 0) return null; s = s.substring(i);
  let d = 0, e = -1;
  for (let j = 0; j < s.length; j++) { if (s[j] === '{') d++; if (s[j] === '}') { d--; if (d === 0) { e = j; break; } } }
  if (e > 0) s = s.substring(0, e + 1);
  try { return JSON.parse(s); } catch { try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch { return null; } }
}

const SYSTEM = `你是一位精通八字命理学的顶级命理师，同时深谙中医藏象学说。分析必须包含：
1. 天干生克反应：十天干之间的生克关系
2. 地支刑冲破害合会反应（六合、三合、三会、六冲、三刑、六害、破）
3. 格局判定（正官格/七杀格/食神格/伤官格/正财格/偏财格/正印格/偏印格等）
4. 调候用神：根据日主出生月份判断寒暖燥湿
5. 通关用神：两行相战时的通关五行
6. 十二长生：长生、沐浴、冠带、临官、帝旺、衰、病、死、墓、绝、胎、养
7. 旺相休囚死：根据月令判断各五行旺衰
8. 神煞：天乙贵人、文昌、驿马、桃花、华盖、天德月德、羊刃、亡神、劫煞等
9. 健康对撞：命理分析与五脏六腑中医对应关系结合

直接返回纯JSON，不要markdown代码块。`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { baziStr, dayMaster, dayMasterElement, dayun, liunian, wuxing, findings } = req.body;

    const KEY = process.env.DEEPSEEK_API_KEY;
    if (!KEY) return res.status(500).json({ error: '未配置 DEEPSEEK_API_KEY' });

    const prompt = `【八字】${baziStr}\n日主: ${dayMaster}(${dayMasterElement})\n大运: ${dayun.lbl}(${dayun.el}) 流年: ${liunian.lbl}(${liunian.el})\n五行: 木${wuxing['木']}% 火${wuxing['火']}% 土${wuxing['土']}% 金${wuxing['金']}% 水${wuxing['水']}%\n\n【健康异常】\n${findings}\n\n进行完整命理分析并与健康异常对撞。\n\n返回纯JSON:\n{"bazi_analysis":{"tiangang_relations":"天干生克","dizhi_relations":"地支刑冲破害合会","pattern":"格局","tiaohou":"调候","tongguan":"通关","twelve_stages":"十二长生","wangxiang":"旺相休囚死","shenshas":"神煞"},"collision_items":[{"metric":"代码","organ_wuxing":"五行","current_forces":"作用力分析","evolution_path":"演化趋势","risk_window":"风险窗口","prevention":"养生建议"}],"temporal_outlook":"未来6月展望","key_dates":["关键日期"]}`;

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 4000,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: 'DeepSeek Destiny 失败(' + resp.status + '): ' + err.substring(0, 300) });
    }

    const data = await resp.json();
    const txt = data.choices?.[0]?.message?.content || '';
    const parsed = parseJson(txt);
    res.json(parsed || { collision_items: [], temporal_outlook: txt.substring(0, 600) });
  } catch (e) {
    res.status(500).json({ error: '命理分析失败: ' + e.message });
  }
}
