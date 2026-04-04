export default function handler(req, res) {
  res.json({
    status: 'ok',
    claude: !!process.env.ANTHROPIC_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    platform: 'vercel',
    timestamp: new Date().toISOString(),
  });
}
