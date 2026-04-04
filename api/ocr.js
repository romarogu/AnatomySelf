export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

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
    const { base64, mediaType } = req.body;
    if (!base64) return res.status(400).json({ error: '缺少文件数据' });

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) return res.status(500).json({ error: '服务器未配置 ANTHROPIC_API_KEY' });

    const isPdf = mediaType === 'application/pdf';
    const doc = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };

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
        system: '你是专业的体检报告OCR解析器。直接返回纯JSON，不要使用markdown代码块。',
        messages: [{
          role: 'user',
          content: [doc, {
            type: 'text',
            text: '提取体检报告中的所有医学检验指标。返回纯JSON:{"metrics":[{"name":"中文名","code":"英文缩写如ALT/FBG/RHR/FVC/Cr/BP/TC","value":数值,"unit":"单位"}],"report_date":"报告日期","institution":"检测机构"}'
          }]
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
    res.json(parsed || { metrics: [], raw_summary: txt.substring(0, 500) });
  } catch (e) {
    res.status(500).json({ error: 'OCR 失败: ' + e.message });
  }
}
