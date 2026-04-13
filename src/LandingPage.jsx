import { useI18n } from "./i18n/index.jsx";
import { useEffect } from "react";

const L = {
  en: {
    eyebrow: "DUAL-BRAIN HEALTH INTELLIGENCE",
    h1a: "Decode Your", h1b: "Biological Blueprint",
    sub: "Where 3,000 years of Eastern wisdom meets modern clinical biomarkers. One analysis. Two perspectives. Your complete picture.",
    cta: "BEGIN FREE ANALYSIS",
    premiseTag: "THE PREMISE",
    premiseH: ["Your lab report tells you ", "what", ".", "Your birth chart tells you ", "why", "."],
    premiseP: "AnatomySelf runs your clinical biomarkers through a Science Brain (AI clinical analysis) and a Meta Brain (traditional BaZi energetics) — then collides them to find patterns neither could see alone.",
    sciTitle: "Science Brain", sciSub: "CLINICAL LAYER · BIOSELF",
    sciDesc: "AI-powered analysis of 15 standardized biomarkers across five organ systems. Age and sex-adjusted reference ranges. Precise clinical language.",
    metaTitle: "Meta Brain", metaSub: "ENERGETIC LAYER · METASELF",
    metaDesc: "Traditional Four Pillars analysis mapping your constitutional energy blueprint. Major cycles, annual influences, and organ-element correlations spanning millennia of pattern recognition.",
    howTag: "HOW IT WORKS",
    steps: [
      ["01", "Enter your birth time", "Date, hour, and one biomarker — your resting heart rate. Two fingers on your wrist. That's all you need."],
      ["02", "Dual-Brain Analysis fires", "Science Brain processes clinical data. Meta Brain maps your energetic blueprint. Then they collide — debating your results in real-time."],
      ["03", "Your Life Blueprint emerges", "A resonance radar reveals where your clinical reality and constitutional energy align — or diverge. Impact cards show what matters most."],
      ["04", "Go deeper with lab data", "Start with Discovery Mode for free. Upload your lab report anytime to unlock full clinical collision analysis."],
    ],
    quote: '"The only system that told me my ALT elevation and my Wood-Fire clash were the same story told in two languages."',
    quoteAttr: "— EARLY ACCESS USER · SINGAPORE",
    finalH: "Your blueprint is waiting.",
    finalP: "No credit card. No lab data required. Just your birth time.",
    footer1: "ANATOMYSELF · DUAL-BRAIN HEALTH INTELLIGENCE",
    footer2: "Science Brain: reference only, not medical advice. Meta Brain: cultural reference, not scientifically validated.",
    sciItems: [["Hepatocellular markers","ALT · AST · TBIL"],["Cardiovascular strain","SBP · DBP · RHR"],["Metabolic panel","FBG · HbA1c · TG"],["Respiratory function","FVC · SpO2 · LDL-C"],["Renal & endocrine","Cr · UA · VitD"]],
    metaItems: [["Four Pillars","Year · Month · Day · Hour"],["Five Elements","Wood · Fire · Earth · Metal · Water"],["Temporal Cycles","Major · Annual · Monthly"],["Organ Mapping","Liver · Heart · Spleen · Lung · Kidney"],["Collision Engine","Clinical × Energetic overlay"]],
  },
  zh: {
    eyebrow: "双脑健康智能系统",
    h1a: "解码你的", h1b: "生命蓝图",
    sub: "三千年东方智慧与现代临床指标的交汇。一次分析，两个视角，你的完整图景。",
    cta: "开始免费分析",
    premiseTag: "核心理念",
    premiseH: ["体检报告告诉你「", "是什么", "」。", "八字命盘告诉你「", "为什么", "」。"],
    premiseP: "AnatomySelf 用科学脑（AI 临床分析）和命理脑（传统八字能量学）同时处理你的健康数据——然后让它们对撞，发现单一视角看不到的模式。",
    sciTitle: "科学脑", sciSub: "临床层 · BIOSELF",
    sciDesc: "AI 驱动的 15 项标准化指标分析，覆盖五大脏器系统。年龄与性别校正参考范围。精准临床术语。",
    metaTitle: "命理脑", metaSub: "能量层 · METASELF",
    metaDesc: "传统四柱八字分析，映射先天能量蓝图。大运流年影响，脏腑五行对应，跨越千年的模式识别。",
    howTag: "使用流程",
    steps: [
      ["01", "输入出生时间", "日期、时辰，加一个生物标记——静息心率。两根手指搭在手腕上就能测。"],
      ["02", "双脑分析启动", "科学脑处理临床数据，命理脑映射能量蓝图。然后它们碰撞——实时辩证你的结果。"],
      ["03", "生命蓝图浮现", "共振雷达揭示你的临床现实与先天能量在哪里一致、在哪里分歧。"],
      ["04", "上传体检深入分析", "先用探索模式免费体验。随时上传体检报告，解锁完整的临床对撞分析。"],
    ],
    quote: '"唯一一个告诉我，ALT 升高和木火相克其实是同一个故事的两种语言的系统。"',
    quoteAttr: "— 内测用户 · 新加坡",
    finalH: "你的蓝图在等你。",
    finalP: "无需信用卡。无需体检数据。只需出生时间。",
    footer1: "ANATOMYSELF · 双脑健康智能",
    footer2: "科学脑仅供参考，不构成医疗建议。命理脑基于传统命理学，属文化参考。",
    sciItems: [["肝细胞损伤","ALT · AST · TBIL"],["心血管负荷","SBP · DBP · RHR"],["代谢综合征","FBG · HbA1c · TG"],["呼吸功能","FVC · SpO2 · LDL-C"],["肾脏内分泌","Cr · UA · VitD"]],
    metaItems: [["四柱","年柱 · 月柱 · 日柱 · 时柱"],["五行","木 · 火 · 土 · 金 · 水"],["时运周期","大运 · 流年 · 流月"],["脏腑映射","肝 · 心 · 脾 · 肺 · 肾"],["对撞引擎","临床 × 能量 叠加"]],
  },
};

