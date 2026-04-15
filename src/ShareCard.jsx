import html2canvas from 'html2canvas';

const EC = {"木":"#4a8a4a","火":"#c45a30","土":"#a08a50","金":"#9898a8","水":"#3a6a9a"};

// Element English names
const elEn = {"木":"Wood","火":"Fire","土":"Earth","金":"Metal","水":"Water"};

// Day Master archetypes — mysterious, cold, scientific
const archetypes = {
  en: {
    "甲":"The Towering Tree — growth through resistance",
    "乙":"The Climbing Vine — adaptability as strategy",
    "丙":"The Sun — radiance that cannot be concealed",
    "丁":"The Candle Flame — precision illumination",
    "戊":"The Mountain — immovable center of gravity",
    "己":"The Fertile Valley — transformation through absorption",
    "庚":"The Blade — structure forged under pressure",
    "辛":"The Gemstone — refinement through constraint",
    "壬":"The Ocean — depth that absorbs all currents",
    "癸":"The Morning Dew — subtle influence, profound reach",
  },
  zh: {
    "甲":"参天之木 — 逆势而生",
    "乙":"攀援之藤 — 以柔克刚",
    "丙":"太阳之火 — 光芒不可遮蔽",
    "丁":"烛台之焰 — 精准照亮暗处",
    "戊":"不动之山 — 万物的重力中心",
    "己":"沃野之土 — 在吸收中转化",
    "庚":"锻造之刃 — 压力下成形",
    "辛":"璞玉之金 — 约束中精炼",
    "壬":"大洋之水 — 深邃吞纳百川",
    "癸":"晨露之水 — 微妙影响，深远抵达",
  },
};

