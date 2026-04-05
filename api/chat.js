export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

function parseText(txt) {
  if (!txt) return '';
  return txt.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { brain, question, context } = req.body;
    if (!question) return res.status(400).json({ error: '请输入问题' });

    // context contains: age, sex, anomalies summary, bazi info, previous analysis
    const ctxStr = context || '';

    if (brain === 'destiny') {
      // DeepSeek for destiny brain chat
      const KEY = process.env.DEEPSEEK_API_KEY;
      if (!KEY) return res.status(500).json({ error: '未配置 DEEPSEEK_API_KEY' });

      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
        body: JSON.stringify({
          model: 'deepseek-chat', max_tokens: 2000, temperature: 0.4,
          messages: [
            { role: 'system', content: '你是精通八字命理与中医藏象的命理师。基于已有的命理分析结果，回答用户的追问。回答要专业、具体，结合天干地支生克制化。用自然语言回答，不需要JSON格式。' },
            { role: 'user', content: `【已有分析背景】\n${ctxStr}\n\n【用户追问】\n${question}` }
          ],
        }),
      });
      if (!resp.ok) { const e = await resp.text(); return res.status(500).json({ error: 'DeepSeek: ' + e.substring(0, 200) }); }
      const data = await resp.json();
      return res.json({ answer: parseText(data.choices?.[0]?.message?.content) });

    } else {
      // Claude for science brain chat
      const KEY = process.env.CLAUDE_API_KEY;
      if (!KEY) return res.status(500).json({ error: '未配置 CLAUDE_API_KEY' });

      const resp = await fetch('https://api.gptsapi.net/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}`, 'x-api-key': KEY },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 2000,
          system: '你是临床医学专家。基于已有的医学分析结果，回答用户的健康追问。回答要专业但通俗，体现年龄性别差异。用自然语言回答。',
          messages: [{ role: 'user', content: `【已有分析背景】\n${ctxStr}\n\n【用户追问】\n${question}` }],
        }),
      });
      if (!resp.ok) { const e = await resp.text(); return res.status(500).json({ error: 'Claude: ' + e.substring(0, 200) }); }
      const data = await resp.json();
      const txt = (data.content || []).map(c => c.text || '').join('');
      return res.json({ answer: parseText(txt) });
    }
  } catch (e) {
    res.status(500).json({ error: '对话失败: ' + e.message });
  }
}
