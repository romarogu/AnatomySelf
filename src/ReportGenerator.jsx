import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ═══════════════════════════════════════
// Five Element Totems — geometric alchemical symbols
// ═══════════════════════════════════════
const TOTEM = {
  '木': `<svg viewBox="0 0 40 40" width="28" height="28"><line x1="20" y1="6" x2="20" y2="34" stroke="#4a8a4a" stroke-width="1.5"/><line x1="20" y1="14" x2="10" y2="22" stroke="#4a8a4a" stroke-width="1"/><line x1="20" y1="14" x2="30" y2="22" stroke="#4a8a4a" stroke-width="1"/><line x1="20" y1="22" x2="12" y2="28" stroke="#4a8a4a" stroke-width=".7"/><line x1="20" y1="22" x2="28" y2="28" stroke="#4a8a4a" stroke-width=".7"/></svg>`,
  '火': `<svg viewBox="0 0 40 40" width="28" height="28"><polygon points="20,4 34,34 6,34" fill="none" stroke="#c45a30" stroke-width="1.2"/><polygon points="20,14 28,34 12,34" fill="none" stroke="#c45a30" stroke-width=".6" opacity=".5"/></svg>`,
  '土': `<svg viewBox="0 0 40 40" width="28" height="28"><rect x="8" y="8" width="24" height="24" fill="none" stroke="#a08a50" stroke-width="1.2"/><rect x="14" y="14" width="12" height="12" fill="none" stroke="#a08a50" stroke-width=".6" opacity=".5"/></svg>`,
  '金': `<svg viewBox="0 0 40 40" width="28" height="28"><circle cx="20" cy="20" r="14" fill="none" stroke="#9898a8" stroke-width="1.2"/><circle cx="20" cy="20" r="8" fill="none" stroke="#9898a8" stroke-width=".6" opacity=".5"/><line x1="20" y1="6" x2="20" y2="34" stroke="#9898a8" stroke-width=".4" opacity=".3"/><line x1="6" y1="20" x2="34" y2="20" stroke="#9898a8" stroke-width=".4" opacity=".3"/></svg>`,
  '水': `<svg viewBox="0 0 40 40" width="28" height="28"><polygon points="20,36 34,6 6,6" fill="none" stroke="#3a6a9a" stroke-width="1.2"/><polygon points="20,26 28,6 12,6" fill="none" stroke="#3a6a9a" stroke-width=".6" opacity=".5"/></svg>`,
};

const EC = {"木":"#4a8a4a","火":"#c45a30","土":"#a08a50","金":"#9898a8","水":"#3a6a9a"};

function sysName(el, isEn) {
  const m = { en:{"木":"Hepatic","火":"Cardiovascular","土":"Metabolic","金":"Respiratory","水":"Renal"}, zh:{"木":"肝胆","火":"心血管","土":"脾胃","金":"呼吸","水":"肾脏"} };
  return (isEn?m.en:m.zh)[el]||el;
}

function metricName(key, isEn, RR_EN_SHORT, RR) {
  if (isEn) return RR_EN_SHORT?.[key] || key;
  return RR?.[key]?.cn || key;
}

