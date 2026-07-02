import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getServerCaller } from "@/lib/trpc/server";
import { AppShell } from "@/components/app-shell";
import { RelatoriosView } from "@/components/relatorios/relatorios-view";

export default async function RelatoriosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.papel === "cliente") redirect("/cliente");

  const caller = await getServerCaller();
  const [empresas, competencias] = await Promise.all([
    caller.empresas.listar(),
    caller.obrigacoes.competenciasDisponiveis(),
  ]);

  return (
    <AppShell user={session.user} titulo="Relatórios" activeRoute="/relatorios">
      <RelatoriosView empresas={empresas} competencias={competencias} />
    </AppShell>
  );
}
