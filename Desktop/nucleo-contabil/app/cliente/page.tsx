import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getServerCaller } from "@/lib/trpc/server";
import { PortalShell } from "@/components/cliente/portal-shell";
import { ClienteBoard } from "@/components/cliente/cliente-board";

export default async function ClientePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.papel !== "cliente") redirect("/");
  if (!session.user.empresaId) redirect("/login");

  // escritorioId garante que um empresaId de outro tenant não vaze o nome
  const [empresa] = await db
    .select({ nome: empresas.nomeFantasia })
    .from(empresas)
    .where(
      and(
        eq(empresas.id, session.user.empresaId),
        eq(empresas.escritorioId, session.user.escritorioId),
      ),
    );

  if (!empresa) redirect("/login");

  // getServerCaller lê a sessão internamente — mesma sessão da linha acima
  const caller = await getServerCaller();
  const competencias = await caller.obrigacoes.competenciasDisponiveis();

  return (
    <PortalShell empresaNome={empresa.nome ?? "Empresa"}>
      <ClienteBoard competencias={competencias} empresaId={session.user.empresaId} />
    </PortalShell>
  );
}
