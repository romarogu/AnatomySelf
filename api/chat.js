export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { brain, question, context, lang } = req.body;
    const isEn = lang === 'en';
    if (!question) return res.status(400).json({ error: isEn ? 'Please enter a question' : '请输入问题' });

    const ctxStr = context || '';
    const Y = new Date().getFullYear();

    if (brain === 'destiny') {
      // ── Meta Brain: Oracle → Coach in chat ──
      const KEY = process.env.DEEPSEEK_API_KEY;
      if (!KEY) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

      const sysPrompt = isEn
        ? `You are the Meta Brain of AnatomySelf — a wise life coach grounded in Chinese metaphysics (BaZi, Five Elements, organ theory).

STYLE: Coach — warm, empathetic, but grounded in the chart data. Use "you" naturally. Give actionable advice.
STRUCTURE: Open with a direct answer (1-2 sentences), then explain the reasoning from the chart (2-3 sentences), then give concrete advice (1-2 sentences).
LANGUAGE: Respond ENTIRELY in English. Use Chinese terms only in parentheses, e.g. "Wood Element (木)".
DATE: Never mention any year before ${Y}.
Keep responses 150-250 words.`
        : `你是AnatomySelf的命理脑——一位融合中国玄学（八字、五行、藏象）的智慧生命教练。

风格：教练感——温暖、共情，但基于命盘数据说话。自然地用"你"。给可执行的建议。
结构：先直接回答（1-2句），再解释命盘推导（2-3句），最后给具体建议（1-2句）。
语言：全部用中文。
日期：严禁提到${Y}年之前的年份。
控制在150-250字。`;

      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
        body: JSON.stringify({
          model: 'deepseek-chat', max_tokens: 2000, temperature: 0.35,
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: `【${isEn ? 'Analysis Context' : '分析上下文'}】\n${ctxStr}\n\n【${isEn ? 'User Question' : '用户提问'}】\n${question}` }
          ],
        }),
      });
      if (!resp.ok) { const e = await resp.text(); return res.status(500).json({ error: 'DeepSeek: ' + e.substring(0, 200) }); }
      const data = await resp.json();
      return res.json({ answer: (data.choices?.[0]?.message?.content || '').trim() });

    } else {
      // ── Science Brain: Professional coach ──
      const ZHIPU_KEY = process.env.ZHIPU_API_KEY;
      const CLAUDE_KEY = process.env.CLAUDE_API_KEY;

      const sysPrompt = isEn
        ? `You are the Science Brain of AnatomySelf — a clinical health coach who interprets biomarker data.

STYLE: Coach — professional yet warm. Explain lab results like a caring doctor would. Use "your" naturally.
STRUCTURE: Direct answer first, then clinical reasoning, then actionable lifestyle advice.
LANGUAGE: Respond ENTIRELY in English.
Keep responses 150-250 words.`
        : `你是AnatomySelf的科学脑——一位解读生物标志物数据的临床健康教练。

风格：教练感——专业但温暖。像一位关心你的医生那样解释检验结果。
结构：先直接回答，再解释临床推理，最后给可执行的生活建议。
语言：全部用中文。
控制在150-250字。`;

      const userContent = `【${isEn ? 'Analysis Context' : '分析上下文'}】\n${ctxStr}\n\n【${isEn ? 'User Question' : '用户提问'}】\n${question}`;

      let resp, usedZhipu = false;
      if (ZHIPU_KEY) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 15000);
          resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST', signal: ctrl.signal,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_KEY}` },
            body: JSON.stringify({
              model: 'glm-4-plus', max_tokens: 2000, temperature: 0.3,
              messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userContent }],
            }),
          });
          clearTimeout(t);
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
      return res.json({ answer: txt.trim() });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
