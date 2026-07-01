import "server-only";
import { and, eq, count } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@/lib/db";
import { empresas, assinaturas, regimeEnum } from "@/lib/db/schema";
import { router, tenantProcedure, comPapel } from "../trpc";
import { gerarObrigacoesParaEmpresa } from "@/lib/obrigacoes/gerar-competencia";

// ── CNPJ: validação de dígito verificador ────────────────────────────────────
function validarCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return false;
  if (/^(\d)\1+$/.test(d)) return false; // todos dígitos iguais são inválidos

  const calcDigito = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((acc, p, i) => acc + parseInt(d[i]) * p, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };

  const d1 = calcDigito(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcDigito(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return parseInt(d[12]) === d1 && parseInt(d[13]) === d2;
}

const empresaInput = z.object({
  razaoSocial: z.string().min(3).max(200),
  nomeFantasia: z.string().max(200).optional(),
  cnpj: z
    .string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido (formato: XX.XXX.XXX/XXXX-XX)")
    .refine(validarCNPJ, "CNPJ inválido (dígitos verificadores incorretos)"),
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

  // LOW-2 fix: cliente só vê count da própria empresa (nunca o total do escritório)
  contarAtivas: tenantProcedure.query(async ({ ctx }) => {
    const filtros = [eq(empresas.escritorioId, ctx.escritorioId), eq(empresas.ativa, true)];
    if (ctx.papel === "cliente") filtros.push(eq(empresas.id, ctx.empresaId!));
    const [r] = await db.select({ n: count() }).from(empresas).where(and(...filtros));
    return r?.n ?? 0;
  }),

  // Read-only — usado pela UI para exibir uso atual do plano
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

  // CRIT-1 fix: transação com SELECT FOR UPDATE evita race condition no limite do plano
  criar: comPapel("socio", "contador")
    .input(empresaInput)
    .mutation(async ({ ctx, input }) => {
      const empresa = await db.transaction(async (tx) => {
        // Bloqueia a linha de assinatura para serializar criações concorrentes
        const [assinatura] = await tx
          .select({ limite: assinaturas.limiteEmpresas, status: assinaturas.status })
          .from(assinaturas)
          .where(eq(assinaturas.escritorioId, ctx.escritorioId))
          .for("update");

        if (!assinatura || assinatura.status !== "ativa") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Assinatura inativa. Acesse Cobrança para ativar seu plano.",
          });
        }

        const [cont] = await tx
          .select({ n: count() })
          .from(empresas)
          .where(and(eq(empresas.escritorioId, ctx.escritorioId), eq(empresas.ativa, true)));

        if ((cont?.n ?? 0) >= assinatura.limite) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Limite de ${assinatura.limite} empresas atingido. Faça upgrade do plano.`,
          });
        }

        const [emp] = await tx
          .insert(empresas)
          .values({
            escritorioId: ctx.escritorioId,
            razaoSocial: input.razaoSocial,
            nomeFantasia: input.nomeFantasia ?? null,
            cnpj: input.cnpj,
            regimeTributario: input.regimeTributario,
          })
          .returning();

        if (!emp) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return emp;
      });

      // Fora da transação: ON CONFLICT DO NOTHING garante idempotência
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
        .set({
          razaoSocial: dados.razaoSocial,
          nomeFantasia: dados.nomeFantasia ?? null,
          cnpj: dados.cnpj,
          regimeTributario: dados.regimeTributario,
        })
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
