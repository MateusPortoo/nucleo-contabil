import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getServerCaller } from "@/lib/trpc/server";
import { AppShell } from "@/components/app-shell";
import { DocumentoForm } from "@/components/documentos/documento-form";

export default async function NovoDocumentoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const caller = await getServerCaller();
  const empresas = await caller.empresas.listar();

  // cliente sem empresa associada → login
  if (session.user.papel === "cliente" && !session.user.empresaId) redirect("/login");

  // cliente só vê a própria empresa
  const empresaFixa =
    session.user.papel === "cliente" ? session.user.empresaId ?? undefined : undefined;

  return (
    <AppShell user={session.user} titulo="Enviar documento" activeRoute="/documentos">
      <div className="mx-auto max-w-lg">
        <p className="mb-6 text-sm text-muted">
          Preencha os dados do documento. Nenhum arquivo é armazenado — apenas os metadados.
        </p>
        <DocumentoForm
          empresas={empresas}
          empresaFixa={empresaFixa}
          papel={session.user.papel}
        />
      </div>
    </AppShell>
  );
}
