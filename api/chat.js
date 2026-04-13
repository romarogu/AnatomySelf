export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

function parseText(txt) {
  if (!txt) return '';
  return txt.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { brain, question, context, lang } = req.body;
    const isEn = lang === 'en';
    if (!question) return res.status(400).json({ error: isEn ? 'Please enter a question' : '请输入问题' });

    const ctxStr = context || '';
    const langNote = isEn ? ' Respond entirely in English. Use original Chinese terms in parentheses where relevant, e.g. "Wood Element (木)".' : '';

    if (brain === 'destiny') {
      const KEY = process.env.DEEPSEEK_API_KEY;
      if (!KEY) return res.status(500).json({ error: isEn ? 'DEEPSEEK_API_KEY not configured' : '未配置 DEEPSEEK_API_KEY' });

      const sysPrompt = isEn
        ? 'You are an expert in BaZi (Chinese Four Pillars of Destiny) and traditional Chinese medical organ theory. Based on existing analysis, answer the user\'s follow-up questions. Be professional and specific, referencing Heavenly Stems and Earthly Branches interactions. Respond in natural language, no JSON.' + langNote
        : '你是精通八字命理与中医藏象的命理师。基于已有的命理分析结果，回答用户的追问。回答要专业、具体，结合天干地支生克制化。用自然语言回答，不需要JSON格式。';

      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
        body: JSON.stringify({
          model: 'deepseek-chat', max_tokens: 2000, temperature: 0.4,
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: `【Analysis Context】\n${ctxStr}\n\n【User Question】\n${question}` }
          ],
        }),
      });
      if (!resp.ok) { const e = await resp.text(); return res.status(500).json({ error: 'DeepSeek: ' + e.substring(0, 200) }); }
      const data = await resp.json();
      return res.json({ answer: parseText(data.choices?.[0]?.message?.content) });

    } else {
      const KEY = process.env.CLAUDE_API_KEY;
      if (!KEY) return res.status(500).json({ error: isEn ? 'CLAUDE_API_KEY not configured' : '未配置 CLAUDE_API_KEY' });

      const sysPrompt = isEn
        ? 'You are a clinical medicine expert. Based on existing medical analysis, answer the user\'s health follow-up questions. Be professional yet accessible, accounting for age and sex differences. Respond in natural language.' + langNote
        : '你是临床医学专家。基于已有的医学分析结果，回答用户的健康追问。回答要专业但通俗，体现年龄性别差异。用自然语言回答。';

      const resp = await fetch('https://api.gptsapi.net/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}`, 'x-api-key': KEY },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 2000,
          system: sysPrompt,
          messages: [{ role: 'user', content: `【Analysis Context】\n${ctxStr}\n\n【User Question】\n${question}` }],
        }),
      });
      if (!resp.ok) { const e = await resp.text(); return res.status(500).json({ error: 'Claude: ' + e.substring(0, 200) }); }
      const data = await resp.json();
      const txt = (data.content || []).map(c => c.text || '').join('');
      return res.json({ answer: parseText(txt) });
    }
  } catch (e) {
    res.status(500).json({ error: (lang === 'en' ? 'Chat error: ' : '对话失败: ') + e.message });
  }
}
