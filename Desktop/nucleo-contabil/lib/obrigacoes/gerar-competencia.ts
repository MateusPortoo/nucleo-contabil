import "server-only";
import { db } from "@/lib/db";
import { obrigacoes, tiposObrigacao } from "@/lib/db/schema";
import type { Regime } from "@/lib/db/schema";

const p2 = (n: number) => String(n).padStart(2, "0");

/**
 * Gera as obrigações de uma empresa para uma competência (ano/mês).
 * Usa ON CONFLICT DO NOTHING — seguro chamar mais de uma vez.
 */
export async function gerarObrigacoesParaEmpresa({
  escritorioId,
  empresaId,
  regime,
  ano,
  mes,
}: {
  escritorioId: string;
  empresaId: string;
  regime: Regime;
  ano: number;
  mes: number;
}) {
  // tiposObrigacao é uma tabela global (sem escritorioId) — compartilhada entre todos os escritórios
  const tipos = await db.select().from(tiposObrigacao);

  const linhas = tipos
    .filter((t) => (regime === "simples" ? t.aplicaSimples : t.aplicaPresumido))
    .filter((t) => {
      if (t.periodicidade === "trimestral") return mes % 3 === 0;
      if (t.periodicidade === "anual") return mes === 3;
      return true;
    })
    .map((t) => {
      const vencMes = mes === 12 ? 1 : mes + 1;
      const vencAno = mes === 12 ? ano + 1 : ano;
      return {
        escritorioId,
        empresaId,
        tipoObrigacaoId: t.id,
        competenciaAno: ano,
        competenciaMes: mes,
        prazo: `${vencAno}-${p2(vencMes)}-${p2(t.diaVencimento)}`,
        status: "pendente_documentos" as const,
      };
    });

  if (linhas.length === 0) return 0;
  await db.insert(obrigacoes).values(linhas).onConflictDoNothing();
  return linhas.length;
}