// Radar SVG for print (light theme)
function radarSVG(med, dest, isEn) {
  const order = ["火","土","金","水","木"];
  const labels = isEn ? ["Cardio","Metabolic","Respiratory","Renal","Hepatic"] : ["心血管","代谢","呼吸","肾脏","肝胆"];
  const cx=160, cy=160, r=120;
  const a = (i) => (i*2*Math.PI/5)-Math.PI/2;
  const xy = (ang,rd) => [cx+rd*Math.cos(ang), cy+rd*Math.sin(ang)];
  let s = `<svg viewBox="0 0 320 320" width="300" height="300" xmlns="http://www.w3.org/2000/svg">`;
  // Grid
  [1,.75,.5,.25].forEach(sc=>{
    const pts = order.map((_,i)=>xy(a(i),r*sc).join(",")).join(" ");
    s += `<polygon points="${pts}" fill="none" stroke="#d0ccc4" stroke-width=".5"/>`;
  });
  order.forEach((_,i)=>{ const [x,y]=xy(a(i),r); s+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#d0ccc4" stroke-width=".3"/>`; });
  // Destiny polygon
  const dP = order.map((e,i)=>xy(a(i),r*(dest[e]||50)/100).join(",")).join(" ");
  s += `<polygon points="${dP}" fill="rgba(196,162,101,.12)" stroke="#b8963e" stroke-width="1.5"/>`;
  // Medical polygon
  const mP = order.map((e,i)=>xy(a(i),r*(med[e]||50)/100).join(",")).join(" ");
  s += `<polygon points="${mP}" fill="rgba(80,80,80,.04)" stroke="#555" stroke-width="1" stroke-dasharray="5 3"/>`;
  // Dots + labels
  order.forEach((e,i)=>{
    const [dx,dy]=xy(a(i),r*(dest[e]||50)/100);
    s+=`<circle cx="${dx}" cy="${dy}" r="4" fill="${EC[e]}"/>`;
    const [lx,ly]=xy(a(i),r+20);
    s+=`<text x="${lx}" y="${ly+4}" text-anchor="middle" fill="${EC[e]}" font-size="11" font-weight="500" font-family="'JetBrains Mono',monospace">${labels[i]}</text>`;
  });
  s+=`</svg>`;
  return s;
}

async function htmlToPDF(container, filename) {
  const canvas = await html2canvas(container, { backgroundColor:'#faf8f4', scale:2, useCORS:true, logging:false });
  const imgData = canvas.toDataURL('image/png');
  const pdfW = 210, pdfH = (canvas.height*pdfW)/canvas.width;
  const doc = new jsPDF({orientation:'p', unit:'mm', format:[pdfW, Math.max(pdfH,297)]});
  doc.addImage(imgData,'PNG',0,0,pdfW,pdfH);
  doc.save(filename);
}

// ═══════════════════════════════════════
// LIFE BLUEPRINT — Print-friendly white theme
// ═══════════════════════════════════════
export async function generateLifeBlueprintPDF(data, locale) {
  const { user, age, sex, bazi, dy, ln, sci, dst, metrics, med, dest, colls, reportId, date, RR_EN_SHORT, RR, gR } = data;
  const isEn = locale === 'en';

  const c = document.createElement('div');
  c.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:#faf8f4;color:#1a1a18;font-family:"Noto Serif SC",serif;padding:52px 60px;font-size:14px;line-height:1.7;';
  document.body.appendChild(c);

  const sevColor = (s)=> s==='critical'||s==='severe'?'#a02020':s==='moderate'?'#b07a10':'#2a7a5a';
  const sevBg = (s)=> s==='critical'||s==='severe'?'#fdf2f2':s==='moderate'?'#fdf8ee':'#f0f8f4';

  c.innerHTML = `
    <!-- Paper texture overlay -->
    <div style="position:absolute;inset:0;background:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%224%22 height=%224%22><rect width=%224%22 height=%224%22 fill=%22%23faf8f4%22/><rect x=%220%22 y=%220%22 width=%221%22 height=%221%22 fill=%22%23f5f2ec%22 opacity=%22.3%22/></svg>');pointer-events:none;"></div>

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #c4a265;padding-bottom:16px;margin-bottom:28px;">
      <div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:16px;color:#c4a265;letter-spacing:4px;font-weight:400;">ANATOMYSELF</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;color:#1a1a18;letter-spacing:3px;margin-top:4px;">${isEn?'LIFE BLUEPRINT':'生命蓝图'}</div>
      </div>
      <div style="text-align:right;font-family:'JetBrains Mono',monospace;font-size:10px;color:#888;">
        <div>${user} · ${age}${isEn?'y/o':'岁'} ${isEn?(sex==='M'?'Male':'Female'):(sex==='M'?'男':'女')}</div>
        <div style="color:#c4a265;">${isEn?'Day Master':'日主'}: ${bazi.dm}(${bazi.dme}) · ${dy.lbl} · ${ln.lbl}</div>
        <div>ID: ${reportId} · ${date}</div>
      </div>
    </div>

    <!-- Top Sentinel -->
    ${(sci?.sentinel||sci?.summary)?`
    <div style="border-left:3px solid #c4a265;padding:16px 24px;background:#f5f2ec;margin-bottom:28px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#b8963e;letter-spacing:3px;margin-bottom:6px;">TOP SENTINEL</div>
      <div style="font-size:16px;color:#1a1a18;line-height:1.6;font-weight:400;">${sci.sentinel||sci.summary}</div>
    </div>`:''}

    <!-- Two-column: Metrics + Radar -->
    <div style="display:flex;gap:32px;margin-bottom:32px;">
      <div style="flex:1;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#b8963e;letter-spacing:3px;margin-bottom:12px;">${isEn?'CLINICAL BIOMARKERS':'临床指标'}</div>
        ${metrics.filter(m=>m.value!=null).map(m=>{
          const ref = gR?gR(m.key,age,sex):null;
          const inR = ref&&m.value>=ref.l&&m.value<=ref.h;
          const isAnom = ref&&!inR;
          const name = metricName(m.key,isEn,RR_EN_SHORT,RR);
          return isAnom
            ? `<div style="display:flex;align-items:center;padding:8px 12px;margin-bottom:4px;background:${sevBg('severe')};border:1px solid #e8c0c0;border-left:3px solid #a02020;">
                <span style="flex:1;font-size:13px;color:#1a1a18;font-weight:500;">${name}</span>
                <span style="font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;color:#a02020;">${m.value}</span>
                <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#888;margin-left:6px;">${ref?.u||''}</span>
              </div>`
            : `<div style="display:flex;align-items:center;padding:6px 12px;margin-bottom:2px;background:#f0f0ec;">
                <span style="flex:1;font-size:13px;color:#555;">${name}</span>
                <span style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:500;color:#2a7a5a;">${m.value}</span>
                <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#aaa;margin-left:6px;">${ref?.u||''}</span>
              </div>`;
        }).join('')}
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;">
        ${radarSVG(med,dest,isEn)}
      </div>
    </div>

    <!-- Impact Cards -->
    ${(sci?.items?.length||dst?.collision_items?.length)?`
    <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#b8963e;letter-spacing:3px;margin-bottom:14px;">${isEn?'IMPACT ANALYSIS':'对撞分析'}</div>
    ${'火,土,金,水,木'.split(',').map(el=>{
      const si=(sci?.items||[]).find(it=>it.organ_system===el);
      const di=(dst?.collision_items||[]).find(it=>it.organ_wuxing===el);
      if(!si&&!di) return '';
      const isCrit = si?.severity==='critical'||si?.severity==='severe';
      return `
      <div style="display:flex;margin-bottom:10px;border:1px solid ${isCrit?'#e8c0c0':'#e0ddd8'};border-left:3px solid ${EC[el]};background:${isCrit?'#fdf2f2':'#fff'};">
        <div style="flex:1;padding:14px 18px;border-right:1px solid #eee;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            ${TOTEM[el]||''}
            <div>
              <span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:#2a7a5a;letter-spacing:1.5px;">CLINICAL</span>
              <span style="font-size:13px;color:#555;margin-left:8px;">${sysName(el,isEn)}</span>
              ${si?.severity?`<span style="font-family:'JetBrains Mono',monospace;font-size:8px;padding:2px 6px;margin-left:6px;background:${sevBg(si.severity)};color:${sevColor(si.severity)};font-weight:600;">${si.severity.toUpperCase()}</span>`:''}
            </div>
          </div>
          <div style="font-size:14px;color:#1a1a18;line-height:1.7;${isCrit?'font-weight:500;':''}margin-bottom:6px;">${si?.clinical_fact||si?.physiological_analysis||'—'}</div>
          ${si?.recommendation?`<div style="font-size:13px;color:#2a7a5a;font-weight:500;">→ ${si.recommendation}</div>`:''}
        </div>
        <div style="flex:1;padding:14px 18px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:#b8963e;letter-spacing:1.5px;">ENERGETIC</span>
            ${di?.risk_window?`<span style="font-size:10px;color:#b07a10;margin-left:8px;">${di.risk_window}</span>`:''}
          </div>
          <div style="font-size:14px;color:#1a1a18;line-height:1.7;margin-bottom:6px;">${di?.current_forces||'—'}</div>
          ${di?.prevention?`<div style="font-size:13px;color:#b8963e;font-weight:500;">→ ${di.prevention}</div>`:''}
        </div>
      </div>`;
    }).join('')}`:''}

    <!-- Temporal Outlook -->
    ${dst?.temporal_outlook?`
    <div style="margin-top:24px;padding:18px 24px;background:#f5f2ec;border-left:3px solid #b8963e;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#b8963e;letter-spacing:3px;margin-bottom:8px;">TEMPORAL OUTLOOK</div>
      <div style="font-size:14px;color:#333;line-height:1.8;">${dst.temporal_outlook}</div>
    </div>`:''}

    ${dst?.key_dates?.length?`
    <div style="margin-top:16px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#b8963e;letter-spacing:3px;margin-bottom:10px;">${isEn?'KEY TEMPORAL NODES':'关键节点'}</div>
      ${dst.key_dates.map(d=>`<div style="font-size:13px;color:#b07a10;margin-bottom:5px;padding:4px 0;border-bottom:1px solid #f0ece4;">▪ ${d}</div>`).join('')}
    </div>`:''}

    <!-- Divider -->
    <div style="height:2px;background:linear-gradient(90deg,#c4a265,transparent);margin:28px 0 16px;"></div>

    <!-- Disclaimer -->
    <div style="font-size:10px;color:#999;line-height:1.6;">
      ${isEn
        ?'Science Brain: AI clinical interpretation — reference only, not medical advice. Consult a qualified healthcare provider. Meta Brain: Based on traditional BaZi metaphysics — cultural reference only, not scientifically validated.'
        :'科学脑：AI 临床解读仅供参考，不构成医疗建议，请咨询专业医疗机构。命理脑：基于传统八字命理推演，属文化参考，不具科学实证效力。'}
    </div>
    <div style="text-align:center;font-family:'JetBrains Mono',monospace;font-size:9px;color:#ccc;margin-top:12px;">ANATOMYSELF · ${date}</div>
  `;

  await htmlToPDF(c, `AnatomySelf_LifeBlueprint_${date.replace(/\./g,'')}.pdf`);
  document.body.removeChild(c);
}

// ═══════════════════════════════════════
// WEEKLY ENERGY GUIDE — Print-friendly
// ═══════════════════════════════════════
export async function generateWeeklyGuidePDF(data, locale) {
  const { bazi, dy, ln, date, weekDays } = data;
  const isEn = locale === 'en';

  const c = document.createElement('div');
  c.style.cssText = 'position:fixed;left:-9999px;top:0;width:520px;background:#faf8f4;color:#1a1a18;font-family:"Noto Serif SC",serif;padding:44px 40px;font-size:14px;';
  document.body.appendChild(c);

  c.innerHTML = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#c4a265;letter-spacing:4px;">ANATOMYSELF</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:#1a1a18;letter-spacing:3px;margin:6px 0;">${isEn?'WEEKLY ENERGY GUIDE':'一周能量防御指南'}</div>
      <div style="font-size:11px;color:#888;">${date} · ${isEn?'Day Master':'日主'} ${bazi.dm}(${bazi.dme})</div>
    </div>

    <div style="height:3px;background:linear-gradient(90deg,#4a8a4a,#c45a30,#a08a50,#9898a8,#3a6a9a);margin-bottom:20px;border-radius:2px;"></div>

    ${weekDays.map(d => {
      const barColor = d.energy>=80?'#2a7a5a':d.energy>=60?'#b07a10':'#a02020';
      const bgColor = d.energy>=80?'#f0f8f4':d.energy>=60?'#fdf8ee':'#fdf2f2';
      return `
      <div style="display:flex;align-items:center;gap:14px;padding:12px 14px;margin-bottom:4px;background:${bgColor};border-left:3px solid ${EC[d.el]};">
        <div style="width:52px;text-align:center;">
          <div style="font-size:14px;color:#333;font-weight:500;">${d.date}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#888;">${isEn?d.weekdayEn:'周'+d.weekday}</div>
        </div>
        <div style="width:36px;text-align:center;">
          ${TOTEM[d.el]||`<span style="font-size:18px;color:${EC[d.el]};">${d.el}</span>`}
        </div>
        <div style="flex:1;">
          <div style="font-size:14px;color:#1a1a18;font-weight:500;">${d.gan}${d.zhi}</div>
          <div style="font-size:10px;color:#888;">${d.rel}</div>
        </div>
        <div style="width:80px;">
          <div style="height:6px;background:#eee;border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${d.energy}%;background:${barColor};border-radius:3px;"></div>
          </div>
        </div>
        <div style="width:50px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;color:${barColor};">${d.energy}%</div>
      </div>`;
    }).join('')}

    <div style="height:2px;background:linear-gradient(90deg,#c4a265,transparent);margin:24px 0 12px;"></div>
    <div style="font-size:9px;color:#bbb;text-align:center;">
      ${isEn?'Based on traditional BaZi analysis. Cultural reference only.':'基于传统命理推演，属文化参考。'}
    </div>
    <div style="text-align:center;font-family:'JetBrains Mono',monospace;font-size:9px;color:#ddd;margin-top:6px;">ANATOMYSELF · ${date}</div>
  `;

  await htmlToPDF(c, `AnatomySelf_WeeklyGuide_${date.replace(/[\.\/ ]/g,'')}.pdf`);
  document.body.removeChild(c);
}
