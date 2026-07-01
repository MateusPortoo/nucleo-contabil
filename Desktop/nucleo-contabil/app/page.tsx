import { auth } from "@/auth";
import { getServerCaller } from "@/lib/trpc/server";
import { AppShell } from "@/components/app-shell";
import { PainelObrigacoes } from "@/components/painel/painel-obrigacoes";

export default async function PainelPage() {
  const session = await auth();
  if (!session?.user) return null; // middleware já redireciona, guarda de tipo

  const caller = await getServerCaller();
  const [competencias, billingStatus] = await Promise.all([
    caller.obrigacoes.competenciasDisponiveis(),
    caller.billing.status(),
  ]);

  const usoBadge =
    billingStatus.assinatura
      ? `${billingStatus.empresasAtivas} / ${billingStatus.assinatura.limiteEmpresas} empresas`
      : undefined;

  return (
    <AppShell user={session.user} titulo="Painel de obrigações" usoBadge={usoBadge}>
      <PainelObrigacoes competencias={competencias} />
    </AppShell>
  );
}
