"use client";

import { CheckCircle2, Zap, Building2, Users } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import type { RouterOutputs } from "@/lib/trpc/react";
import type { Faixa } from "@/lib/billing/planos";

type BillingStatus = RouterOutputs["billing"]["status"];
type Plano = BillingStatus["planos"][number];

const ICONES: Record<Faixa, React.ElementType> = {
  ate10: Zap,
  ate25: Building2,
  ate50: Users,
};

export function BillingPage({ inicial }: { inicial: BillingStatus }) {
  const { data } = trpc.billing.status.useQuery(undefined, {
    initialData: inicial,
    refetchInterval: 8_000,
    refetchIntervalInBackground: false,
  });

  const checkout = trpc.billing.iniciarCheckout.useMutation({
    onSuccess: ({ checkoutUrl }) => {
      // H-5: URL já validada no servidor (domínio MP ou "/billing" no stub)
      window.location.href = checkoutUrl;
    },
  });

  const { assinatura, empresasAtivas, planos } = data;
  const faixaAtual = assinatura?.faixa;
  const statusAtual = assinatura?.status ?? ("pendente" as const);
  const limite = assinatura?.limiteEmpresas ?? 0;
  const pct = limite > 0 ? Math.round((empresasAtivas / limite) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* uso atual */}
      <section className="rounded-xl border border-line bg-panel p-6">
        <p className="text-sm font-medium text-muted">Uso do plano atual</p>
        <div className="mt-3 flex items-end gap-3">
          <span className="text-4xl font-bold tnum">{empresasAtivas}</span>
          <span className="mb-1 text-lg text-muted">/ {limite} empresas</span>
          <span
            className={`mb-1 ml-auto rounded-full px-3 py-1 text-sm font-semibold ${
              statusAtual === "ativa"
                ? "bg-status-entregue/10 text-status-entregue"
                : statusAtual === "pendente"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {statusAtual === "ativa" ? "Ativo" : statusAtual === "pendente" ? "Pendente" : "Cancelado"}
          </span>
        </div>
        {/* barra de progresso */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-status-atrasada" : "bg-ink"}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        {pct >= 90 && (
          <p className="mt-2 text-xs font-medium text-status-atrasada">
            ⚠ Você está usando {pct}% da capacidade — considere fazer upgrade.
          </p>
        )}
      </section>

      {/* cards de plano */}
      {statusAtual === "pendente" && (
        <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Aguardando confirmação do pagamento… a página atualiza automaticamente.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {planos.map((plano) => (
          <PlanoCard
            key={plano.faixa}
            plano={plano}
            atual={faixaAtual === plano.faixa}
            pagamentoPendente={statusAtual === "pendente"}
            loading={checkout.isPending && checkout.variables?.faixa === plano.faixa}
            onAssinar={() => checkout.mutate({ faixa: plano.faixa })}
          />
        ))}
      </div>

      {checkout.isError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {checkout.error.message}
        </p>
      )}

      {process.env.NODE_ENV !== "production" && (
        <p className="text-center text-xs text-muted/60">
          Modo demo — pagamento simulado (MP_STUB=true)
        </p>
      )}
    </div>
  );
}

function PlanoCard({
  plano,
  atual,
  pagamentoPendente,
  loading,
  onAssinar,
}: {
  plano: Plano;
  atual: boolean;
  pagamentoPendente: boolean;
  loading: boolean;
  onAssinar: () => void;
}) {
  const Icon = ICONES[plano.faixa as Faixa];

  return (
    <article
      className={`relative flex flex-col rounded-xl border p-5 transition-shadow ${
        atual ? "border-ink shadow-md" : "border-line hover:shadow-sm"
      }`}
    >
      {atual && (
        <span className="absolute right-4 top-4 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-white">
          Plano atual
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-ink/5">
          <Icon className="size-4.5 text-ink" />
        </div>
        <div>
          <p className="font-bold">{plano.label}</p>
          <p className="text-xs text-muted">até {plano.limiteEmpresas} empresas</p>
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold tnum">
          {plano.precoMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </span>
        <span className="text-sm text-muted">/mês</span>
      </div>
      <ul className="mt-4 flex flex-col gap-1.5 text-sm text-muted">
        <FeatureItem label={`Até ${plano.limiteEmpresas} empresas-cliente`} />
        <FeatureItem label="Classificação IA ilimitada" />
        <FeatureItem label="Portal do cliente incluso" />
        <FeatureItem label="Suporte por e-mail" />
      </ul>
      <button
        type="button"
        disabled={atual || loading || pagamentoPendente}
        onClick={onAssinar}
        className={`mt-5 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
          atual
            ? "cursor-default bg-ink/5 text-ink/40"
            : "bg-ink text-white hover:bg-ink/80 disabled:opacity-60"
        }`}
      >
        {loading ? "Aguarde…" : atual ? "Plano ativo" : pagamentoPendente ? "Aguardando…" : "Assinar"}
      </button>
    </article>
  );
}

function FeatureItem({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 className="size-3.5 shrink-0 text-status-entregue" />
      {label}
    </li>
  );
}
