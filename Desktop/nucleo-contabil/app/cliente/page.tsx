import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getServerCaller } from "@/lib/trpc/server";
import { PortalShell } from "@/components/cliente/portal-shell";
import { ClienteBoard } from "@/components/cliente/cliente-board";

export default async function ClientePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.papel !== "cliente") redirect("/");
  if (!session.user.empresaId) redirect("/login");

  const [empresa] = await db
    .select({ nome: empresas.nomeFantasia })
    .from(empresas)
    .where(eq(empresas.id, session.user.empresaId));

  if (!empresa) redirect("/login");

  const caller = await getServerCaller();
  const competencias = await caller.obrigacoes.competenciasDisponiveis();

  return (
    <PortalShell empresaNome={empresa.nome ?? "Empresa"}>
      <ClienteBoard competencias={competencias} />
    </PortalShell>
  );
}
