import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getServerCaller } from "@/lib/trpc/server";
import { AppShell } from "@/components/app-shell";
import { DocumentosLista } from "@/components/documentos/documentos-lista";

export default async function DocumentosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.papel === "cliente") redirect("/cliente");

  const caller = await getServerCaller();
  const [documentos, empresas] = await Promise.all([
    caller.documentos.listar({}),
    caller.empresas.listar(),
  ]);

  return (
    <AppShell user={session.user} titulo="Documentos" activeRoute="/documentos">
      <DocumentosLista
        inicial={documentos}
        empresas={empresas}
        papel={session.user.papel}
      />
    </AppShell>
  );
}
