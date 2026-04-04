export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

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
    const { base64, mediaType } = req.body;
    if (!base64) return res.status(400).json({ error: '缺少文件数据' });

    const KEY = process.env.CLAUDE_API_KEY;
    if (!KEY) return res.json({ metrics: [], ocr_unavailable: true, message: '未配置 CLAUDE_API_KEY，请手动输入体检数值。' });

    const imageUrl = `data:${mediaType};base64,${base64}`;

    const resp = await fetch('https://api.gptsapi.net/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: 'claude-opus-4-20250514',
        max_tokens: 4000,
        messages: [
          { role: 'system', content: '你是专业的体检报告OCR解析器。直接返回纯JSON，不要使用markdown代码块。' },
          { role: 'user', content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: '请仔细识别这份体检报告中的所有医学检验指标。直接返回纯JSON：{"metrics":[{"name":"中文名","code":"英文缩写如ALT/AST/FBG/RHR/FVC/Cr/BP/TC/TG/HDL/LDL/WBC/RBC/HGB/PLT/UA/BUN/GGT","value":数值,"unit":"单位"}],"report_date":"报告日期","institution":"检测机构"}' }
          ]}
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: 'Claude OCR 失败(' + resp.status + '): ' + err.substring(0, 300) });
    }

    const data = await resp.json();
    const txt = data.choices?.[0]?.message?.content || '';
    const parsed = parseJson(txt);
    res.json(parsed || { metrics: [], raw_summary: txt.substring(0, 500) });
  } catch (e) {
    res.status(500).json({ error: 'OCR 失败: ' + e.message });
  }
}
