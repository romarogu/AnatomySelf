export default function handler(req, res) {
  res.json({
    status: 'ok',
    claude_relay: !!process.env.CLAUDE_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    claude_relay_url: 'https://api.gptsapi.net/v1',
    deepseek_url: 'https://api.deepseek.com/v1',
    models: {
      ocr: 'claude-opus-4-20250514 (via relay)',
      science: 'claude-sonnet-4-20250514 (via relay)',
      destiny: 'deepseek-chat',
    },
    timestamp: new Date().toISOString(),
  });
}
