/**
 * User Data UPSERT API
 * 
 * POST /api/user-data  — Save/merge user metrics
 * GET  /api/user-data?userId=xxx — Load user metrics
 * 
 * Storage: Vercel KV (Redis) when available, falls back to in-memory
 * for demo purposes. Frontend also maintains localStorage as primary cache.
 * 
 * UPSERT logic: incremental merge — new values overwrite existing,
 * missing keys are preserved, enabling multi-image assembly of 15 metrics.
 */

// In-memory fallback store (resets on cold start — acceptable for demo)
const store = new Map();

export default async function handler(req, res) {
  // CORS headers for potential cross-origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      // ── LOAD ──
      const userId = req.query.userId;
      if (!userId) return res.status(400).json({ error: '缺少 userId' });

      // Try Vercel KV first
      let data = null;
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
          const kvResp = await fetch(
            `${process.env.KV_REST_API_URL}/get/user:${userId}`,
            { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` } }
          );
          const kvData = await kvResp.json();
          if (kvData.result) data = JSON.parse(kvData.result);
        } catch {}
      }

      // Fallback to in-memory
      if (!data && store.has(userId)) {
        data = store.get(userId);
      }

      return res.json({ success: true, data: data || null });

    } else if (req.method === 'POST') {
      // ── UPSERT (incremental merge) ──
      const { userId, metrics, profile } = req.body;
      if (!userId) return res.status(400).json({ error: '缺少 userId' });

      // Load existing data
      let existing = store.get(userId) || { metrics: [], profile: {} };

      // Try KV load
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
          const kvResp = await fetch(
            `${process.env.KV_REST_API_URL}/get/user:${userId}`,
            { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` } }
          );
          const kvData = await kvResp.json();
          if (kvData.result) existing = JSON.parse(kvData.result);
        } catch {}
      }

      // Merge metrics: new values overwrite, existing preserved
      if (metrics && Array.isArray(metrics)) {
        const merged = [...(existing.metrics || [])];
        metrics.forEach(newM => {
          if (newM.key && newM.value != null) {
            const idx = merged.findIndex(m => m.key === newM.key);
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], value: newM.value, updatedAt: new Date().toISOString() };
            } else {
              merged.push({ key: newM.key, value: newM.value, updatedAt: new Date().toISOString() });
            }
          }
        });
        existing.metrics = merged;
      }

      // Merge profile (birth info, etc)
      if (profile) {
        existing.profile = { ...(existing.profile || {}), ...profile };
      }

      existing.lastUpdated = new Date().toISOString();

      // Save to in-memory
      store.set(userId, existing);

      // Save to Vercel KV if available
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
          await fetch(`${process.env.KV_REST_API_URL}/set/user:${userId}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(JSON.stringify(existing)),
          });
        } catch {}
      }

      return res.json({ success: true, data: existing });

    } else {
      return res.status(405).json({ error: 'GET or POST only' });
    }
  } catch (e) {
    return res.status(500).json({ error: '数据操作失败: ' + e.message });
  }
}
