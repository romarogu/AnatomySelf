import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';

// Register fonts — using web-safe embedded fonts
Font.register({
  family: 'Serif',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-serif@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-serif@latest/latin-700-normal.ttf', fontWeight: 700 },
  ],
});

Font.register({
  family: 'Mono',
  src: 'https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest/latin-400-normal.ttf',
});

const gold = '#c4a265';
const bone = '#e0dcd4';
const dark = '#08080a';
const muted = '#9a9488';
const green = '#52b09a';
const red = '#c44040';
const amber = '#d4a840';

const s = StyleSheet.create({
  page: {
    backgroundColor: dark,
    color: bone,
    fontFamily: 'Serif',
    fontSize: 9,
    padding: '40 45',
    position: 'relative',
  },
  // Watermark
  watermark: {
    position: 'absolute',
    top: '45%',
    left: '20%',
    fontSize: 48,
    color: 'rgba(196,162,101,0.03)',
    fontFamily: 'Mono',
    letterSpacing: 12,
    transform: 'rotate(-30deg)',
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottom: `0.5 solid ${gold}33`,
    paddingBottom: 12,
    marginBottom: 20,
  },
  brandName: {
    fontFamily: 'Mono',
    fontSize: 14,
    color: gold,
    letterSpacing: 3,
  },
  brandSub: {
    fontSize: 7,
    color: muted,
    letterSpacing: 2,
    marginTop: 3,
  },
  headerRight: {
    textAlign: 'right',
  },
  headerMeta: {
    fontFamily: 'Mono',
    fontSize: 7,
    color: '#5e5a52',
    marginBottom: 2,
  },
  // Section
  sectionTitle: {
    fontFamily: 'Mono',
    fontSize: 7,
    color: '#6a5a35',
    letterSpacing: 3,
    marginBottom: 8,
    marginTop: 16,
  },
  // Sentinel
  sentinel: {
    fontSize: 11,
    color: bone,
    lineHeight: 1.6,
    padding: '10 14',
    borderLeft: `2 solid ${gold}`,
    backgroundColor: '#16161c',
    marginBottom: 14,
  },
  // Impact card
  impactCard: {
    flexDirection: 'row',
    marginBottom: 8,
    borderLeft: `2 solid ${gold}`,
    backgroundColor: '#16161c',
  },
  impactLeft: {
    flex: 1,
    padding: '8 12',
    borderRight: `0.5 solid ${gold}15`,
  },
  impactRight: {
    flex: 1,
    padding: '8 12',
  },
  impactLabel: {
    fontFamily: 'Mono',
    fontSize: 6,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  impactText: {
    fontSize: 8,
    color: '#d0ccc4',
    lineHeight: 1.6,
  },
  impactAction: {
    fontSize: 7.5,
    marginTop: 3,
  },
  // Metrics table
  metricRow: {
    flexDirection: 'row',
    padding: '4 8',
    marginBottom: 2,
    backgroundColor: '#16161c',
  },
  metricName: {
    flex: 2,
    fontSize: 8,
    color: bone,
  },
  metricVal: {
    flex: 1,
    fontSize: 8,
    fontFamily: 'Mono',
    textAlign: 'right',
  },
  metricUnit: {
    flex: 1,
    fontSize: 7,
    color: '#5e5a52',
    textAlign: 'right',
  },
  // Temporal
  dateItem: {
    fontSize: 8,
    color: amber,
    marginBottom: 4,
    lineHeight: 1.5,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 45,
    right: 45,
    textAlign: 'center',
    fontSize: 6,
    color: '#3a3832',
    borderTop: `0.5 solid ${gold}15`,
    paddingTop: 8,
  },
  disclaimer: {
    fontSize: 6,
    color: '#4a4a44',
    lineHeight: 1.5,
    marginTop: 12,
    padding: '6 10',
    borderLeft: `1 solid ${gold}20`,
  },
});

// System color map
const sysColors = { '木': '#4a8a4a', '火': '#c45a30', '土': '#a08a50', '金': '#9898a8', '水': '#3a6a9a' };
const sysNames = {
  en: { '木': 'Hepatic / Vitality', '火': 'Cardiovascular', '土': 'Digestive / Metabolic', '金': 'Respiratory', '水': 'Renal / Endocrine' },
  zh: { '木': '肝胆系统', '火': '心血管系统', '土': '脾胃代谢', '金': '呼吸系统', '水': '肾脏内分泌' },
};

function LifeBlueprintDoc({ data, locale }) {
  const { user, age, sex, bazi, dy, ln, sci, dst, metrics, colls, reportId, date } = data;
  const isEn = locale === 'en';
  const RR_EN_SHORT = data.RR_EN_SHORT || {};
  const gR = data.gR;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Watermark */}
        <Text style={s.watermark}>ANATOMYSELF</Text>

        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.brandName}>ANATOMYSELF</Text>
            <Text style={s.brandSub}>{isEn ? 'LIFE BLUEPRINT REPORT' : '生命蓝图报告'}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerMeta}>{user} · {age}{isEn ? 'y/o' : '岁'} {isEn ? (sex === 'M' ? 'Male' : 'Female') : (sex === 'M' ? '男' : '女')}</Text>
            <Text style={s.headerMeta}>{isEn ? 'Day Master' : '日主'}: {bazi.dm}({bazi.dme}) · {dy.lbl} · {ln.lbl}</Text>
            <Text style={s.headerMeta}>ID: {reportId} · {date}</Text>
          </View>
        </View>

        {/* Layer 1: Top Sentinel */}
        {(sci?.sentinel || sci?.summary) && (
          <>
            <Text style={s.sectionTitle}>TOP SENTINEL</Text>
            <View style={s.sentinel}>
              <Text>{sci.sentinel || sci.summary}</Text>
            </View>
          </>
        )}

        {/* Metrics Overview */}
        <Text style={s.sectionTitle}>{isEn ? 'CLINICAL BIOMARKERS' : '临床指标'}</Text>
        {metrics.filter(m => m.value != null).map(m => {
          const ref = gR ? gR(m.key, age, sex === 'M' ? 'M' : 'F') : null;
          const inR = ref && m.value >= ref.l && m.value <= ref.h;
          const name = isEn ? (RR_EN_SHORT[m.key] || m.key) : (ref?.cn || m.key);
          return (
            <View key={m.key} style={s.metricRow}>
              <Text style={s.metricName}>{name}</Text>
              <Text style={{ ...s.metricVal, color: inR ? green : red }}>{m.value}</Text>
              <Text style={s.metricUnit}>{ref?.u || ''}</Text>
            </View>
          );
        })}

        {/* Layer 2: Impact Cards */}
        {(sci?.items?.length > 0 || dst?.collision_items?.length > 0) && (
          <>
            <Text style={s.sectionTitle}>IMPACT ANALYSIS</Text>
            {['火', '土', '金', '水', '木'].map(el => {
              const sciItem = (sci?.items || []).find(it => it.organ_system === el);
              const dstItem = (dst?.collision_items || []).find(it => it.organ_wuxing === el);
              if (!sciItem && !dstItem) return null;
              return (
                <View key={el} style={{ ...s.impactCard, borderLeftColor: sysColors[el] || gold }}>
                  <View style={s.impactLeft}>
                    <Text style={{ ...s.impactLabel, color: green }}>CLINICAL · {(isEn ? sysNames.en : sysNames.zh)[el]}</Text>
                    <Text style={s.impactText}>{sciItem?.clinical_fact || sciItem?.physiological_analysis || '—'}</Text>
                    {sciItem?.recommendation && <Text style={{ ...s.impactAction, color: green }}>→ {sciItem.recommendation}</Text>}
                  </View>
                  <View style={s.impactRight}>
                    <Text style={{ ...s.impactLabel, color: gold }}>ENERGETIC</Text>
                    <Text style={s.impactText}>{dstItem?.current_forces || '—'}</Text>
                    {dstItem?.prevention && <Text style={{ ...s.impactAction, color: gold }}>→ {dstItem.prevention}</Text>}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Layer 3: Temporal Outlook */}
        {dst?.temporal_outlook && (
          <>
            <Text style={s.sectionTitle}>TEMPORAL OUTLOOK</Text>
            <Text style={{ fontSize: 8, color: muted, lineHeight: 1.7, marginBottom: 8 }}>{dst.temporal_outlook}</Text>
          </>
        )}

        {dst?.key_dates?.length > 0 && (
          <>
            <Text style={s.sectionTitle}>{isEn ? 'KEY TEMPORAL NODES' : '关键时间节点'}</Text>
            {dst.key_dates.map((d, i) => (
              <Text key={i} style={s.dateItem}>▪ {d}</Text>
            ))}
          </>
        )}

        {/* Disclaimer */}
        <View style={s.disclaimer}>
          <Text>{isEn
            ? 'Science Brain: AI interpretation of clinical data. For reference only — not medical advice. Meta Brain: Based on traditional BaZi metaphysics. Cultural reference only — not scientifically validated.'
            : '科学脑：AI解读仅供参考，不构成医疗建议。命理脑：传统命理推演，属文化参考。'
          }</Text>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text>ANATOMYSELF · {isEn ? 'Decode Your Biological Blueprint' : '解码你的生命蓝图'} · {date}</Text>
        </View>
      </Page>
    </Document>
  );
}

// Export PDF generation function
export async function generateLifeBlueprintPDF(data, locale) {
  const doc = <LifeBlueprintDoc data={data} locale={locale} />;
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AnatomySelf_LifeBlueprint_${data.date.replace(/\./g, '')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
