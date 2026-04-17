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
  // Ensure container is fully in the DOM and rendered
  // Place it at the end of body, visible but scrolled out of view
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.zIndex = '99999';  // On top so browser actually paints it
  container.style.pointerEvents = 'none';
  container.style.overflow = 'visible';

  // Force a layout pass
  void container.offsetHeight;

  // Wait for fonts and SVG to render
  await new Promise(r => setTimeout(r, 500));

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: '#faf8f4',
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: container.scrollWidth,
      windowHeight: container.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdfW = 210;
    const pdfH = (canvas.height * pdfW) / canvas.width;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [pdfW, Math.max(pdfH, 297)] });
    doc.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
    doc.save(filename);
  } finally {
    // Always remove, even on error
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}

// ═══════════════════════════════════════
// LIFE BLUEPRINT — Print-friendly white theme
// ═══════════════════════════════════════
export async function generateLifeBlueprintPDF(data, locale) {
  const { user, age, sex, bazi, dy, ln, sci, dst, metrics, med, dest, colls, reportId, date, RR_EN_SHORT, RR, gR } = data;
  const isEn = locale === 'en';

  const c = document.createElement('div');
  c.style.cssText = 'width:800px;background:#faf8f4;color:#1a1a18;font-family:"Noto Serif SC",serif;padding:52px 60px;font-size:14px;line-height:1.7;';
  document.body.appendChild(c);

  const sevColor = (s)=> s==='critical'||s==='severe'?'#a02020':s==='moderate'?'#b07a10':'#2a7a5a';
  const sevBg = (s)=> s==='critical'||s==='severe'?'#fdf2f2':s==='moderate'?'#fdf8ee':'#f0f8f4';

  // Element symbols for print (simple text, no SVG to avoid template issues)
  const elSym = {"木":"☰","火":"△","土":"□","金":"○","水":"▽"};

  try {
    // Build metrics HTML
    let metricsHtml = '';
    metrics.filter(m=>m.value!=null).forEach(m=>{
      const ref = gR?gR(m.key,age,sex):null;
      const inR = ref&&m.value>=ref.l&&m.value<=ref.h;
      const name = metricName(m.key,isEn,RR_EN_SHORT,RR);
      if(ref&&!inR){
        metricsHtml += `<div style="display:flex;align-items:center;padding:8px 12px;margin-bottom:4px;background:#fdf2f2;border:1px solid #e8c0c0;border-left:3px solid #a02020;">
          <span style="flex:1;font-size:13px;color:#1a1a18;font-weight:500;">${name}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;color:#a02020;">${m.value}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#888;margin-left:6px;">${ref?.u||''}</span>
        </div>`;
      } else {
        metricsHtml += `<div style="display:flex;align-items:center;padding:6px 12px;margin-bottom:2px;background:#f0f0ec;">
          <span style="flex:1;font-size:13px;color:#555;">${name}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:500;color:#2a7a5a;">${m.value}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#aaa;margin-left:6px;">${ref?.u||''}</span>
        </div>`;
      }
    });

    // Build impact cards HTML
    let impactHtml = '';
    ['火','土','金','水','木'].forEach(el=>{
      const si=(sci?.items||[]).find(it=>it.organ_system===el);
      const di=(dst?.collision_items||[]).find(it=>it.organ_wuxing===el);
      if(!si&&!di) return;
      const isCrit = si?.severity==='critical'||si?.severity==='severe';
      impactHtml += `
      <div style="display:flex;margin-bottom:10px;border:1px solid ${isCrit?'#e8c0c0':'#e0ddd8'};border-left:3px solid ${EC[el]};background:${isCrit?'#fdf2f2':'#fff'};">
        <div style="flex:1;padding:14px 18px;border-right:1px solid #eee;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:18px;color:${EC[el]};">${elSym[el]||el}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:#2a7a5a;letter-spacing:1.5px;">CLINICAL · ${sysName(el,isEn)}</span>
            ${si?.severity?`<span style="font-family:'JetBrains Mono',monospace;font-size:8px;padding:2px 6px;background:${sevBg(si.severity)};color:${sevColor(si.severity)};font-weight:600;">${si.severity.toUpperCase()}</span>`:''}
          </div>
          <div style="font-size:14px;color:#1a1a18;line-height:1.7;${isCrit?'font-weight:500;':''}margin-bottom:6px;">${si?.clinical_fact||si?.physiological_analysis||'—'}</div>
          ${si?.recommendation?`<div style="font-size:13px;color:#2a7a5a;font-weight:500;">→ ${si.recommendation}</div>`:''}
        </div>
        <div style="flex:1;padding:14px 18px;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:#b8963e;letter-spacing:1.5px;margin-bottom:8px;">ENERGETIC${di?.risk_window?` · ${di.risk_window}`:''}</div>
          <div style="font-size:14px;color:#1a1a18;line-height:1.7;margin-bottom:6px;">${di?.current_forces||'—'}</div>
          ${di?.prevention?`<div style="font-size:13px;color:#b8963e;font-weight:500;">→ ${di.prevention}</div>`:''}
        </div>
      </div>`;
    });

    // Build key dates HTML
    let datesHtml = '';
    (dst?.key_dates||[]).forEach(d=>{ datesHtml += `<div style="font-size:13px;color:#b07a10;margin-bottom:5px;padding:4px 0;border-bottom:1px solid #f0ece4;">▪ ${d}</div>`; });

    c.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #c4a265;padding-bottom:16px;margin-bottom:28px;">
        <div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:16px;color:#c4a265;letter-spacing:4px;">ANATOMYSELF</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;color:#1a1a18;letter-spacing:3px;margin-top:4px;">${isEn?'LIFE BLUEPRINT':'生命蓝图'}</div>
        </div>
        <div style="text-align:right;font-family:'JetBrains Mono',monospace;font-size:10px;color:#888;">
          <div>${user} · ${age}${isEn?'y/o':'岁'} ${isEn?(sex==='M'?'Male':'Female'):(sex==='M'?'男':'女')}</div>
          <div style="color:#c4a265;">${isEn?'Day Master':'日主'}: ${bazi.dm}(${bazi.dme}) · ${dy.lbl} · ${ln.lbl}</div>
          <div>ID: ${reportId} · ${date}</div>
        </div>
      </div>

      ${(sci?.sentinel||sci?.summary)?`
      <div style="border-left:3px solid #c4a265;padding:16px 24px;background:#f5f2ec;margin-bottom:28px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#b8963e;letter-spacing:3px;margin-bottom:6px;">TOP SENTINEL</div>
        <div style="font-size:16px;color:#1a1a18;line-height:1.6;">${sci.sentinel||sci.summary}</div>
      </div>`:''}

      <div style="display:flex;gap:32px;margin-bottom:32px;">
        <div style="flex:1;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#b8963e;letter-spacing:3px;margin-bottom:12px;">${isEn?'CLINICAL BIOMARKERS':'临床指标'}</div>
          ${metricsHtml}
        </div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;">
          ${radarSVG(med||{},dest||{},isEn)}
        </div>
      </div>

      ${impactHtml?`<div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#b8963e;letter-spacing:3px;margin-bottom:14px;">${isEn?'IMPACT ANALYSIS':'对撞分析'}</div>${impactHtml}`:''}

      ${dst?.temporal_outlook?`
      <div style="margin-top:24px;padding:18px 24px;background:#f5f2ec;border-left:3px solid #b8963e;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#b8963e;letter-spacing:3px;margin-bottom:8px;">TEMPORAL OUTLOOK</div>
        <div style="font-size:14px;color:#333;line-height:1.8;">${dst.temporal_outlook}</div>
      </div>`:''}

      ${datesHtml?`<div style="margin-top:16px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#b8963e;letter-spacing:3px;margin-bottom:10px;">${isEn?'KEY TEMPORAL NODES':'关键节点'}</div>
        ${datesHtml}
      </div>`:''}

      <div style="height:2px;background:linear-gradient(90deg,#c4a265,transparent);margin:28px 0 16px;"></div>
      <div style="font-size:10px;color:#999;line-height:1.6;">
        ${isEn?'Science Brain: AI clinical interpretation — reference only, not medical advice. Meta Brain: Based on traditional BaZi metaphysics — cultural reference only.':'科学脑：AI 临床解读仅供参考。命理脑：传统命理推演，属文化参考。'}
      </div>
      <div style="text-align:center;font-family:'JetBrains Mono',monospace;font-size:9px;color:#ccc;margin-top:12px;">ANATOMYSELF · ${date}</div>
    `;
  } catch(err) {
    console.error('Report generation error:', err);
    c.innerHTML = `<div style="padding:40px;text-align:center;color:#a02020;">Report generation failed: ${err.message}</div>`;
  }

  await htmlToPDF(c, `AnatomySelf_LifeBlueprint_${date.replace(/\./g,'')}.pdf`);
}

// ═══════════════════════════════════════
// WEEKLY ENERGY GUIDE — Print-friendly
// ═══════════════════════════════════════
export async function generateWeeklyGuidePDF(data, locale) {
  const { bazi, dy, ln, date, weekDays } = data;
  const isEn = locale === 'en';

  // ═══ Archetypal Ten-God Names ═══
  const ARCHETYPE = {
    Resource:  { en:'The Well',    zh:'源泉', icon:'◇', desc_en:'Nourishment flows inward', desc_zh:'滋养内聚' },
    Companion: { en:'The Mirror',  zh:'镜像', icon:'◈', desc_en:'Strength meets its equal', desc_zh:'同气相求' },
    Output:    { en:'The Forge',   zh:'熔炉', icon:'△', desc_en:'Creation demands release', desc_zh:'创造外泄' },
    Wealth:    { en:'The Harvest', zh:'收获', icon:'▽', desc_en:'What you command, commands you', desc_zh:'所驭亦驭己' },
    Power:     { en:'The Crown',   zh:'冠冕', icon:'☉', desc_en:'Structure tempers the soul', desc_zh:'秩序淬炼灵魂' },
  };

  // ═══ Stoic Daily Oracles — 5 types × 3 energy tiers ═══
  const ORACLES = {
    Resource: {
      high: [isEn?'The well is full. Drink deeply and share.':'源泉充盈，饮之分之。', isEn?'Let wisdom enter without resistance.':'让智慧无阻而入。'],
      mid:  [isEn?'Receive before you give. Fill the vessel first.':'先受后予，先满其器。', isEn?'Seek the teacher hidden in silence.':'在沉默中寻找老师。'],
      low:  [isEn?'The roots are thirsty. Rest is not weakness.':'根已渴，休息非示弱。', isEn?'Guard your energy like a winter seed.':'如冬之种，守护能量。'],
    },
    Companion: {
      high: [isEn?'Your reflection is sharp today. Move with confidence.':'今日映像清晰，自信前行。', isEn?'Allies appear when you stand firm.':'站稳时盟友自现。'],
      mid:  [isEn?'Walk your own path. The mirror shows only you.':'走自己的路，镜中唯有你。', isEn?'Collaboration yes, compromise no.':'合作可，妥协否。'],
      low:  [isEn?'Solitude sharpens what crowds dull.':'独处磨砺群聚所钝。', isEn?'Not every battle requires your presence.':'并非每场战役都需你在场。'],
    },
    Output: {
      high: [isEn?'The forge is hot. Shape something that lasts.':'炉火正旺，锻造持久之物。', isEn?'Create boldly. Perfection is tomorrow\'s problem.':'大胆创造，完美是明天的事。'],
      mid:  [isEn?'Express, but do not exhaust. Art has limits.':'表达，但不要耗尽。', isEn?'Channel fire into form, not sparks.':'将火铸成形，而非散作火花。'],
      low:  [isEn?'Today is for depth, not speed.':'今日宜深不宜速。', isEn?'The forge cools. Observe before you strike.':'炉已冷，先观后锤。'],
    },
    Wealth: {
      high: [isEn?'Harvest what you planted. The field is ready.':'收割所种，田已成熟。', isEn?'Opportunity favors the prepared hand.':'机会偏爱有准备的人。'],
      mid:  [isEn?'Hold steady. Not every fruit is ripe.':'稳住，并非所有果实已熟。', isEn?'Manage what you have before seeking more.':'管好已有，再求更多。'],
      low:  [isEn?'Release what no longer serves you.':'放下不再有用之物。', isEn?'Scarcity teaches the value of enough.':'匮乏教会你"足够"的价值。'],
    },
    Power: {
      high: [isEn?'The crown is light today. Lead without force.':'今日冠冕轻，无力亦可领。', isEn?'Structure creates freedom. Build the frame.':'结构创造自由，搭好框架。'],
      mid:  [isEn?'Discipline is the bridge between desire and result.':'自律是欲望与结果之间的桥。', isEn?'Bend, but do not break your principles.':'可弯，但不可折断原则。'],
      low:  [isEn?'Pressure reveals what comfort hides.':'压力揭示舒适所隐藏的。', isEn?'The crown weighs heavy. Rest the neck.':'冠沉，歇颈。'],
    },
  };

  const getOracle = (rel, energy) => {
    const tier = energy >= 80 ? 'high' : energy >= 50 ? 'mid' : 'low';
    const pool = ORACLES[rel]?.[tier] || [isEn?'Move with intention.':'有意而动。'];
    // Deterministic pick based on day
    return pool[Math.floor(energy * 7) % pool.length];
  };

  // ═══ Sacred Geometry Totems (larger, more detailed) ═══
  const SIGIL = {
    '木': `<svg viewBox="0 0 60 60" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
      <line x1="30" y1="8" x2="30" y2="52" stroke="#4a8a4a" stroke-width="1.2" opacity=".6"/>
      <line x1="30" y1="16" x2="14" y2="28" stroke="#4a8a4a" stroke-width="1"/>
      <line x1="30" y1="16" x2="46" y2="28" stroke="#4a8a4a" stroke-width="1"/>
      <line x1="30" y1="28" x2="18" y2="38" stroke="#4a8a4a" stroke-width=".7"/>
      <line x1="30" y1="28" x2="42" y2="38" stroke="#4a8a4a" stroke-width=".7"/>
      <circle cx="30" cy="12" r="3" fill="none" stroke="#4a8a4a" stroke-width=".5" opacity=".4"/>
      <circle cx="30" cy="30" r="12" fill="none" stroke="#4a8a4a" stroke-width=".3" opacity=".2"/>
    </svg>`,
    '火': `<svg viewBox="0 0 60 60" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
      <polygon points="30,6 50,48 10,48" fill="none" stroke="#c45a30" stroke-width="1.2"/>
      <polygon points="30,18 42,48 18,48" fill="none" stroke="#c45a30" stroke-width=".6" opacity=".4"/>
      <circle cx="30" cy="34" r="6" fill="none" stroke="#c45a30" stroke-width=".5" opacity=".3"/>
      <line x1="30" y1="6" x2="30" y2="28" stroke="#c45a30" stroke-width=".3" opacity=".3"/>
    </svg>`,
    '土': `<svg viewBox="0 0 60 60" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="40" height="40" fill="none" stroke="#a08a50" stroke-width="1.2"/>
      <rect x="18" y="18" width="24" height="24" fill="none" stroke="#a08a50" stroke-width=".6" opacity=".4"/>
      <line x1="10" y1="10" x2="50" y2="50" stroke="#a08a50" stroke-width=".3" opacity=".2"/>
      <line x1="50" y1="10" x2="10" y2="50" stroke="#a08a50" stroke-width=".3" opacity=".2"/>
      <circle cx="30" cy="30" r="4" fill="none" stroke="#a08a50" stroke-width=".5" opacity=".3"/>
    </svg>`,
    '金': `<svg viewBox="0 0 60 60" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="30" r="20" fill="none" stroke="#9898a8" stroke-width="1.2"/>
      <circle cx="30" cy="30" r="12" fill="none" stroke="#9898a8" stroke-width=".6" opacity=".4"/>
      <circle cx="30" cy="30" r="4" fill="none" stroke="#9898a8" stroke-width=".4" opacity=".3"/>
      <line x1="30" y1="10" x2="30" y2="50" stroke="#9898a8" stroke-width=".3" opacity=".25"/>
      <line x1="10" y1="30" x2="50" y2="30" stroke="#9898a8" stroke-width=".3" opacity=".25"/>
    </svg>`,
    '水': `<svg viewBox="0 0 60 60" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
      <polygon points="30,52 50,12 10,12" fill="none" stroke="#3a6a9a" stroke-width="1.2"/>
      <polygon points="30,40 42,12 18,12" fill="none" stroke="#3a6a9a" stroke-width=".6" opacity=".4"/>
      <circle cx="30" cy="26" r="6" fill="none" stroke="#3a6a9a" stroke-width=".5" opacity=".3"/>
      <path d="M18,50 Q24,44 30,50 Q36,56 42,50" fill="none" stroke="#3a6a9a" stroke-width=".5" opacity=".3"/>
    </svg>`,
  };

  const c = document.createElement('div');
  c.style.cssText = 'width:520px;color:#1a1a18;font-family:"Noto Serif SC","Cormorant Garamond",serif;padding:0;font-size:14px;position:relative;';
  document.body.appendChild(c);

  c.innerHTML = `
    <div style="position:relative;overflow:hidden;padding:40px 36px;background:#faf7f0;background-image:url('data:image/svg+xml,${encodeURIComponent(`<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><filter id="n"><feTurbulence baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .92 0 0 0 0 .89 0 0 0 0 .84 0 0 0 .08 0"/></filter><rect width="200" height="200" filter="url(#n)"/></svg>`)}');">

      <!-- Header -->
      <div style="text-align:center;margin-bottom:28px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#c4a265;letter-spacing:6px;margin-bottom:8px;">ANATOMYSELF</div>
        <div style="font-size:11px;color:#b8963e;letter-spacing:10px;font-weight:300;margin-bottom:4px;">${isEn?'W E E K L Y   E N E R G Y':'一 周 能 量 指 引'}</div>
        <div style="width:60px;height:1px;background:#c4a265;margin:10px auto;"></div>
        <div style="font-size:10px;color:#999;letter-spacing:2px;">${date} · ${bazi.dm}(${bazi.dme})</div>
      </div>

      <!-- Five Element Bar -->
      <div style="height:2px;background:linear-gradient(90deg,#4a8a4a,#c45a30,#a08a50,#9898a8,#3a6a9a);margin-bottom:24px;border-radius:1px;opacity:.6;"></div>

      <!-- Day Cards -->
      ${weekDays.map((d, idx) => {
        const arch = ARCHETYPE[d.rel] || ARCHETYPE.Companion;
        const oracle = getOracle(d.rel, d.energy);
        const barColor = d.energy>=80?'#2a6a4a':d.energy>=60?'#b08a20':'#a03030';
        const isToday = idx === 0;

        return `
        <div style="
          margin-bottom:10px; padding:14px 16px;
          background:${isToday ? 'rgba(196,162,101,.06)' : 'rgba(255,255,255,.3)'};
          border:1px solid ${isToday ? 'rgba(196,162,101,.25)' : 'rgba(196,162,101,.08)'};
          border-radius:2px; position:relative;
        ">
          ${isToday ? '<div style="position:absolute;top:6px;right:10px;font-family:\'JetBrains Mono\',monospace;font-size:7px;color:#c4a265;letter-spacing:2px;opacity:.7;">TODAY</div>' : ''}
          
          <div style="display:flex;align-items:center;gap:14px;">
            <!-- Date -->
            <div style="width:44px;text-align:center;">
              <div style="font-size:16px;color:#333;font-weight:500;line-height:1;">${d.date}</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#999;margin-top:2px;">${isEn?d.weekdayEn:'周'+d.weekday}</div>
            </div>

            <!-- Sigil -->
            <div style="width:48px;display:flex;justify-content:center;align-items:center;">
              ${SIGIL[d.el]||`<span style="font-size:22px;color:${EC[d.el]};">${d.el}</span>`}
            </div>

            <!-- Pillar + Archetype -->
            <div style="flex:1;">
              <div style="display:flex;align-items:baseline;gap:8px;">
                <span style="font-size:15px;color:#1a1a18;font-weight:500;">${d.gan}${d.zhi}</span>
                <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:${EC[d.el]};letter-spacing:1px;">${isEn?arch.en:arch.zh}</span>
              </div>
              <div style="font-size:10px;color:#888;font-style:italic;margin-top:2px;">${isEn?arch.desc_en:arch.desc_zh}</div>
            </div>

            <!-- Energy Arc -->
            <div style="width:55px;text-align:right;">
              <div style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:300;color:${barColor};line-height:1;">${d.energy}<span style="font-size:10px;">%</span></div>
              <div style="height:3px;background:rgba(0,0,0,.06);border-radius:2px;margin-top:4px;overflow:hidden;">
                <div style="height:100%;width:${d.energy}%;background:${barColor};border-radius:2px;"></div>
              </div>
            </div>
          </div>

          <!-- Oracle -->
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(196,162,101,.08);">
            <div style="font-size:11px;color:#6a5a35;font-style:italic;line-height:1.5;padding-left:58px;">
              "${oracle}"
            </div>
          </div>
        </div>`;
      }).join('')}

      <!-- Footer -->
      <div style="margin-top:20px;text-align:center;">
        <div style="width:40px;height:1px;background:#c4a265;margin:0 auto 10px;opacity:.4;"></div>
        <div style="font-size:8px;color:#bbb;line-height:1.6;">
          ${isEn?'Based on traditional BaZi Five Element analysis · Cultural reference only':'基于传统八字五行推演 · 仅供文化参考'}
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:#ddd;margin-top:4px;letter-spacing:3px;">anatomyself.com</div>
      </div>
    </div>
  `;

  await htmlToPDF(c, `AnatomySelf_WeeklyGuide_${date.replace(/[\.\/ ]/g,'')}.pdf`);
}