export function ShareCard({ bazi, destWX, locale, onClose }) {
  const isEn = locale === 'en';
  const dm = bazi.dm;
  const dme = bazi.dme;
  const archetype = (isEn ? archetypes.en : archetypes.zh)[dm] || '';
  
  // Calculate Energy Defense Index (weighted harmony score)
  const vals = Object.values(destWX);
  const avg = vals.reduce((a,b)=>a+b,0) / 5;
  const variance = vals.reduce((a,v)=>a+Math.abs(v-avg),0) / 5;
  const edi = Math.round(Math.max(0, 100 - variance * 2));

  const handleShare = async () => {
    const card = document.getElementById('share-card-render');
    if (!card) return;
    
    const canvas = await html2canvas(card, { backgroundColor:'#08080a', scale:3, useCORS:true });
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    
    // Try Web Share API first (mobile)
    if (navigator.share && blob) {
      try {
        const file = new File([blob], 'anatomyself-blueprint.png', { type:'image/png' });
        await navigator.share({ title:'My Biological Blueprint', files:[file] });
        return;
      } catch {}
    }
    
    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'anatomyself-blueprint.png'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(8,8,10,.9)', backdropFilter:'blur(8px)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 }}>
      
      {/* Renderable card */}
      <div id="share-card-render" style={{
        width:360, padding:'40px 32px', background:'#08080a', fontFamily:"'Noto Serif SC',serif",
        border:'1px solid rgba(196,162,101,.12)',
      }}>
        {/* Brand */}
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'#3a3832', letterSpacing:4, textAlign:'center', marginBottom:24 }}>ANATOMYSELF</div>
        
        {/* Day Master */}
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:48, color:EC[dme], fontWeight:300, lineHeight:1 }}>{dm}</div>
          <div style={{ fontSize:13, color:'#9a9488', marginTop:8, fontStyle:'italic', fontFamily:"'Cormorant Garamond',serif" }}>{archetype}</div>
        </div>

        {/* Five Element bars */}
        <div style={{ marginBottom:24 }}>
          {['木','火','土','金','水'].map(el => (
            <div key={el} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:EC[el], width:40, textAlign:'right' }}>
                {isEn ? elEn[el] : el}
              </span>
              <div style={{ flex:1, height:3, background:'#16161c', borderRadius:1 }}>
                <div style={{ height:'100%', width:`${destWX[el]||0}%`, background:EC[el], borderRadius:1, opacity:.7 }}/>
              </div>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#5e5a52', width:28 }}>
                {Math.round(destWX[el]||0)}%
              </span>
            </div>
          ))}
        </div>

        {/* Energy Defense Index */}
        <div style={{ textAlign:'center', padding:'16px 0', borderTop:'1px solid rgba(196,162,101,.06)', borderBottom:'1px solid rgba(196,162,101,.06)' }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8, color:'#6a5a35', letterSpacing:3, marginBottom:6 }}>
            ENERGY DEFENSE INDEX
          </div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:36, color:'#c4a265', fontWeight:300 }}>{edi}</div>
          <div style={{ fontSize:11, color:'#5e5a52', marginTop:4 }}>
            {edi >= 80 ? (isEn?'Harmonious':'和谐') : edi >= 60 ? (isEn?'Watchful':'留意') : (isEn?'Alert':'警戒')}
          </div>
        </div>

        {/* BaZi string */}
        <div style={{ textAlign:'center', marginTop:16, fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#3a3832', letterSpacing:2 }}>
          {bazi.year[0]}{bazi.year[1]} {bazi.month[0]}{bazi.month[1]} {bazi.day[0]}{bazi.day[1]} {bazi.hour[0]}{bazi.hour[1]}
        </div>
        
        {/* URL */}
        <div style={{ textAlign:'center', marginTop:12, fontFamily:"'JetBrains Mono',monospace", fontSize:8, color:'#2a2a2a', letterSpacing:1 }}>
          anatomyself.com
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display:'flex', gap:12, marginTop:20 }}>
        <button onClick={handleShare} style={{
          padding:'12px 32px', background:'transparent', border:'1px solid rgba(196,162,101,.3)',
          color:'#c4a265', fontFamily:"'JetBrains Mono',monospace", fontSize:12, letterSpacing:1.5, cursor:'pointer'
        }}>
          {isEn ? 'SHARE / DOWNLOAD' : '分享 / 下载'}
        </button>
        <button onClick={onClose} style={{
          padding:'12px 24px', background:'transparent', border:'1px solid rgba(196,162,101,.1)',
          color:'#5e5a52', fontFamily:"'JetBrains Mono',monospace", fontSize:12, cursor:'pointer'
        }}>
          {isEn ? 'CLOSE' : '关闭'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Daily Push Notification Templates
// Tone: mysterious, cold, scientific
// ═══════════════════════════════════════
export const dailyNotifications = {
  // 10 Heavenly Stems — each with EN/ZH template
  "甲": {
    en: "Wood ascends. Your nervous system seeks expansion today — channel growth impulses into structured output. Liver meridian peaks at 1-3 AM.",
    zh: "甲木上升。你的神经系统今日寻求扩展——将生长冲动导入结构化输出。肝经于丑时达到峰值。",
  },
  "乙": {
    en: "Yin Wood bends but does not break. Flexibility is your weapon today. Avoid confrontation — redirect, don't resist. Gallbladder recalibrates.",
    zh: "乙木弯而不折。柔韧是今日的武器。避免正面冲突——转向，不要对抗。胆经重新校准。",
  },
  "丙": {
    en: "Solar Fire dominates. Your cardiovascular output peaks — optimal for high-intensity decisions. Beware: excessive brightness invites shadow. Heart rate may elevate.",
    zh: "丙火当令。心血管输出达到峰值——适合高强度决策。警惕：过度明亮招致阴影。心率可能升高。",
  },
  "丁": {
    en: "Candle Fire illuminates selectively. Today favors precision over power. Small Intestine function heightened — digest information carefully, reject noise.",
    zh: "丁火选择性照亮。今日精准优于力量。小肠功能增强——仔细消化信息，排斥噪音。",
  },
  "戊": {
    en: "Yang Earth stabilizes. Your metabolic grounding strengthens — center of gravity holds firm. Stomach processes slower but deeper. Trust the plateau.",
    zh: "戊土稳固。你的代谢根基加强——重心稳定不动。胃的处理变慢但更深入。信任平台期。",
  },
  "己": {
    en: "Yin Earth absorbs. Today is for intake, not output. Spleen transforms raw experience into usable intelligence. Eat warm. Think slowly. Store energy.",
    zh: "己土吸纳。今日适合摄入，非输出。脾脏将原始经验转化为可用智慧。食温。慢思。储能。",
  },
  "庚": {
    en: "Metal sharpens. Respiratory discipline peaks — your boundaries are your greatest asset today. Cut what doesn't serve. Lung capacity at maximum clearance.",
    zh: "庚金锐利。呼吸纪律达峰——今日边界感是最大资产。删除不服务于你的一切。肺容量最大净化。",
  },
  "辛": {
    en: "Refined Metal gleams under pressure. Large Intestine elimination cycle active — release toxins, grudges, and outdated protocols. Purity through subtraction.",
    zh: "辛金在压力下发光。大肠排泄周期激活——释放毒素、怨气和过时的规则。通过减法达到纯净。",
  },
  "壬": {
    en: "Ocean Water rises. Endocrine depth expands — kidney-adrenal axis recalibrates your survival intelligence. Navigate by instinct today, not logic.",
    zh: "壬水涨潮。内分泌深度扩展——肾-肾上腺轴重新校准你的生存智慧。今日凭直觉导航，非逻辑。",
  },
  "癸": {
    en: "Morning Dew forms. Bladder meridian carries ancestral data to the surface. Subtle signals amplify — pay attention to what your body whispers, not what it screams.",
    zh: "癸水凝露。膀胱经将祖先数据带至表面。微妙信号放大——注意身体的低语，而非呐喊。",
  },
};
