export const config = { api: { bodyParser: { sizeLimit: '50mb' } } };

function parseJson(txt) {
  if (!txt) return null;
  let s = txt.trim().replace(/^```+\s*(?:json)?\s*\n?/i, '').replace(/\n?\s*```+\s*$/g, '').trim();
  const i = s.indexOf('{'); if (i < 0) return null; s = s.substring(i);
  let d = 0, e = -1;
  for (let j = 0; j < s.length; j++) { if (s[j] === '{') d++; if (s[j] === '}') { d--; if (d === 0) { e = j; break; } } }
  if (e > 0) s = s.substring(0, e + 1);
  else {
    // Auto-close truncated JSON
    let ob = 0, oa = 0;
    for (const c of s) { if (c==='{') ob++; if (c==='}') ob--; if (c==='[') oa++; if (c===']') oa--; }
    s = s.replace(/,\s*$/, '');
    while (oa > 0) { s += ']'; oa--; }
    while (ob > 0) { s += '}'; ob--; }
  }
  try { return JSON.parse(s); } catch {
    try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
  }
}

const EXTRACT_PROMPT = `请仔细识别这份体检报告中的所有医学检验指标。直接返回纯JSON，不要用markdown代码块：
{"metrics":[{"name":"中文名","code":"英文缩写如ALT/AST/FBG/RHR/FVC/Cr/SBP/DBP/TC/TG/HDL/LDL/WBC/RBC/HGB/PLT/UA/BUN/GGT/HbA1c/SpO2/VitD/TBIL/LDL_C","value":数值,"unit":"单位"}],"report_date":"报告日期","institution":"检测机构"}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { base64, mediaType } = req.body;
    if (!base64) return res.status(400).json({ error: '缺少文件数据' });

    const KEY = process.env.ZHIPU_API_KEY;
    if (!KEY) return res.json({ metrics: [], ocr_unavailable: true, message: '未配置 ZHIPU_API_KEY' });

    const isPDF = mediaType === 'application/pdf';
    console.log(`[ocr] type=${mediaType}, isPDF=${isPDF}, base64 length=${base64.length}`);

    if (isPDF) {
      // ═══ PDF PATH: GLM-OCR layout_parsing → text extraction → metric parsing ═══
      const dataUrl = `data:${mediaType};base64,${base64}`;

      // Step 1: Extract text via GLM-OCR
      console.log('[ocr] Step 1: GLM-OCR layout_parsing...');
      const ocrResp = await fetch('https://open.bigmodel.cn/api/paas/v4/layout_parsing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
        body: JSON.stringify({ model: 'glm-ocr', file: dataUrl }),
      });

      if (!ocrResp.ok) {
        const err = await ocrResp.text();
        console.error('[ocr] GLM-OCR error:', ocrResp.status, err.substring(0, 300));
        // Fallback: try GLM-4V with first page as image
        return res.status(500).json({ error: `GLM-OCR error (${ocrResp.status}): PDF解析失败，请尝试上传图片格式` });
      }

      const ocrData = await ocrResp.json();
      // GLM-OCR returns structured document content
      const ocrContent = ocrData.choices?.[0]?.message?.content
        || ocrData.data?.content
        || JSON.stringify(ocrData.data || ocrData).substring(0, 8000);
      console.log('[ocr] GLM-OCR content length:', String(ocrContent).length);

      // Step 2: Send extracted text to GLM-4-Plus for metric structuring
      console.log('[ocr] Step 2: GLM-4-Plus metric extraction...');
      const structResp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
        body: JSON.stringify({
          model: 'glm-4-plus',
          max_tokens: 4000,
          temperature: 0.1,
          messages: [{
            role: 'user',
            content: `以下是从体检报告PDF中提取的文本内容。请从中识别所有医学检验指标，返回纯JSON：
{"metrics":[{"name":"中文名","code":"英文缩写","value":数值,"unit":"单位"}],"report_date":"报告日期","institution":"检测机构"}

体检报告内容：
${String(ocrContent).substring(0, 12000)}`
          }],
        }),
      });

      if (!structResp.ok) {
        // Return raw OCR content as fallback
        return res.json({ metrics: [], raw_summary: String(ocrContent).substring(0, 1000), _note: 'Metric extraction failed, showing raw OCR text' });
      }

      const structData = await structResp.json();
      const structTxt = structData.choices?.[0]?.message?.content || '';
      const parsed = parseJson(structTxt);
      return res.json(parsed || { metrics: [], raw_summary: structTxt.substring(0, 500) });

    } else {
      // ═══ IMAGE PATH: GLM-4V-Plus direct visual OCR (unchanged) ═══
      const imageUrl = `data:${mediaType};base64,${base64}`;

      const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
        body: JSON.stringify({
          model: 'glm-4v-plus',
          max_tokens: 4000,
          temperature: 0.1,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl } },
              { type: 'text', text: EXTRACT_PROMPT }
            ]
          }],
        }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return res.status(500).json({ error: 'Zhipu OCR error (' + resp.status + '): ' + err.substring(0, 300) });
      }

      const data = await resp.json();
      const txt = data.choices?.[0]?.message?.content || '';
      const parsed = parseJson(txt);
      return res.json(parsed || { metrics: [], raw_summary: txt.substring(0, 500) });
    }
  } catch (e) {
    console.error('[ocr] error:', e.message);
    res.status(500).json({ error: 'OCR error: ' + e.message });
  }
}
