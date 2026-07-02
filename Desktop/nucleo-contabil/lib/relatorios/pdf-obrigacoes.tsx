import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Registra fontes system-safe para evitar dependência de arquivo externo
Font.registerHyphenationCallback((word) => [word]);

const C = {
  ink: "#0f0f0f",
  muted: "#6b7280",
  line: "#e5e7eb",
  panel: "#f9fafb",
  red: "#dc2626",
  redBg: "#fef2f2",
  green: "#16a34a",
  greenBg: "#f0fdf4",
  yellow: "#d97706",
  yellowBg: "#fffbeb",
  blue: "#2563eb",
  blueBg: "#eff6ff",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: C.ink, padding: "32pt 40pt" },
  // cabeçalho
  header: { marginBottom: 20 },
  escritorioNome: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitulo: { fontSize: 10, color: C.muted, marginBottom: 12 },
  metaRow: { flexDirection: "row", gap: 32, marginBottom: 4 },
  metaLabel: { fontSize: 8, color: C.muted, marginBottom: 1 },
  metaValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  divider: { borderBottomWidth: 1, borderBottomColor: C.line, marginBottom: 16 },
  // progresso
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  progressBar: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 8 },
  kpiRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  kpiBox: { flex: 1, padding: "8pt 10pt", borderRadius: 4, borderWidth: 1 },
  kpiLabel: { fontSize: 7, color: C.muted, marginBottom: 2 },
  kpiValue: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  // tabela
  tableHeader: { flexDirection: "row", backgroundColor: C.panel, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line },
  tableRowAtrasada: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.redBg },
  thCell: { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.muted, padding: "5pt 6pt" },
  tdCell: { fontSize: 8.5, padding: "5pt 6pt" },
  tdCellRed: { fontSize: 8.5, padding: "5pt 6pt", color: C.red },
  col1: { width: "28%" },
  col2: { width: "12%" },
  col3: { width: "16%" },
  col4: { width: "20%" },
  col5: { width: "24%" },
  // badge de status
  badgeRow: { flexDirection: "row", alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 3, marginRight: 4 },
  // seção documentos
  docSection: { marginBottom: 16 },
  docObrigacaoHeader: { flexDirection: "row", justifyContent: "space-between", backgroundColor: C.panel, padding: "4pt 6pt", borderTopWidth: 1, borderColor: C.line, marginBottom: 0 },
  docObrigacaoNome: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  docTableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.panel },
  docRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line },
  dcol1: { width: "50%" },
  dcol2: { width: "20%" },
  dcol3: { width: "30%" },
  // rodapé / assinatura
  footer: { position: "absolute", bottom: "24pt", left: "40pt", right: "40pt" },
  footerDivider: { borderTopWidth: 1, borderTopColor: C.line, marginBottom: 8 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  footerLabel: { fontSize: 7, color: C.muted },
  footerValue: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  assinaturaBox: { width: "40%", alignItems: "center" },
  assinaturaLinha: { borderTopWidth: 1, borderTopColor: C.ink, width: "100%", marginBottom: 3, marginTop: 20 },
  pageNum: { fontSize: 7, color: C.muted },
});

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const STATUS_LABEL: Record<string, string> = {
  pendente_documentos: "Pend. docs",
  em_classificacao: "Em classif.",
  gerada: "Gerada",
  entregue: "Entregue",
};

const STATUS_DOT: Record<string, string> = {
  pendente_documentos: C.yellow,
  em_classificacao: C.blue,
  gerada: C.muted,
  entregue: C.green,
};