// Animated radar SVG for hero
function HeroRadar() {
  return (
    <svg viewBox="0 0 400 400" style={{ width:"100%", maxWidth:360, height:"auto", margin:"0 auto", display:"block" }}>
      <defs>
        <radialGradient id="rg1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#c4a265" stopOpacity=".06"/><stop offset="100%" stopColor="#c4a265" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="200" cy="200" r="180" fill="url(#rg1)"/>
      {/* Grid rings */}
      {[1,.75,.5,.25].map(s => {
        const r = 140*s;
        const pts = [0,1,2,3,4].map(i => {
          const a = (i*2*Math.PI/5)-Math.PI/2;
          return `${200+r*Math.cos(a)},${200+r*Math.sin(a)}`;
        }).join(" ");
        return <polygon key={s} points={pts} fill="none" stroke="#c4a265" strokeWidth=".4" opacity={s*.3}/>;
      })}
      {/* Axes */}
      {[0,1,2,3,4].map(i => {
        const a = (i*2*Math.PI/5)-Math.PI/2;
        return <line key={i} x1="200" y1="200" x2={200+140*Math.cos(a)} y2={200+140*Math.sin(a)} stroke="#c4a265" strokeWidth=".3" opacity=".15"/>;
      })}
      {/* Destiny polygon — animated */}
      <polygon points={[85,60,45,70,90].map((v,i)=>{const a=(i*2*Math.PI/5)-Math.PI/2;return `${200+140*(v/100)*Math.cos(a)},${200+140*(v/100)*Math.sin(a)}`;}).join(" ")}
        fill="rgba(196,162,101,.06)" stroke="#c4a265" strokeWidth="1.2" opacity=".6">
        <animate attributeName="opacity" values=".4;.7;.4" dur="6s" repeatCount="indefinite"/>
      </polygon>
      {/* Medical polygon — dashed */}
      <polygon points={[70,50,80,55,65].map((v,i)=>{const a=(i*2*Math.PI/5)-Math.PI/2;return `${200+140*(v/100)*Math.cos(a)},${200+140*(v/100)*Math.sin(a)}`;}).join(" ")}
        fill="rgba(224,220,212,.03)" stroke="#e0dcd4" strokeWidth=".8" strokeDasharray="5 4" opacity=".4">
        <animate attributeName="opacity" values=".25;.5;.25" dur="8s" repeatCount="indefinite"/>
      </polygon>
      {/* Labels */}
      {[["Cardio","#c45a30",0],["Metabolic","#a08a50",1],["Respiratory","#9898a8",2],["Renal","#3a6a9a",3],["Hepatic","#4a8a4a",4]].map(([lb,c,i])=>{
        const a=(i*2*Math.PI/5)-Math.PI/2;
        return <text key={lb} x={200+165*Math.cos(a)} y={200+165*Math.sin(a)+4} textAnchor="middle" fill={c} fontSize="11" fontFamily="'JetBrains Mono',monospace" opacity=".6">{lb}</text>;
      })}
      {/* Center glow */}
      <circle cx="200" cy="200" r="4" fill="#c4a265" opacity=".3">
        <animate attributeName="r" values="3;6;3" dur="4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".2;.5;.2" dur="4s" repeatCount="indefinite"/>
      </circle>
    </svg>
  );
}

