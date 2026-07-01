import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getServerCaller } from "@/lib/trpc/server";
import { AppShell } from "@/components/app-shell";
import { EmpresasLista } from "@/components/empresas/empresas-lista";

export default async function EmpresasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.papel === "cliente") redirect("/cliente");

  const caller = await getServerCaller();
  const empresas = await caller.empresas.listar();

  return (
    <AppShell user={session.user} titulo="Empresas" activeRoute="/empresas">
      <EmpresasLista inicial={empresas} papel={session.user.papel} />
    </AppShell>
  );
}
