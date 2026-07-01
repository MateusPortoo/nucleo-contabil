import "server-only";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@/lib/db";
import { assinaturas, empresas } from "@/lib/db/schema";
import { router, tenantProcedure, comPapel } from "../trpc";
import { PLANOS, FAIXAS_ORDENADAS, type Faixa } from "@/lib/billing/planos";

const socioProcedure = comPapel("socio");

async function getAssinatura(escritorioId: string) {
  const [row] = await db
    .select()
    .from(assinaturas)
    .where(eq(assinaturas.escritorioId, escritorioId));
  return row ?? null;
}

async function contarEmpresasAtivas(escritorioId: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(empresas)
    .where(
      and(eq(empresas.escritorioId, escritorioId), eq(empresas.ativa, true)),
    );
  return r?.n ?? 0;
}

export const billingRouter = router({
  // Retorna o status da assinatura + uso atual (para o badge no AppShell e página /billing)
  status: tenantProcedure.query(async ({ ctx }) => {
    const [assinatura, ativas] = await Promise.all([
      getAssinatura(ctx.escritorioId),
      contarEmpresasAtivas(ctx.escritorioId),
    ]);
    return {
      assinatura,
      empresasAtivas: ativas,
      planos: FAIXAS_ORDENADAS.map((f) => PLANOS[f]),
    };
  }),

  // Inicia checkout: cria subscription no MP (ou stub) e retorna URL de pagamento
  iniciarCheckout: socioProcedure
    .input(z.object({ faixa: z.enum(["ate10", "ate25", "ate50"]) }))
    .mutation(async ({ ctx, input }) => {
      const plano = PLANOS[input.faixa as Faixa];
      const assinatura = await getAssinatura(ctx.escritorioId);

      if (!assinatura) throw new TRPCError({ code: "NOT_FOUND", message: "Assinatura não encontrada." });
      if (assinatura.status === "ativa" && assinatura.faixa === input.faixa) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você já está neste plano." });
      }

      // Modo stub: sem conta MP real, simula retorno imediato
      if (process.env.MP_STUB === "true" || !process.env.MP_ACCESS_TOKEN) {
        await db
          .update(assinaturas)
          .set({
            faixa: input.faixa,
            limiteEmpresas: plano.limiteEmpresas,
            status: "pendente",
            mpSubscriptionId: `stub-${input.faixa}-${Date.now()}`,
          })
          .where(eq(assinaturas.escritorioId, ctx.escritorioId));
        // Em modo stub o webhook não virá — retorna URL do endpoint de stub
        return { checkoutUrl: `/api/webhooks/mp/stub?escritorioId=${ctx.escritorioId}&faixa=${input.faixa}` };
      }

      // Modo real: cria preapproval_plan no Mercado Pago
      const { MercadoPagoConfig, PreApproval } = await import("mercadopago");
      const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
      const preapproval = new PreApproval(mp);

      const res = await preapproval.create({
        body: {
          reason: `Núcleo Contabilidade — Plano ${plano.label}`,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: plano.precoMensal,
            currency_id: "BRL",
          },
          back_url: `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/billing`,
          payer_email: ctx.session?.user?.email ?? undefined,
        },
      });

      if (!res.id || !res.init_point) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao criar assinatura no Mercado Pago." });
      }

      await db
        .update(assinaturas)
        .set({
          faixa: input.faixa,
          limiteEmpresas: plano.limiteEmpresas,
          status: "pendente",
          mpSubscriptionId: res.id,
        })
        .where(eq(assinaturas.escritorioId, ctx.escritorioId));

      return { checkoutUrl: res.init_point };
    }),
});
