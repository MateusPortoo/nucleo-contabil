import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { obrigacoes, empresas, tiposObrigacao } from "@/lib/db/schema";
import { router, tenantProcedure } from "../trpc";

const competenciaInput = z.object({
  ano: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
});

export const obrigacoesRouter = router({
  // Competências que têm obrigações (para o seletor), mais recente primeiro.
  competenciasDisponiveis: tenantProcedure.query(async ({ ctx }) => {
    const filtros = [eq(obrigacoes.escritorioId, ctx.escritorioId)];
    if (ctx.papel === "cliente") {
      filtros.push(eq(obrigacoes.empresaId, ctx.empresaId!));
    }
    return db
      .selectDistinct({
        ano: obrigacoes.competenciaAno,
        mes: obrigacoes.competenciaMes,
      })
      .from(obrigacoes)
      .where(and(...filtros))
      .orderBy(desc(obrigacoes.competenciaAno), desc(obrigacoes.competenciaMes));
  }),

  // Obrigações de uma competência, com empresa e tipo, marcando atrasadas.
  listarPorCompetencia: tenantProcedure
    .input(competenciaInput)
    .query(async ({ ctx, input }) => {
      const filtros = [
        eq(obrigacoes.escritorioId, ctx.escritorioId),
        eq(obrigacoes.competenciaAno, input.ano),
        eq(obrigacoes.competenciaMes, input.mes),
      ];
      // isolamento de 2º nível: cliente só vê a própria empresa
      if (ctx.papel === "cliente") {
        filtros.push(eq(obrigacoes.empresaId, ctx.empresaId!));
      }

      const rows = await db
        .select({
          id: obrigacoes.id,
          status: obrigacoes.status,
          prazo: obrigacoes.prazo,
          empresaRazao: empresas.razaoSocial,
          empresaFantasia: empresas.nomeFantasia,
          tipoCodigo: tiposObrigacao.codigo,
          tipoNome: tiposObrigacao.nome,
        })
        .from(obrigacoes)
        .innerJoin(empresas, eq(empresas.id, obrigacoes.empresaId))
        .innerJoin(
          tiposObrigacao,
          eq(tiposObrigacao.id, obrigacoes.tipoObrigacaoId),
        )
        .where(and(...filtros))
        .orderBy(obrigacoes.prazo);

      const hoje = new Date().toISOString().slice(0, 10);
      return rows.map((r) => ({
        ...r,
        atrasada: r.status !== "entregue" && r.prazo < hoje,
      }));
    }),
});