const TIPO_LABEL: Record<string, string> = {
  nfe: "NF-e",
  extrato: "Extrato",
  recibo: "Recibo",
  outro: "Outro",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function formatPrazo(prazo: string): string {
  const parts = prazo.split("-");
  if (parts.length !== 3 || parts.some((p) => !p)) return prazo;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export type ObrigacaoPDF = {
  id: string;
  tipoCodigo: string;
  tipoNome: string;
  prazo: string;
  status: string;
  atrasada: boolean;
  documentos: { id: string; tipo: string; nomeArquivo: string; criadoEm: string }[];
};

export type RelatorioPDFProps = {
  escritorioNome: string;
  empresaNome: string;
  competenciaAno: number;
  competenciaMes: number;
  contadorNome: string;
  obrigacoes: ObrigacaoPDF[];
  geradoEm: string;
};

export function RelatorioPDF({
  escritorioNome,
  empresaNome,
  competenciaAno,
  competenciaMes,
  contadorNome,
  obrigacoes,
  geradoEm,
}: RelatorioPDFProps) {
  const hoje = geradoEm.slice(0, 10);
  const total = obrigacoes.length;
  const entregues = obrigacoes.filter((o) => o.status === "entregue").length;
  const atrasadas = obrigacoes.filter((o) => o.atrasada).length;
  const emAndamento = Math.max(0, total - entregues - atrasadas);
  const pct = total > 0 ? Math.round((entregues / total) * 100) : 0;

  const pctEntregue = total > 0 ? (entregues / total) * 100 : 0;
  const pctAtrasada = total > 0 ? (atrasadas / total) * 100 : 0;
  const pctAndamento = Math.max(0, 100 - pctEntregue - pctAtrasada);

  const competenciaLabel = `${MESES[competenciaMes - 1] ?? String(competenciaMes)} / ${competenciaAno}`;
  const obrigsComDocs = obrigacoes.filter((o) => o.documentos.length > 0);

  return (
    <Document title={`Relatório ${competenciaLabel} — ${empresaNome}`} author={escritorioNome}>
      <Page size="A4" style={s.page}>
        {/* ── CABEÇALHO ── */}
        <View style={s.header}>
          <Text style={s.escritorioNome}>{escritorioNome}</Text>
          <Text style={s.subtitulo}>Relatório de Obrigações Fiscais</Text>
          <View style={s.metaRow}>
            <View>
              <Text style={s.metaLabel}>EMPRESA</Text>
              <Text style={s.metaValue}>{empresaNome}</Text>
            </View>
            <View>
              <Text style={s.metaLabel}>COMPETÊNCIA</Text>
              <Text style={s.metaValue}>{competenciaLabel}</Text>
            </View>
            <View>
              <Text style={s.metaLabel}>GERADO EM</Text>
              <Text style={s.metaValue}>{formatDate(hoje)}</Text>
            </View>
          </View>
        </View>
        <View style={s.divider} />

        {/* ── GRÁFICO DE PROGRESSO ── */}
        <Text style={s.sectionTitle}>Progresso da Competência</Text>
        <View style={s.progressBar}>
          {pctEntregue > 0 && (
            <View style={{ width: `${pctEntregue}%`, backgroundColor: C.green }} />
          )}
          {pctAtrasada > 0 && (
            <View style={{ width: `${pctAtrasada}%`, backgroundColor: C.red }} />
          )}
          {pctAndamento > 0 && (
            <View style={{ width: `${pctAndamento}%`, backgroundColor: C.line }} />
          )}
        </View>
        <View style={s.kpiRow}>
          <View style={[s.kpiBox, { borderColor: C.line }]}>
            <Text style={s.kpiLabel}>TOTAL</Text>
            <Text style={s.kpiValue}>{total}</Text>
          </View>
          <View style={[s.kpiBox, { borderColor: C.green, backgroundColor: C.greenBg }]}>
            <Text style={[s.kpiLabel, { color: C.green }]}>ENTREGUES</Text>
            <Text style={[s.kpiValue, { color: C.green }]}>{entregues} · {pct}%</Text>
          </View>
          <View style={[s.kpiBox, { borderColor: C.red, backgroundColor: C.redBg }]}>
            <Text style={[s.kpiLabel, { color: C.red }]}>ATRASADAS</Text>
            <Text style={[s.kpiValue, { color: C.red }]}>{atrasadas}</Text>
          </View>
          <View style={[s.kpiBox, { borderColor: C.line }]}>
            <Text style={s.kpiLabel}>EM ANDAMENTO</Text>
            <Text style={s.kpiValue}>{emAndamento}</Text>
          </View>
        </View>
        <View style={s.divider} />

        {/* ── TABELA DE OBRIGAÇÕES ── */}
        <Text style={s.sectionTitle}>Obrigações</Text>
        <View style={s.tableHeader}>
          <Text style={[s.thCell, s.col1]}>Obrigação</Text>
          <Text style={[s.thCell, s.col2]}>Código</Text>
          <Text style={[s.thCell, s.col3]}>Vencimento</Text>
          <Text style={[s.thCell, s.col4]}>Status</Text>
          <Text style={[s.thCell, s.col5]}>Documentos</Text>
        </View>
        {obrigacoes.map((o) => (
          <View key={o.id} style={o.atrasada ? s.tableRowAtrasada : s.tableRow}>
            <Text style={[o.atrasada ? s.tdCellRed : s.tdCell, s.col1]}>{o.tipoNome}</Text>
            <Text style={[o.atrasada ? s.tdCellRed : s.tdCell, s.col2]}>{o.tipoCodigo}</Text>
            <Text style={[o.atrasada ? s.tdCellRed : s.tdCell, s.col3]}>{formatPrazo(o.prazo)}</Text>
            <View style={[s.badgeRow, s.col4, { padding: "5pt 6pt" }]}>
              <View style={[s.dot, { backgroundColor: STATUS_DOT[o.status] ?? C.muted }]} />
              <Text style={{ fontSize: 8.5, color: o.atrasada ? C.red : C.ink }}>
                {o.atrasada ? "⚠ Atrasada" : (STATUS_LABEL[o.status] ?? o.status)}
              </Text>
            </View>
            <Text style={[s.tdCell, s.col5]}>
              {o.documentos.length === 0 ? "—" : `${o.documentos.length} doc${o.documentos.length > 1 ? "s" : ""}`}
            </Text>
          </View>
        ))}

        {/* ── SEÇÃO DE DOCUMENTOS ── */}
        {obrigsComDocs.length > 0 && (
          <>
            <View style={[s.divider, { marginTop: 20 }]} />
            <Text style={s.sectionTitle}>Documentos por Obrigação</Text>
            {obrigsComDocs.map((o) => (
              <View key={o.id} style={s.docSection}>
                <View style={s.docObrigacaoHeader}>
                  <Text style={s.docObrigacaoNome}>{o.tipoNome} ({o.tipoCodigo})</Text>
                  <Text style={{ fontSize: 8, color: C.muted }}>Prazo: {formatPrazo(o.prazo)}</Text>
                </View>
                <View style={s.docTableHeader}>
                  <Text style={[s.thCell, s.dcol1]}>Arquivo</Text>
                  <Text style={[s.thCell, s.dcol2]}>Tipo</Text>
                  <Text style={[s.thCell, s.dcol3]}>Enviado em</Text>
                </View>
                {o.documentos.map((d) => (
                  <View key={d.id} style={s.docRow}>
                    <Text style={[s.tdCell, s.dcol1]}>{d.nomeArquivo}</Text>
                    <Text style={[s.tdCell, s.dcol2]}>{TIPO_LABEL[d.tipo] ?? d.tipo}</Text>
                    <Text style={[s.tdCell, s.dcol3]}>{formatDate(d.criadoEm)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {/* ── RODAPÉ / ASSINATURA ── */}
        <View style={s.footer} fixed>
          <View style={s.footerDivider} />
          <View style={s.footerRow}>
            <View>
              <Text style={s.footerLabel}>Gerado pelo Núcleo Contábil</Text>
              <Text style={s.pageNum} render={({ pageNumber, totalPages }) =>
                `Página ${pageNumber} de ${totalPages}`
              } />
            </View>
            <View style={s.assinaturaBox}>
              <View style={s.assinaturaLinha} />
              <Text style={s.footerLabel}>{contadorNome}</Text>
              <Text style={s.footerLabel}>Contador responsável</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
