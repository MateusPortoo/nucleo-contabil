import { and, eq, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "@/lib/db";
import { empresas, assinaturas } from "@/lib/db/schema";
import { router, tenantProcedure, comPapel } from "../trpc";

export const empresasRouter = router({
  listar: tenantProcedure.query(async ({ ctx }) => {
    // Cliente só enxerga a própria empresa (isolamento de 2º nível).
    // empresaId é garantido não-nulo pelo tenantProcedure quando papel = cliente.
    const where =
      ctx.papel === "cliente"
        ? and(
            eq(empresas.escritorioId, ctx.escritorioId),
            eq(empresas.id, ctx.empresaId!),
          )
        : eq(empresas.escritorioId, ctx.escritorioId);

    return db.select().from(empresas).where(where).orderBy(empresas.razaoSocial);
  }),

  contarAtivas: tenantProcedure.query(async ({ ctx }) => {
    const [r] = await db
      .select({ n: count() })
      .from(empresas)
      .where(
        and(
          eq(empresas.escritorioId, ctx.escritorioId),
          eq(empresas.ativa, true),
        ),
      );
    return r?.n ?? 0;
  }),

  // Guard reutilizável: verifica se o escritório pode adicionar mais empresas
  verificarLimite: comPapel("socio", "contador").query(async ({ ctx }) => {
    const [[assinatura], [cont]] = await Promise.all([
      db.select({ limite: assinaturas.limiteEmpresas, status: assinaturas.status })
        .from(assinaturas)
        .where(eq(assinaturas.escritorioId, ctx.escritorioId)),
      db.select({ n: count() })
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
});
