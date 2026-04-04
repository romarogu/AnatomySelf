/**
 * AnatomySelf API Client — Vercel Edition
 * AI calls → /api/* serverless functions (keys on server)
 * Auth → localStorage (Vercel has no persistent server state)
 */

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

export async function apiDestiny({ baziStr, dayMaster, dayMasterElement, dayun, liunian, wuxing, findings }) {
  const resp = await fetch('/api/destiny', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baziStr, dayMaster, dayMasterElement, dayun, liunian, wuxing, findings }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'HTTP ' + resp.status }));
    throw new Error(err.error || '命理分析请求失败');
  }
  return resp.json();
}

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

export async function apiSaveUser(userId, appData) {
  const ck = localStorage.getItem('as_current_user');
  if (!ck) return;
  const d = JSON.parse(localStorage.getItem(ck) || '{}');
  d.appData = appData;
  localStorage.setItem(ck, JSON.stringify(d));
  return { success: true };
}
