export default function handler(req, res) {
  res.json({
    status: 'ok',
    claude_relay: !!process.env.CLAUDE_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    architecture: {
      ocr: { model: 'claude-sonnet-4-6', via: 'gptsapi.net/v1/messages', format: 'Anthropic' },
      science: { model: 'claude-sonnet-4-6', via: 'gptsapi.net/v1/messages', format: 'Anthropic' },
      destiny: { model: 'deepseek-chat', via: 'api.deepseek.com/v1/chat/completions', format: 'OpenAI' },
    },
    vercel_pro: true,
    max_timeout: '60s',
    timestamp: new Date().toISOString(),
  });
}
