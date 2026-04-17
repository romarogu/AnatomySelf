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
    const langNote = isEn
      ? ' You MUST respond ENTIRELY in English. Use Chinese terms only in parentheses, e.g. "Wood Element (木)". Never mix Chinese into main response.'
      : ' 你必须全部用中文回答。专业术语可用英文缩写标注，如"谷丙转氨酶(ALT)"。';

    if (brain === 'destiny') {
      const KEY = process.env.DEEPSEEK_API_KEY;
      if (!KEY) return res.status(500).json({ error: isEn ? 'DEEPSEEK_API_KEY not configured' : '未配置 DEEPSEEK_API_KEY' });

      const sysPrompt = isEn
        ? 'You are an expert in BaZi and traditional Chinese medical organ theory. Answer follow-up questions based on existing analysis. Be mystical yet precise. NEVER reference years before the current year shown in context. Respond in natural language.' + langNote
        : '你是精通八字命理与中医藏象的命理师。基于已有分析回答追问。语调神秘但精准。严禁提到上下文中当前年份之前的年份。用自然语言回答。';

      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
        body: JSON.stringify({
          model: 'deepseek-chat', max_tokens: 2000, temperature: 0.2,
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
      // Science brain — Zhipu first, Claude fallback
      const ZHIPU_KEY = process.env.ZHIPU_API_KEY;
      const CLAUDE_KEY = process.env.CLAUDE_API_KEY;

      const sysPrompt = isEn
        ? 'You are a clinical medicine expert. Based on existing medical analysis, answer the user\'s health follow-up questions. Be professional yet accessible. Respond in natural language.' + langNote
        : '你是临床医学专家。基于已有的医学分析结果，回答用户的健康追问。回答要专业但通俗。用自然语言回答。';
      const userContent = `【Analysis Context】\n${ctxStr}\n\n【User Question】\n${question}`;

      let resp, usedZhipu = false;
      if (ZHIPU_KEY) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_KEY}` },
            body: JSON.stringify({
              model: 'glm-4-plus', max_tokens: 2000, temperature: 0.2,
              messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userContent }],
            }),
          });
          clearTimeout(timeout);
          if (resp.ok) usedZhipu = true;
        } catch { resp = null; }
      }
      if (!resp || !resp.ok) {
        if (!CLAUDE_KEY) return res.status(500).json({ error: 'No AI API available' });
        resp = await fetch('https://api.gptsapi.net/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CLAUDE_KEY}`, 'x-api-key': CLAUDE_KEY },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6', max_tokens: 2000, system: sysPrompt,
            messages: [{ role: 'user', content: userContent }],
          }),
        });
      }
      if (!resp.ok) { const e = await resp.text(); return res.status(500).json({ error: 'Chat API: ' + e.substring(0, 200) }); }
      const data = await resp.json();
      const txt = usedZhipu
        ? (data.choices?.[0]?.message?.content || '')
        : (data.content || []).map(c => c.text || '').join('');
      return res.json({ answer: parseText(txt) });
    }
  } catch (e) {
    res.status(500).json({ error: (lang === 'en' ? 'Chat error: ' : '对话失败: ') + e.message });
  }
}
