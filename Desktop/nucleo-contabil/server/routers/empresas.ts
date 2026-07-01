import "server-only";
import { and, eq, count } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@/lib/db";
import { empresas, assinaturas, regimeEnum } from "@/lib/db/schema";
import { router, tenantProcedure, comPapel } from "../trpc";
import { gerarObrigacoesParaEmpresa } from "@/lib/obrigacoes/gerar-competencia";

const empresaInput = z.object({
  razaoSocial: z.string().min(3).max(200),
  nomeFantasia: z.string().max(200).optional(),
  cnpj: z
    .string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido (formato: XX.XXX.XXX/XXXX-XX)"),
  regimeTributario: z.enum(regimeEnum.enumValues),
});

export const empresasRouter = router({
  listar: tenantProcedure.query(async ({ ctx }) => {
    const where =
      ctx.papel === "cliente"
        ? and(eq(empresas.escritorioId, ctx.escritorioId), eq(empresas.id, ctx.empresaId!))
        : eq(empresas.escritorioId, ctx.escritorioId);
    return db.select().from(empresas).where(where).orderBy(empresas.razaoSocial);
  }),

  buscarPorId: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await db
        .select()
        .from(empresas)
        .where(and(eq(empresas.id, input.id), eq(empresas.escritorioId, ctx.escritorioId)));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  contarAtivas: tenantProcedure.query(async ({ ctx }) => {
    const [r] = await db
      .select({ n: count() })
      .from(empresas)
      .where(and(eq(empresas.escritorioId, ctx.escritorioId), eq(empresas.ativa, true)));
    return r?.n ?? 0;
  }),

  verificarLimite: comPapel("socio", "contador").query(async ({ ctx }) => {
    const [[assinatura], [cont]] = await Promise.all([
      db
        .select({ limite: assinaturas.limiteEmpresas, status: assinaturas.status })
        .from(assinaturas)
        .where(eq(assinaturas.escritorioId, ctx.escritorioId)),
      db
        .select({ n: count() })
        .from(empresas)
        .where(and(eq(empresas.escritorioId, ctx.escritorioId), eq(empresas.ativa, true))),
    ]);

    if (!assinatura || assinatura.status !== "ativa") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Assinatura inativa. Acesse Cobrança para ativar seu plano.",
      });
    }

    const ativas = cont?.n ?? 0;
    if (ativas >= assinatura.limite) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Limite de ${assinatura.limite} empresas atingido. Faça upgrade do plano.`,
      });
    }
    return { ativas, limite: assinatura.limite };
  }),

  criar: comPapel("socio", "contador")
    .input(empresaInput)
    .mutation(async ({ ctx, input }) => {
      // 1. verificar limite do plano
      const [[assinatura], [cont]] = await Promise.all([
        db
          .select({ limite: assinaturas.limiteEmpresas, status: assinaturas.status })
          .from(assinaturas)
          .where(eq(assinaturas.escritorioId, ctx.escritorioId)),
        db
          .select({ n: count() })
          .from(empresas)
          .where(and(eq(empresas.escritorioId, ctx.escritorioId), eq(empresas.ativa, true))),
      ]);

      if (!assinatura || assinatura.status !== "ativa") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Assinatura inativa. Acesse Cobrança para ativar seu plano.",
        });
      }
      if ((cont?.n ?? 0) >= assinatura.limite) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Limite de ${assinatura.limite} empresas atingido. Faça upgrade do plano.`,
        });
      }

      // 2. inserir empresa
      const [empresa] = await db
        .insert(empresas)
        .values({
          escritorioId: ctx.escritorioId,
          razaoSocial: input.razaoSocial,
          nomeFantasia: input.nomeFantasia ?? null,
          cnpj: input.cnpj,
          regimeTributario: input.regimeTributario,
        })
        .returning();

      // 3. gerar obrigações da competência corrente
      const agora = new Date();
      await gerarObrigacoesParaEmpresa({
        escritorioId: ctx.escritorioId,
        empresaId: empresa.id,
        regime: input.regimeTributario,
        ano: agora.getFullYear(),
        mes: agora.getMonth() + 1,
      });

      return empresa;
    }),

  editar: comPapel("socio", "contador")
    .input(z.object({ id: z.string().uuid() }).merge(empresaInput))
    .mutation(async ({ ctx, input }) => {
      const { id, ...dados } = input;
      const [atualizada] = await db
        .update(empresas)
        .set({ razaoSocial: dados.razaoSocial, nomeFantasia: dados.nomeFantasia ?? null, cnpj: dados.cnpj, regimeTributario: dados.regimeTributario })
        .where(and(eq(empresas.id, id), eq(empresas.escritorioId, ctx.escritorioId)))
        .returning();
      if (!atualizada) throw new TRPCError({ code: "NOT_FOUND" });
      return atualizada;
    }),

  desativar: comPapel("socio")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [atualizada] = await db
        .update(empresas)
        .set({ ativa: false })
        .where(and(eq(empresas.id, input.id), eq(empresas.escritorioId, ctx.escritorioId)))
        .returning();
      if (!atualizada) throw new TRPCError({ code: "NOT_FOUND" });
      return atualizada;
    }),
});
