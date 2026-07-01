"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, ListChecks, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import type { RouterOutputs } from "@/lib/trpc/react";
import { STATUS_META, ORDEM_ESTAGIOS, MESES, formatPrazo } from "@/components/painel/status";

const TIPO_META: Record<string, { label: string; classe: string }> = {
  nfe:     { label: "NF-e",    classe: "bg-blue-50 text-blue-700" },
  extrato: { label: "Extrato", classe: "bg-green-50 text-green-700" },
  recibo:  { label: "Recibo",  classe: "bg-yellow-50 text-yellow-700" },
  outro:   { label: "Outro",   classe: "bg-line text-muted" },
};

type Competencia = RouterOutputs["obrigacoes"]["competenciasDisponiveis"][number];

export function ClienteBoard({ competencias }: { competencias: Competencia[] }) {
  const [sel, setSel] = useState<Competencia | null>(competencias[0] ?? null);

  const obrigacoes = trpc.obrigacoes.listarPorCompetencia.useQuery(
    { ano: sel?.ano ?? 2000, mes: sel?.mes ?? 1 },
    { enabled: !!sel },
  );

  // Durante loading de nova competência, não mostrar dados stale nos KPIs
  const rows = obrigacoes.isLoading ? [] : (obrigacoes.data ?? []);
  const total = rows.length;
  const atrasadas = rows.filter((r) => r.atrasada).length;
  const entregues = rows.filter((r) => r.status === "entregue").length;
  const pct = total ? Math.round((entregues / total) * 100) : 0;

  const documentos = trpc.documentos.listar.useQuery(
    { ano: sel?.ano, mes: sel?.mes },
    { enabled: !!sel },
  );
  const docs = documentos.isLoading ? [] : (documentos.data ?? []);

  if (!sel) {
    return <p className="text-sm text-muted">Nenhuma obrigação encontrada.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* seletor de competência */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted">Competência</span>
        {competencias.map((c) => {
          const ativo = c.ano === sel.ano && c.mes === sel.mes;
          return (
            <button
              key={`${c.ano}-${c.mes}`}
              type="button"
              onClick={() => setSel(c)}
              className={`rounded-md border px-3 py-1.5 text-sm tnum transition-colors ${
                ativo
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-panel text-muted hover:text-ink"
              }`}
            >
              {MESES[c.mes - 1]}/{c.ano}
            </button>
          );
        })}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-line bg-panel p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <ListChecks className="size-4" /> Obrigações
          </p>
          <p className="mt-2 text-2xl font-bold tnum">{total}</p>
        </div>
        <div className="rounded-lg border border-line bg-panel p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <AlertTriangle className="size-4" /> Atrasadas
          </p>
          <p className={`mt-2 text-2xl font-bold tnum ${atrasadas > 0 ? "text-status-atrasada" : ""}`}>
            {atrasadas}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-panel p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <CheckCircle2 className="size-4" /> Entregues
          </p>
          <p className="mt-2 text-2xl font-bold tnum text-status-entregue">
            {entregues} · {pct}%
          </p>
        </div>
      </div>

      {/* board read-only */}
      {obrigacoes.isLoading ? (
        <div className="h-64 animate-pulse rounded-lg border border-line bg-panel" />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ORDEM_ESTAGIOS.map((status) => {
            const meta = STATUS_META[status];
            const doEstagio = rows.filter((r) => r.status === status);
            return (
              <section
                key={status}
                className="flex flex-col rounded-lg border border-line bg-panel"
              >
                <header className="flex items-center justify-between border-b border-line px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${meta.dot}`} />
                    <span className="text-sm font-semibold">{meta.label}</span>
                  </div>
                  <span className="tnum text-sm text-muted">{doEstagio.length}</span>
                </header>
                <div className="flex flex-col gap-2 p-2">
                  {doEstagio.length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-muted/70">vazio</p>
                  )}
                  {doEstagio.map((r) => (
                    <article
                      key={r.id}
                      className={`rounded-md border bg-surface px-3 py-2.5 ${
                        r.atrasada
                          ? "border-l-2 border-status-atrasada border-y-line border-r-line"
                          : "border-line"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{r.tipoNome}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${meta.chip}`}>
                          {r.tipoCodigo}
                        </span>
                      </div>
                      <span
                        className={`tnum mt-1.5 block text-xs font-medium ${
                          r.atrasada ? "text-status-atrasada" : "text-muted"
                        }`}
                      >
                        {r.atrasada && "⚠ "}{formatPrazo(r.prazo)}
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* seção meus documentos */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <FileText className="size-4" />
            Meus documentos
          </h2>
          <Link
            href="/documentos/novo"
            className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/80"
          >
            <Plus className="size-3.5" />
            Enviar documento
          </Link>
        </div>

        {documentos.isLoading ? (
          <div className="h-16 animate-pulse rounded-lg border border-line bg-panel" />
        ) : docs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-muted">
            Nenhum documento enviado nesta competência.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-panel text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Arquivo</th>
                  <th className="px-4 py-3">Envio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {docs.map((doc) => {
                  const meta = TIPO_META[doc.tipo] ?? TIPO_META.outro;
                  return (
                    <tr key={doc.id} className="bg-surface">
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.classe}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-muted">
                        {doc.nomeArquivo}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {new Date(doc.criadoEm).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
