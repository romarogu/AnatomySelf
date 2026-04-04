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

    const KEY = process.env.DEEPSEEK_API_KEY;
    if (!KEY) return res.status(500).json({ error: '服务器未配置 DEEPSEEK_API_KEY' });

    // DeepSeek supports image via OpenAI-compatible vision format
    const isImage = mediaType && mediaType.startsWith('image/');
    const userContent = [];

    if (isImage) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${mediaType};base64,${base64}` }
      });
    }
    // For PDF or as fallback: send as text description asking to parse
    // DeepSeek chat doesn't natively support PDF, so we note this
    if (!isImage) {
      userContent.push({
        type: 'text',
        text: '用户上传了一份PDF体检报告（已转为base64），请尽力从中提取医学检验指标。如果无法直接读取PDF，请返回空的metrics数组并在raw_summary中说明。'
      });
    }

    userContent.push({
      type: 'text',
      text: '提取体检报告中的所有医学检验指标。直接返回纯JSON（不要markdown代码块）:\n{"metrics":[{"name":"中文名","code":"英文缩写如ALT/FBG/RHR/FVC/Cr/BP/TC","value":数值,"unit":"单位"}],"report_date":"报告日期","institution":"检测机构"}'
    });

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是专业的体检报告OCR解析器。直接返回纯JSON，不要使用markdown代码块。' },
          { role: 'user', content: userContent }
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: 'DeepSeek API: ' + err.substring(0, 300) });
    }

    const data = await resp.json();
    const txt = data.choices?.[0]?.message?.content || '';
    const parsed = parseJson(txt);
    res.json(parsed || { metrics: [], raw_summary: txt.substring(0, 500) });
  } catch (e) {
    res.status(500).json({ error: 'OCR 失败: ' + e.message });
  }
}
