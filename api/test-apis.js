export default async function handler(req, res) {
  const results = {};
  
  // Test 1: Zhipu China endpoint
  const ZHIPU_KEY = process.env.ZHIPU_API_KEY;
  if (ZHIPU_KEY) {
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_KEY}` },
        body: JSON.stringify({
          model: 'glm-4-flash', max_tokens: 50,
          messages: [{ role: 'user', content: 'Reply OK' }],
        }),
      });
      clearTimeout(timeout);
      const ms = Date.now() - start;
      const body = await resp.text();
      results.zhipu_cn = { status: resp.status, ms, body: body.substring(0, 200) };
    } catch (e) {
      results.zhipu_cn = { error: e.message };
    }
  } else {
    results.zhipu_cn = { error: 'ZHIPU_API_KEY not set' };
  }

  // Test 2: Claude proxy
  const CLAUDE_KEY = process.env.CLAUDE_API_KEY;
  if (CLAUDE_KEY) {
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch('https://api.gptsapi.net/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CLAUDE_KEY}`, 'x-api-key': CLAUDE_KEY },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 50,
          messages: [{ role: 'user', content: 'Reply OK' }],
        }),
      });
      clearTimeout(timeout);
      const ms = Date.now() - start;
      const body = await resp.text();
      results.claude = { status: resp.status, ms, body: body.substring(0, 200) };
    } catch (e) {
      results.claude = { error: e.message };
    }
  } else {
    results.claude = { error: 'CLAUDE_API_KEY not set' };
  }

  // Test 3: DeepSeek
  const DS_KEY = process.env.DEEPSEEK_API_KEY;
  if (DS_KEY) {
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DS_KEY}` },
        body: JSON.stringify({
          model: 'deepseek-chat', max_tokens: 50,
          messages: [{ role: 'user', content: 'Reply OK' }],
        }),
      });
      clearTimeout(timeout);
      const ms = Date.now() - start;
      const body = await resp.text();
      results.deepseek = { status: resp.status, ms, body: body.substring(0, 200) };
    } catch (e) {
      results.deepseek = { error: e.message };
    }
  } else {
    results.deepseek = { error: 'DEEPSEEK_API_KEY not set' };
  }

  res.json({ timestamp: new Date().toISOString(), results });
}
