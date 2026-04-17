/**
 * AnatomySelf API Client — Supabase Edition
 * Auth → Supabase Auth (email/password)
 * Data → Supabase PostgreSQL (profiles, metrics, analyses)
 * AI   → /api/* serverless functions (unchanged)
 */
import { supabase } from './supabaseClient.js';

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════

export async function apiRegister(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw new Error(error.message);
  // Profile is auto-created by trigger, but let's update username
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      username: username || email.split('@')[0],
    });
  }
  return { userId: data.user?.id, email: data.user?.email, username };
}

export async function apiLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  // Load profile
  const profile = await loadProfile(data.user.id);
  return {
    userId: data.user.id,
    email: data.user.email,
    username: profile?.username || email.split('@')[0],
    ...profile,
  };
}

export async function apiLogout() {
  await supabase.auth.signOut();
}

export async function apiGetSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const profile = await loadProfile(session.user.id);
  return {
    userId: session.user.id,
    email: session.user.email,
    username: profile?.username || session.user.email?.split('@')[0],
    ...profile,
  };
}

// ═══════════════════════════════════════
// PROFILE (birth info, tier, settings)
// ═══════════════════════════════════════

async function loadProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (!data) return null;
  return {
    username: data.username,
    birthYear: data.birth_year,
    birthMonth: data.birth_month,
    birthDay: data.birth_day,
    birthHour: data.birth_hour,
    sex: data.sex,
    birthCity: data.birth_city,
    birthLon: data.birth_lon,
    tier: data.tier || 'free',
    discoveryMode: data.discovery_mode,
    restingHeartRate: data.resting_heart_rate,
    setupComplete: !!data.birth_year,
  };
}

export async function apiSaveProfile(userId, profileData) {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      username: profileData.username,
      birth_year: profileData.birthYear,
      birth_month: profileData.birthMonth,
      birth_day: profileData.birthDay,
      birth_hour: profileData.birthHour,
      sex: profileData.sex,
      birth_city: profileData.birthCity,
      birth_lon: profileData.birthLon,
      discovery_mode: profileData.discoveryMode,
      resting_heart_rate: profileData.restingHeartRate,
      updated_at: new Date().toISOString(),
    });
  if (error) console.error('Save profile error:', error);
}

// ═══════════════════════════════════════
// METRICS (biomarker values)
// ═══════════════════════════════════════

export async function apiLoadMetrics(userId) {
  const { data } = await supabase
    .from('metrics')
    .select('key, value, recorded_at')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false });
  return data || [];
}

export async function apiSaveMetrics(userId, metrics) {
  // Filter to non-null metrics only
  const toSave = metrics
    .filter(m => m.value != null)
    .map(m => ({
      user_id: userId,
      key: m.key,
      value: m.value,
      recorded_at: new Date().toISOString(),
    }));
  if (toSave.length === 0) return;
  const { error } = await supabase
    .from('metrics')
    .upsert(toSave, { onConflict: 'user_id,key' });
  if (error) console.error('Save metrics error:', error);
}

// ═══════════════════════════════════════
// ANALYSES (cached AI results)
// ═══════════════════════════════════════

export async function apiSaveAnalysis(userId, type, resultJson) {
  const { error } = await supabase
    .from('analyses')
    .insert({ user_id: userId, type, result_json: resultJson });
  if (error) console.error('Save analysis error:', error);
}

export async function apiLoadLatestAnalysis(userId, type) {
  const { data, error } = await supabase
    .from('analyses')
    .select('result_json, created_at')
    .eq('user_id', userId)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error('Load analysis error:', error); return null; }
  return data?.result_json || null;
}

// ═══════════════════════════════════════
// AI API Calls (serverless functions — unchanged)
// ═══════════════════════════════════════

export async function apiOCR(file) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
  const resp = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mediaType: file.type }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'HTTP ' + resp.status }));
    throw new Error(err.error || 'OCR failed');
  }
  return resp.json();
}

export async function apiScience({ age, sex, anomalies, allMetrics, lang }) {
  console.log('[apiScience] calling with', { age, sex, anomaliesCount: anomalies?.length, allMetricsCount: allMetrics?.length, lang });
  const resp = await fetch('/api/science', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ age, sex, anomalies, allMetrics, lang }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'HTTP ' + resp.status }));
    console.error('[apiScience] error:', err);
    throw new Error(err.error || 'Science analysis failed');
  }
  const result = await resp.json();
  console.log('[apiScience] success:', result?.sentinel || result?.summary || 'parsed');
  return result;
}

export async function apiDestiny({ chartData, baziStr, lang }) {
  const resp = await fetch('/api/destiny', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chartData, baziStr, lang }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'HTTP ' + resp.status }));
    throw new Error(err.error || 'Meta analysis failed');
  }
  return resp.json();
}

export async function apiChat(brain, message, context, lang) {
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brain, message, context, lang }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'HTTP ' + resp.status }));
    throw new Error(err.error || 'Chat failed');
  }
  return resp.json();
}
