export default function handler(req, res) {
  res.json({
    status: 'ok',
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    engine: 'DeepSeek (全部)',
    platform: 'vercel',
    timestamp: new Date().toISOString(),
  });
}
