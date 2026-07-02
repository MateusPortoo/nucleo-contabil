"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc/react";
import { BotaoRelatorio } from "./botao-relatorio";

type Empresa = RouterOutputs["empresas"]["listar"][number];
type Competencia = RouterOutputs["obrigacoes"]["competenciasDisponiveis"][number];

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

type Props = {
  empresas: Empresa[];
  competencias: Competencia[];
};

export function RelatoriosView({ empresas, competencias }: Props) {
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [ano, setAno] = useState<number | undefined>(competencias[0]?.ano);
  const [mes, setMes] = useState<number | undefined>(competencias[0]?.mes);

  const pronto = !!empresaId && !!ano && !!mes;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Relatório de Obrigações ── */}
      <section className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-muted" />
          <h2 className="text-base font-semibold text-ink">Relatório de Obrigações por Competência</h2>
        </div>
        <p className="text-sm text-muted">
          Exporta PDF com progresso, tabela de obrigações e documentos anexados.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Empresa *</span>
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              className="input"
            >
              {empresas.length === 0 && (
                <option value="">Nenhuma empresa cadastrada</option>
              )}
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nomeFantasia ?? e.razaoSocial}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Mês *</span>
            <select
              value={mes ?? ""}
              onChange={(e) => setMes(e.target.value ? Number(e.target.value) : undefined)}
              className="input"
            >
              <option value="">— selecione —</option>
              {MESES.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Ano *</span>
            <select
              value={ano ?? ""}
              onChange={(e) => setAno(e.target.value ? Number(e.target.value) : undefined)}
              className="input"
            >
              <option value="">— selecione —</option>
              {Array.from(new Set(competencias.map((c) => c.ano)))
                .sort((a, b) => b - a)
                .map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <p className="text-xs text-muted">
            {(() => {
              if (!pronto) return "Selecione empresa e competência para gerar o relatório.";
              const emp = empresas.find((e) => e.id === empresaId);
              return `${MESES[(mes ?? 1) - 1]} / ${ano} — ${emp?.nomeFantasia ?? emp?.razaoSocial ?? ""}`;
            })()}
          </p>
          {pronto && (
            <BotaoRelatorio
              empresaId={empresaId}
              ano={ano!}
              mes={mes!}
              label="Exportar PDF"
            />
          )}
        </div>
      </section>
    </div>
  );
}
