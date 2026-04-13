import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ═══════════════════════════════════════
// Shared utilities
// ═══════════════════════════════════════

const EC = {"木":"#4a8a4a","火":"#c45a30","土":"#a08a50","金":"#9898a8","水":"#3a6a9a"};

function sysName(el, isEn) {
  const map = {
    en: {"木":"Hepatic","火":"Cardiovascular","土":"Metabolic","金":"Respiratory","水":"Renal"},
    zh: {"木":"肝胆","火":"心血管","土":"脾胃","金":"呼吸","水":"肾脏"},
  };
  return (isEn ? map.en : map.zh)[el] || el;
}

function metricName(key, isEn, RR_EN_SHORT, RR) {
  if (isEn) return RR_EN_SHORT?.[key] || key;
  return RR?.[key]?.cn || key;
}

function buildRadarSVG(med, dest, colls, isEn) {
  const order = ["火","土","金","水","木"];
  const labels = isEn
    ? ["Cardio","Metabolic","Respiratory","Renal","Hepatic"]
    : ["火·心","土·脾","金·肺","水·肾","木·肝"];
  const cx=150, cy=150, r=110;
  const angles = order.map((_,i) => (i*2*Math.PI/5) - Math.PI/2);
  const xy = (a,rd) => [cx+rd*Math.cos(a), cy+rd*Math.sin(a)];

  let svg = `<svg viewBox="0 0 300 300" width="280" height="280" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;">`;
  // Grid
  [1,.75,.5,.25].forEach(s => {
    const pts = angles.map(a=>xy(a,r*s).join(",")).join(" ");
    svg += `<polygon points="${pts}" fill="none" stroke="rgba(196,162,101,0.1)" stroke-width="0.5"/>`;
  });
  // Axes
  angles.forEach(a => {
    const [x,y] = xy(a,r);
    svg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(196,162,101,0.06)" stroke-width="0.5"/>`;
  });
  // Destiny polygon
  const dP = order.map((e,i)=>xy(angles[i],r*(dest[e]||50)/100).join(",")).join(" ");
  svg += `<polygon points="${dP}" fill="rgba(196,162,101,0.08)" stroke="#c4a265" stroke-width="1.2" opacity="0.75"/>`;
  // Medical polygon
  const mP = order.map((e,i)=>xy(angles[i],r*(med[e]||50)/100).join(",")).join(" ");
  svg += `<polygon points="${mP}" fill="rgba(224,220,212,0.06)" stroke="#e0dcd4" stroke-width="1" stroke-dasharray="4 3" opacity="0.55"/>`;
  // Dots + labels
  order.forEach((e,i) => {
    const [dx,dy] = xy(angles[i], r*(dest[e]||50)/100);
    const [mx,my] = xy(angles[i], r*(med[e]||50)/100);
    svg += `<circle cx="${dx}" cy="${dy}" r="3.5" fill="#c4a265" opacity="0.8"/>`;
    svg += `<circle cx="${mx}" cy="${my}" r="3" fill="#e0dcd4" opacity="0.6"/>`;
    const [lx,ly] = xy(angles[i], r+22);
    svg += `<text x="${lx}" y="${ly+4}" text-anchor="middle" font-size="10" fill="${EC[e]}" font-family="'Noto Serif SC',serif">${labels[i]}</text>`;
  });
  // Center
  svg += `<circle cx="${cx}" cy="${cy}" r="5" fill="#1a1a22" stroke="rgba(196,162,101,0.3)" stroke-width="0.5"/>`;
  svg += `</svg>`;
  return svg;
}

