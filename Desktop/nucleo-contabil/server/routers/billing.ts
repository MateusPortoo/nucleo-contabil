import "server-only";
import { and, count, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@/lib/db";
import { assinaturas, empresas, faixaEnum } from "@/lib/db/schema";
import { router, tenantProcedure, comPapel } from "../trpc";
import { PLANOS, FAIXAS_ORDENADAS } from "@/lib/billing/planos";
import type { Faixa } from "@/lib/billing/planos";

const socioProcedure = comPapel("socio");

// H-3 fix: faixa derivada do enum do schema (fonte única de verdade)
const faixaZod = z.enum(faixaEnum.enumValues);

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

  iniciarCheckout: socioProcedure
    .input(z.object({ faixa: faixaZod }))
    .mutation(async ({ ctx, input }) => {
      const faixa = input.faixa as Faixa;
      const plano = PLANOS[faixa];
      const assinatura = await getAssinatura(ctx.escritorioId);

      if (!assinatura) throw new TRPCError({ code: "NOT_FOUND", message: "Assinatura não encontrada." });

      // H-2 fix: bloqueia nova tentativa se já pendente ou se é o mesmo plano ativo
      if (assinatura.status === "pendente") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Já existe um pagamento pendente. Aguarde a confirmação." });
      }
      if (assinatura.status === "ativa" && assinatura.faixa === input.faixa) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você já está neste plano." });
      }

      // Modo stub: ativa diretamente no servidor — sem redirect para GET público
      if (process.env.MP_STUB === "true" || !process.env.MP_ACCESS_TOKEN) {
        await db
          .update(assinaturas)
          .set({
            faixa,
            limiteEmpresas: plano.limiteEmpresas,
            status: "ativa", // stub ativa imediatamente, sem depender do GET
            mpSubscriptionId: `stub-${faixa}-${randomUUID()}`,
          })
          .where(eq(assinaturas.escritorioId, ctx.escritorioId));
        return { checkoutUrl: "/billing" };
      }

      // Modo real: cria preapproval no Mercado Pago
      const accessToken = process.env.MP_ACCESS_TOKEN;
      const { MercadoPagoConfig, PreApproval } = await import("mercadopago");
      const mp = new MercadoPagoConfig({ accessToken });
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
          ...(ctx.session?.user?.email ? { payer_email: ctx.session.user.email } : {}),
        },
      });

      if (!res.id || !res.init_point) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao criar assinatura no Mercado Pago." });
      }

      // H-5 fix: valida que a URL retornada pertence ao domínio do MP
      const initUrl = new URL(res.init_point);
      const MP_DOMINIOS = ["www.mercadopago.com.br", "www.mercadopago.com", "www.mercadolibre.com"];
      if (!MP_DOMINIOS.includes(initUrl.hostname)) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "URL de checkout inválida." });
      }

      // Só muda para pendente após o MP confirmar a criação
      await db
        .update(assinaturas)
        .set({
          faixa,
          limiteEmpresas: plano.limiteEmpresas,
          status: "pendente",
          mpSubscriptionId: res.id,
        })
        .where(eq(assinaturas.escritorioId, ctx.escritorioId));

      return { checkoutUrl: res.init_point };
    }),
});
