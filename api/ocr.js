export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

function parseJson(txt) {
  if (!txt) return null;
  let s = txt.trim().replace(/^```+\s*(?:json)?\s*\n?/i, '').replace(/\n?\s*```+\s*$/g, '').trim();
  const i = s.indexOf('{'); if (i < 0) return null; s = s.substring(i);
  let d = 0, e = -1;
  for (let j = 0; j < s.length; j++) { if (s[j]==='{') d++; if (s[j]==='}') { d--; if (d===0) { e=j; break; } } }
  if (e > 0) s = s.substring(0, e+1);
  try { return JSON.parse(s); } catch { try { return JSON.parse(s.replace(/,\s*([}\]])/g,'$1')); } catch { return null; } }
}

const PROMPT = '请仔细识别这份体检报告中的所有医学检验指标。直接返回纯JSON（不要markdown标记）：{"metrics":[{"name":"中文名","code":"英文缩写如ALT/FBG/RHR/FVC/Cr/BP/TC","value":数值,"unit":"单位"}],"report_date":"报告日期","institution":"检测机构"}';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { base64, mediaType } = req.body;
    if (!base64) return res.status(400).json({ error: '缺少文件数据' });

    let txt = null;

    // 1) Try DeepSeek (supports image via OpenAI vision format)
    const DSK = process.env.DEEPSEEK_API_KEY;
    if (DSK && mediaType && mediaType.startsWith('image/')) {
      try {
        const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DSK },
          body: JSON.stringify({ model: 'deepseek-chat', max_tokens: 4000, temperature: 0.1,
            messages: [{ role: 'user', content: [
              { type: 'image_url', image_url: { url: 'data:' + mediaType + ';base64,' + base64 } },
              { type: 'text', text: PROMPT }
            ]}]
          })
        });
        if (r.ok) { const d = await r.json(); txt = d.choices?.[0]?.message?.content || null; }
      } catch (e) { console.warn('DeepSeek OCR err:', e.message); }
    }

    // 2) Fallback: Claude (supports PDF + images)
    if (!txt) {
      const AK = process.env.ANTHROPIC_API_KEY;
      if (AK) {
        const isPdf = mediaType === 'application/pdf';
        const doc = isPdf
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
          : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
        try {
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': AK, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000,
              system: '你是体检报告OCR解析器。直接返回纯JSON。',
              messages: [{ role: 'user', content: [doc, { type: 'text', text: PROMPT }] }] })
          });
          if (r.ok) { const d = await r.json(); txt = (d.content||[]).map(c=>c.text||'').join(''); }
        } catch (e) { console.warn('Claude OCR err:', e.message); }
      }
    }

    if (!txt) return res.status(500).json({ error: '需要配置 DEEPSEEK_API_KEY 或 ANTHROPIC_API_KEY' });
    res.json(parseJson(txt) || { metrics: [], raw_summary: txt.substring(0, 500) });
  } catch (e) { res.status(500).json({ error: 'OCR失败: ' + e.message }); }
}
