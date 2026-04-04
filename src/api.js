/**
 * AnatomySelf API Client
 * All AI calls go through our Express backend at /api/*
 * Backend handles Claude and DeepSeek keys securely.
 */

const API_BASE = '/api';

export async function apiOCR(file) {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await fetch(`${API_BASE}/ocr`, { method: 'POST', body: formData });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new Error(err.error || 'OCR 请求失败');
  }
  return resp.json();
}

export async function apiScience({ age, sex, anomalies }) {
  const resp = await fetch(`${API_BASE}/science`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ age, sex, anomalies }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new Error(err.error || '科学分析请求失败');
  }
  return resp.json();
}

export async function apiDestiny({ baziStr, dayMaster, dayMasterElement, dayun, liunian, wuxing, findings }) {
  const resp = await fetch(`${API_BASE}/destiny`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baziStr, dayMaster, dayMasterElement, dayun, liunian, wuxing, findings }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new Error(err.error || '命理分析请求失败');
  }
  return resp.json();
}

export async function apiRegister(username, password) {
  const resp = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return resp.json();
}

export async function apiLogin(username, password) {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return resp.json();
}

export async function apiSaveUser(userId, data) {
  const resp = await fetch(`${API_BASE}/user/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  return resp.json();
}

export async function apiGetUser(userId) {
  const resp = await fetch(`${API_BASE}/user/${userId}`);
  return resp.json();
}

export async function apiHealth() {
  const resp = await fetch(`${API_BASE}/health`);
  return resp.json();
}