async function htmlToPDF(container, filename) {
  const canvas = await html2canvas(container, {
    backgroundColor: '#08080a',
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const imgData = canvas.toDataURL('image/png');
  const imgW = canvas.width;
  const imgH = canvas.height;
  // A4: 210mm x 297mm
  const pdfW = 210;
  const pdfH = (imgH * pdfW) / imgW;
  const doc = new jsPDF({ orientation: pdfH > 297 ? 'p' : 'p', unit: 'mm', format: [pdfW, Math.max(pdfH, 297)] });
  doc.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
  doc.save(filename);
}

// ═══════════════════════════════════════
// Life Blueprint Report
// ═══════════════════════════════════════

export async function generateLifeBlueprintPDF(data, locale) {
  const { user, age, sex, bazi, dy, ln, sci, dst, metrics, med, dest, colls, reportId, date, RR_EN_SHORT, RR, gR } = data;
  const isEn = locale === 'en';

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:#08080a;color:#e0dcd4;font-family:"Noto Serif SC",serif;padding:48px 56px;font-size:13px;line-height:1.7;';
  document.body.appendChild(container);

  const sevColor = (s) => s==='critical'||s==='severe' ? '#c44040' : s==='moderate' ? '#d4a840' : '#52b09a';

  container.innerHTML = `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#3a3832;letter-spacing:4px;">ANATOMYSELF</div>
      <div style="font-size:24px;font-weight:300;color:#c4a265;letter-spacing:6px;margin:8px 0;">${isEn ? 'LIFE BLUEPRINT' : '生 命 蓝 图'}</div>
      <div style="font-size:11px;color:#5e5a52;">${user} · ${age}${isEn?'y/o':'岁'} ${isEn?(sex==='M'?'Male':'Female'):(sex==='M'?'男':'女')} · ${bazi.dm}(${bazi.dme}) · ${dy.lbl} · ${ln.lbl}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#3a3832;margin-top:4px;">ID: ${reportId} · ${date}</div>
    </div>

    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(196,162,101,0.2),transparent);margin:20px 0;"></div>

    ${(sci?.sentinel || sci?.summary) ? `
    <div style="border-left:3px solid #c4a265;padding:12px 18px;background:#16161c;margin-bottom:24px;font-size:14px;color:#e0dcd4;">
      ${sci.sentinel || sci.summary}
    </div>` : ''}

    <div style="display:flex;gap:24px;margin-bottom:28px;">
      <div style="flex:1;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#6a5a35;letter-spacing:3px;margin-bottom:10px;">${isEn ? 'BIOMARKERS' : '临床指标'}</div>
        ${metrics.filter(m=>m.value!=null).map(m => {
          const ref = gR ? gR(m.key, age, sex) : null;
          const inR = ref && m.value >= ref.l && m.value <= ref.h;
          const name = metricName(m.key, isEn, RR_EN_SHORT, RR);
          return `<div style="display:flex;justify-content:space-between;padding:3px 8px;margin-bottom:1px;background:#16161c;">
            <span style="font-size:11px;">${name}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${inR?'#52b09a':'#c44040'};">${m.value} <span style="font-size:9px;color:#5e5a52;">${ref?.u||''}</span></span>
          </div>`;
        }).join('')}
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;">
        ${buildRadarSVG(med, dest, colls, isEn)}
      </div>
    </div>

    ${(sci?.items?.length || dst?.collision_items?.length) ? `
    <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#6a5a35;letter-spacing:3px;margin-bottom:10px;">${isEn ? 'IMPACT ANALYSIS' : '对撞分析'}</div>
    ${'火,土,金,水,木'.split(',').map(el => {
      const si = (sci?.items||[]).find(it=>it.organ_system===el);
      const di = (dst?.collision_items||[]).find(it=>it.organ_wuxing===el);
      if(!si && !di) return '';
      return `<div style="display:flex;margin-bottom:8px;border-left:3px solid ${EC[el]};background:#16161c;">
        <div style="flex:1;padding:10px 14px;border-right:1px solid rgba(196,162,101,0.06);">
          <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:#52b09a;letter-spacing:1px;margin-bottom:4px;">CLINICAL · ${sysName(el,isEn)}${si?.severity?` <span style="color:${sevColor(si.severity)};">[${si.severity.toUpperCase()}]</span>`:''}</div>
          <div style="font-size:11px;color:#d0ccc4;">${si?.clinical_fact||si?.physiological_analysis||'—'}</div>
          ${si?.recommendation?`<div style="font-size:10px;color:#52b09a;margin-top:4px;">→ ${si.recommendation}</div>`:''}
        </div>
        <div style="flex:1;padding:10px 14px;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:#c4a265;letter-spacing:1px;margin-bottom:4px;">ENERGETIC${di?.risk_window?` · <span style="color:#d4a840;">${di.risk_window}</span>`:''}</div>
          <div style="font-size:11px;color:#d0ccc4;">${di?.current_forces||'—'}</div>
          ${di?.prevention?`<div style="font-size:10px;color:#c4a265;margin-top:4px;">→ ${di.prevention}</div>`:''}
        </div>
      </div>`;
    }).join('')}` : ''}

    ${dst?.temporal_outlook ? `
    <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#6a5a35;letter-spacing:3px;margin:16px 0 8px;">TEMPORAL OUTLOOK</div>
    <div style="font-size:11px;color:#9a9488;line-height:1.8;margin-bottom:12px;">${dst.temporal_outlook}</div>` : ''}

    ${dst?.key_dates?.length ? `
    <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#6a5a35;letter-spacing:3px;margin-bottom:8px;">${isEn?'KEY DATES':'关键节点'}</div>
    ${dst.key_dates.map(d=>`<div style="font-size:10px;color:#d4a840;margin-bottom:4px;">▪ ${d}</div>`).join('')}` : ''}

    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(196,162,101,0.1),transparent);margin:24px 0;"></div>

    <div style="font-size:8px;color:#3a3832;line-height:1.6;">
      ${isEn
        ? 'Science Brain: AI clinical interpretation — reference only, not medical advice. Meta Brain: Traditional BaZi analysis — cultural reference only.'
        : '科学脑：AI临床解读，仅供参考。命理脑：传统命理推演，属文化参考。'}
    </div>
    <div style="text-align:center;font-size:8px;color:#2a2a2a;margin-top:12px;">ANATOMYSELF · ${date}</div>
  `;

  await htmlToPDF(container, `AnatomySelf_LifeBlueprint_${date.replace(/\./g,'')}.pdf`);
  document.body.removeChild(container);
}

// ═══════════════════════════════════════
// Weekly Energy Defense Guide
// ═══════════════════════════════════════

export async function generateWeeklyGuidePDF(data, locale) {
  const { bazi, dy, ln, date, weekDays } = data;
  const isEn = locale === 'en';

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:480px;background:#08080a;color:#e0dcd4;font-family:"Noto Serif SC",serif;padding:40px 36px;font-size:13px;';
  document.body.appendChild(container);

  container.innerHTML = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#3a3832;letter-spacing:4px;">ANATOMYSELF</div>
      <div style="font-size:18px;font-weight:300;color:#c4a265;letter-spacing:4px;margin:8px 0;">${isEn ? 'WEEKLY ENERGY GUIDE' : '一周能量防御指南'}</div>
      <div style="font-size:10px;color:#5e5a52;">${date} · ${isEn?'Day Master':'日主'} ${bazi.dm}(${bazi.dme}) · ${dy.lbl} · ${ln.lbl}</div>
    </div>

    <div style="height:3px;background:linear-gradient(90deg,#4a8a4a,#c45a30,#a08a50,#9898a8,#3a6a9a);margin-bottom:20px;border-radius:2px;"></div>

    ${weekDays.map(d => {
      const barColor = d.energy >= 80 ? '#52b09a' : d.energy >= 60 ? '#d4a840' : '#c44040';
      const adviceText = isEn ? d.advice : (d.energy >= 80 ? '宜进取' : d.energy >= 60 ? '宜平稳' : '宜守护');
      return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(196,162,101,0.05);">
        <div style="width:48px;text-align:center;">
          <div style="font-size:13px;color:#9a9488;">${d.date}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#5e5a52;">${isEn?d.weekdayEn:'周'+d.weekday}</div>
        </div>
        <div style="width:32px;height:32px;border-radius:50%;background:${EC[d.el]}18;border:1px solid ${EC[d.el]}33;display:flex;align-items:center;justify-content:center;font-size:14px;color:${EC[d.el]};font-weight:600;">
          ${d.el}
        </div>
        <div style="flex:1;">
          <div style="font-size:12px;color:#e0dcd4;">${d.gan}${d.zhi} <span style="font-size:10px;color:${EC[d.el]};">${d.organ}</span></div>
          <div style="font-size:9px;color:#5e5a52;">${d.rel}</div>
        </div>
        <div style="width:80px;">
          <div style="height:4px;background:#16161c;border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${d.energy}%;background:${barColor};border-radius:2px;"></div>
          </div>
        </div>
        <div style="width:50px;text-align:right;font-size:11px;color:${barColor};">${adviceText}</div>
      </div>`;
    }).join('')}

    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(196,162,101,0.1),transparent);margin:20px 0;"></div>

    <div style="font-size:8px;color:#3a3832;text-align:center;line-height:1.5;">
      ${isEn ? '☯ Based on traditional BaZi analysis. Cultural reference only.' : '☯ 基于传统命理推演，属文化参考。'}
    </div>
    <div style="text-align:center;font-size:8px;color:#2a2a2a;margin-top:8px;">ANATOMYSELF · ${date}</div>
  `;

  await htmlToPDF(container, `AnatomySelf_WeeklyGuide_${date.replace(/[\.\/ ]/g,'')}.pdf`);
  document.body.removeChild(container);
}