export default function LandingPage({ onEnter }) {
  const { locale, toggleLang } = useI18n();
  const t = L[locale] || L.en;

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('lp-visible'); obs.unobserve(e.target); }});
    }, { threshold: 0.1 });
    document.querySelectorAll('.lp-fade').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div style={{ minHeight:"100vh", background:"#08080a", color:"#e0dcd4", fontFamily:"'Noto Serif SC',serif", overflowX:"hidden" }}>
      <style>{`
        .lp-fade{opacity:0;transform:translateY(18px);transition:opacity .7s ease,transform .7s ease}
        .lp-fade.lp-visible{opacity:1;transform:translateY(0)}
        .lp-cta{transition:all .3s !important}
        .lp-cta:hover{background:rgba(196,162,101,.08) !important;border-color:rgba(196,162,101,.5) !important;transform:translateY(-1px)}
        @media(max-width:860px){.lp-hero-grid{flex-direction:column !important;text-align:center}.lp-dual{flex-direction:column !important}}
      `}</style>

      {/* NAV */}
      <nav style={{ position:"fixed", top:0, width:"100%", zIndex:90, padding:"16px 40px", display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(8,8,10,.8)", backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(196,162,101,.06)" }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, color:"#c4a265", letterSpacing:3 }}>ANATOMYSELF</div>
        <div style={{ display:"flex", gap:20, alignItems:"center" }}>
          <button onClick={toggleLang} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#9a9488", letterSpacing:1, cursor:"pointer", background:"none", border:"none" }}>{locale==='en'?'中文':'EN'}</button>
          <button onClick={onEnter} className="lp-cta" style={{ padding:"10px 24px", border:"1px solid rgba(196,162,101,.3)", color:"#c4a265", fontFamily:"'JetBrains Mono',monospace", fontSize:12, letterSpacing:1.5, cursor:"pointer", background:"transparent" }}>{t.cta}</button>
        </div>
      </nav>

      {/* HERO — two column */}
      <section style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"100px 48px 60px",
        backgroundImage:"radial-gradient(ellipse 700px 500px at 40% 45%,rgba(196,162,101,.035),transparent),linear-gradient(rgba(196,162,101,.01) 1px,transparent 1px),linear-gradient(90deg,rgba(196,162,101,.01) 1px,transparent 1px)", backgroundSize:"100%,52px 52px,52px 52px" }}>
        <div className="lp-hero-grid" style={{ display:"flex", alignItems:"center", gap:60, maxWidth:1100, width:"100%" }}>
          {/* Left: text */}
          <div style={{ flex:1, minWidth:0 }}>
            <div className="lp-fade" style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#6a5a35", letterSpacing:5, marginBottom:28 }}>{t.eyebrow}</div>
            <h1 className="lp-fade" style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(40px,5.5vw,64px)", fontWeight:300, letterSpacing:".06em", lineHeight:1.15, color:"#e0dcd4", marginBottom:24 }}>
              {t.h1a}<br/><em style={{ fontStyle:"italic", color:"#c4a265", fontWeight:400 }}>{t.h1b}</em>
            </h1>
            <p className="lp-fade" style={{ fontSize:18, color:"#b0aca4", maxWidth:480, lineHeight:1.8, fontWeight:300, marginBottom:40 }}>{t.sub}</p>
            <button className="lp-fade lp-cta" onClick={onEnter} style={{ display:"inline-flex", alignItems:"center", gap:12, padding:"16px 40px", border:"1px solid rgba(196,162,101,.35)", color:"#c4a265", fontFamily:"'JetBrains Mono',monospace", fontSize:13, letterSpacing:2, cursor:"pointer", background:"transparent" }}>
              {t.cta}
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.2"/></svg>
            </button>
          </div>
          {/* Right: animated radar */}
          <div className="lp-fade" style={{ flex:1, maxWidth:380, minWidth:280 }}>
            <HeroRadar />
          </div>
        </div>
      </section>

      {/* PREMISE */}
      <section className="lp-fade" style={{ padding:"100px 48px", textAlign:"center" }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#6a5a35", letterSpacing:4, marginBottom:28 }}>{t.premiseTag}</div>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(26px,3.5vw,36px)", fontWeight:300, color:"#e0dcd4", maxWidth:650, margin:"0 auto 20px", lineHeight:1.4, letterSpacing:".04em" }}>
          {t.premiseH[0]}<em style={{ color:"#c4a265", fontStyle:"italic" }}>{t.premiseH[1]}</em>{t.premiseH[2]}<br/>
          {t.premiseH[3]}<em style={{ color:"#c4a265", fontStyle:"italic" }}>{t.premiseH[4]}</em>{t.premiseH[5]}
        </h2>
        <p style={{ fontSize:17, color:"#b0aca4", maxWidth:560, margin:"0 auto", lineHeight:1.8 }}>{t.premiseP}</p>
      </section>

      {/* DUAL BRAIN */}
      <section className="lp-dual" style={{ padding:"60px 48px", display:"flex", justifyContent:"center", gap:0, maxWidth:1000, margin:"0 auto" }}>
        {/* Science */}
        <div className="lp-fade" style={{ flex:1, padding:"48px 40px", border:"1px solid rgba(82,176,154,.1)", borderRight:"none" }}>
          <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(82,176,154,.08)", border:"1px solid rgba(82,176,154,.2)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20, fontSize:20 }}>
            <span style={{ color:"#52b09a" }}>◎</span>
          </div>
          <h3 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:400, color:"#52b09a", marginBottom:8, letterSpacing:".04em" }}>{t.sciTitle}</h3>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#5e5a52", letterSpacing:2, marginBottom:20 }}>{t.sciSub}</div>
          <p style={{ fontSize:16, color:"#b0aca4", lineHeight:1.8, marginBottom:20 }}>{t.sciDesc}</p>
          <ul style={{ listStyle:"none", padding:0 }}>
            {t.sciItems.map(([lb, codes]) => (
              <li key={lb} style={{ fontSize:14, color:"#6a6560", padding:"8px 0", borderBottom:"1px solid rgba(82,176,154,.06)", fontFamily:"'JetBrains Mono',monospace" }}>
                <span style={{ color:"#d0ccc4", fontFamily:"'Noto Serif SC',serif" }}>{lb}</span>
                <span style={{ float:"right", fontSize:12, color:"#52b09a" }}>{codes}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* Meta */}
        <div className="lp-fade" style={{ flex:1, padding:"48px 40px", border:"1px solid rgba(196,162,101,.1)" }}>
          <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(196,162,101,.08)", border:"1px solid rgba(196,162,101,.2)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20, fontSize:20 }}>
            <span style={{ color:"#c4a265" }}>☯</span>
          </div>
          <h3 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:400, color:"#c4a265", marginBottom:8, letterSpacing:".04em" }}>{t.metaTitle}</h3>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#5e5a52", letterSpacing:2, marginBottom:20 }}>{t.metaSub}</div>
          <p style={{ fontSize:16, color:"#b0aca4", lineHeight:1.8, marginBottom:20 }}>{t.metaDesc}</p>
          <ul style={{ listStyle:"none", padding:0 }}>
            {t.metaItems.map(([lb, codes]) => (
              <li key={lb} style={{ fontSize:14, color:"#6a6560", padding:"8px 0", borderBottom:"1px solid rgba(196,162,101,.06)", fontFamily:"'JetBrains Mono',monospace" }}>
                <span style={{ color:"#d0ccc4", fontFamily:"'Noto Serif SC',serif" }}>{lb}</span>
                <span style={{ float:"right", fontSize:12, color:"#c4a265" }}>{codes}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Five-element color bar */}
      <div style={{ height:3, maxWidth:800, margin:"0 auto", background:"linear-gradient(90deg, #4a8a4a, #c45a30, #a08a50, #9898a8, #3a6a9a)", borderRadius:2, opacity:.4 }}/>

      {/* HOW IT WORKS */}
      <section style={{ padding:"100px 48px", maxWidth:800, margin:"0 auto" }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#6a5a35", letterSpacing:4, textAlign:"center", marginBottom:48 }}>{t.howTag}</div>
        {t.steps.map(([num, title, desc], i) => (
          <div key={num}>
            <div className="lp-fade" style={{ display:"flex", gap:28, marginBottom:32, alignItems:"flex-start" }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:"#c4a265", minWidth:44, paddingTop:3, letterSpacing:2 }}>{num}</div>
              <div>
                <h4 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:400, color:"#e0dcd4", marginBottom:8, letterSpacing:".03em" }}>{title}</h4>
                <p style={{ fontSize:16, color:"#b0aca4", lineHeight:1.7 }}>{desc}</p>
              </div>
            </div>
            {i < t.steps.length - 1 && <div style={{ height:1, background:"linear-gradient(90deg,rgba(196,162,101,.06),transparent)", margin:"0 0 32px 72px" }}/>}
          </div>
        ))}
      </section>

      {/* SOCIAL PROOF */}
      <section className="lp-fade" style={{ padding:"80px 48px", textAlign:"center", borderTop:"1px solid rgba(196,162,101,.05)", borderBottom:"1px solid rgba(196,162,101,.05)" }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:300, fontStyle:"italic", color:"#e0dcd4", maxWidth:600, margin:"0 auto 20px", lineHeight:1.5 }}>{t.quote}</div>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#6a5a35", letterSpacing:3 }}>{t.quoteAttr}</div>
      </section>

      {/* FINAL CTA */}
      <section className="lp-fade" style={{ padding:"120px 48px", textAlign:"center" }}>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:38, fontWeight:300, color:"#e0dcd4", marginBottom:14, letterSpacing:".05em" }}>{t.finalH}</h2>
        <p style={{ fontSize:17, color:"#b0aca4", marginBottom:36 }}>{t.finalP}</p>
        <button onClick={onEnter} className="lp-cta" style={{ display:"inline-flex", alignItems:"center", gap:12, padding:"18px 52px", border:"1px solid rgba(196,162,101,.35)", color:"#c4a265", fontFamily:"'JetBrains Mono',monospace", fontSize:14, letterSpacing:2, cursor:"pointer", background:"transparent" }}>
          {t.cta}
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.2"/></svg>
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{ padding:40, textAlign:"center", borderTop:"1px solid rgba(196,162,101,.04)" }}>
        <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#3a3832", letterSpacing:2 }}>{t.footer1}</p>
        <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#2a2a2a", letterSpacing:1, marginTop:8 }}>{t.footer2}</p>
      </footer>
    </div>
  );
}
