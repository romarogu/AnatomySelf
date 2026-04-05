/**
 * AnatomySelf API Client — Vercel Edition v2
 * AI calls → /api/* serverless functions (keys on server)
 * Auth → localStorage (primary) + /api/user-data (backend sync)
 * Metrics → localStorage (instant) + backend UPSERT (durable)
 */

// ═══════════════════════════════════════
// AI API Calls
// ═══════════════════════════════════════

export async function apiOCR(file) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
  const resp = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mediaType: file.type }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'HTTP ' + resp.status }));
    throw new Error(err.error || 'OCR 请求失败');
  }
  return resp.json();
}

export async function apiScience({ age, sex, anomalies }) {
  const resp = await fetch('/api/science', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ age, sex, anomalies }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'HTTP ' + resp.status }));
    throw new Error(err.error || '科学分析请求失败');
  }
  return resp.json();
}

export async function apiDestiny({ baziPillars, baziStr, dayMaster, dayMasterElement, dayun, liunian, wuxing, findings }) {
  const resp = await fetch('/api/destiny', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baziPillars, baziStr, dayMaster, dayMasterElement, dayun, liunian, wuxing, findings }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'HTTP ' + resp.status }));
    throw new Error(err.error || '命理分析请求失败');
  }
  return resp.json();
}

export async function apiChat({ brain, question, context }) {
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brain, question, context }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'HTTP ' + resp.status }));
    throw new Error(err.error || '对话请求失败');
  }
  return resp.json();
}

// ═══════════════════════════════════════
// Auth — localStorage based
// ═══════════════════════════════════════

export async function apiRegister(username, password) {
  const key = 'as_user_' + username.toLowerCase();
  if (localStorage.getItem(key)) return { error: '用户名已存在' };
  const userId = 'u_' + Date.now().toString(36);
  localStorage.setItem(key, JSON.stringify({ userId, username: username.toLowerCase(), password, appData: {} }));
  localStorage.setItem('as_current_user', key);
  return { success: true, userId, username: username.toLowerCase() };
}

export async function apiLogin(username, password) {
  const key = 'as_user_' + username.toLowerCase();
  const raw = localStorage.getItem(key);
  if (!raw) return { error: '用户不存在' };
  const data = JSON.parse(raw);
  if (data.password !== password) return { error: '密码错误' };
  localStorage.setItem('as_current_user', key);
  return { success: true, userId: data.userId, username: data.username, data: data.appData || {} };
}

export function apiLogout() {
  localStorage.removeItem('as_current_user');
}

// ═══════════════════════════════════════
// User Data Persistence — dual write
// ═══════════════════════════════════════

/**
 * Save user data: localStorage (instant) + backend UPSERT (durable)
 * Supports incremental merge: only non-null metrics are written.
 */
export async function apiSaveUser(userId, appData) {
  // 1. Write to localStorage immediately
  const ck = localStorage.getItem('as_current_user');
  if (ck) {
    const d = JSON.parse(localStorage.getItem(ck) || '{}');
    d.appData = appData;
    localStorage.setItem(ck, JSON.stringify(d));
  }

  // 2. UPSERT to backend (fire-and-forget, catch errors silently)
  try {
    const metricsToSync = (appData.metrics || []).filter(m => m.value != null);
    if (metricsToSync.length > 0 || appData.birthYear) {
      await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          metrics: metricsToSync,
          profile: {
            birthYear: appData.birthYear,
            birthMonth: appData.birthMonth,
            birthDay: appData.birthDay,
            birthHour: appData.birthHour,
            sex: appData.sex,
          },
        }),
      });
    }
  } catch {
    // Backend sync failure is non-critical
  }

  return { success: true };
}

/**
 * Load user data: try backend first, fall back to localStorage
 */
export async function apiLoadUser(userId) {
  try {
    const resp = await fetch(`/api/user-data?userId=${encodeURIComponent(userId)}`);
    if (resp.ok) {
      const result = await resp.json();
      if (result.data) return result.data;
    }
  } catch {}

  const ck = localStorage.getItem('as_current_user');
  if (ck) {
    const d = JSON.parse(localStorage.getItem(ck) || '{}');
    return d.appData || null;
  }
  return null;
}
