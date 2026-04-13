export const config = { api: { bodyParser: false } };

function parseJson(txt) {
  if (!txt) return null;
  let s = txt.trim().replace(/^```+\s*(?:json)?\s*\n?/i, '').replace(/\n?\s*```+\s*$/g, '').trim();
  const i = s.indexOf('{'); if (i < 0) return null; s = s.substring(i);
  let d = 0, e = -1;
  for (let j = 0; j < s.length; j++) { if (s[j] === '{') d++; if (s[j] === '}') { d--; if (d === 0) { e = j; break; } } }
  if (e > 0) s = s.substring(0, e + 1);
  try { return JSON.parse(s); } catch { try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch { return null; } }
}

async function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
  });
}

const SYSTEM_ZH = `八字命理师+中医藏象专家。分析框架：
1.四柱拆解 2.天干生克+地支刑冲合会 3.格局(用神忌神) 4.调候通关 5.十二长生+旺相休囚死 6.神煞 7.健康对撞(木=肝胆,火=心小肠,土=脾胃,金=肺大肠,水=肾膀胱)
返回纯JSON，每字段≤80字。`;

const SYSTEM_EN = `You are an expert in BaZi (Chinese Four Pillars) and traditional organ theory. Analysis framework:
1.Four Pillars 2.Heavenly Stems interactions + Earthly Branches clashes/combinations 3.Pattern(useful/harmful gods) 4.Seasonal balance 5.Twelve Stages 6.Spirit Stars 7.Health collision(Wood=Liver,Fire=Heart,Earth=Spleen,Metal=Lung,Water=Kidney)
Return pure JSON. Each field ≤80 words. Use Chinese terms in parentheses naturally. organ_wuxing must be single Chinese character: 木/火/土/金/水.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const body = await readBody(req);
    const { baziStr, dayMaster, dayMasterElement, dayun, liunian, wuxing, findings, lang } = body;
    const isEn = lang === 'en';

    const KEY = process.env.DEEPSEEK_API_KEY;
    if (!KEY) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

    const Y = new Date().getFullYear();
    const M = new Date().getMonth() + 1;

    const prompt = isEn
      ? `${baziStr} | Day Master:${dayMaster}(${dayMasterElement}) | Major Cycle:${dayun.lbl}(${dayun.el}) Annual:${liunian.lbl}(${liunian.el})
Wood${wuxing['木']}% Fire${wuxing['火']}% Earth${wuxing['土']}% Metal${wuxing['金']}% Water${wuxing['水']}%
${findings || 'All biomarkers normal'}
Predict ${Y}/${M} to ${Y+1}. Return JSON. ALL text fields MUST be in English:
{"bazi_analysis":{"pillars_detail":"","tiangang_relations":"","dizhi_relations":"","pattern":"","tiaohou":"","tongguan":"","twelve_stages":"","wangxiang":"","shenshas":""},"collision_items":[{"organ_wuxing":"木or火or土or金or水","current_forces":"","evolution_path":"","risk_window":"","prevention":""}],"life_tuning":{"medical_advice":["","",""],"destiny_advice":["","",""]},"temporal_outlook":"","key_dates":[""]}`
      : `${baziStr} | 日主:${dayMaster}(${dayMasterElement}) | 大运${dayun.lbl}(${dayun.el}) 流年${liunian.lbl}(${liunian.el})
木${wuxing['木']}% 火${wuxing['火']}% 土${wuxing['土']}% 金${wuxing['金']}% 水${wuxing['水']}%
${findings || '无明显异常'}
预测${Y}年${M}月至${Y+1}年。返回JSON:
{"bazi_analysis":{"pillars_detail":"","tiangang_relations":"","dizhi_relations":"","pattern":"","tiaohou":"","tongguan":"","twelve_stages":"","wangxiang":"","shenshas":""},"collision_items":[{"organ_wuxing":"木or火or土or金or水","current_forces":"","evolution_path":"","risk_window":"","prevention":""}],"life_tuning":{"medical_advice":["","",""],"destiny_advice":["","",""]},"temporal_outlook":"","key_dates":[""]}`;
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 3000,
        temperature: 0.3,
        messages: [
          { role: 'system', content: isEn ? SYSTEM_EN : SYSTEM_ZH },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: 'DeepSeek error(' + resp.status + '): ' + err.substring(0, 300) });
    }

    const data = await resp.json();
    const txt = data.choices?.[0]?.message?.content || '';
    const parsed = parseJson(txt);
    res.json(parsed || { collision_items: [], temporal_outlook: txt.substring(0, 800) });
  } catch (e) {
    res.status(500).json({ error: 'Destiny analysis error: ' + e.message });
  }
}
