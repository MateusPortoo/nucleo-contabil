import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getServerCaller } from "@/lib/trpc/server";
import { AppShell } from "@/components/app-shell";
import { EmpresaForm } from "@/components/empresas/empresa-form";

export default async function EditarEmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { papel } = session.user;
  if (papel !== "socio" && papel !== "contador") redirect("/empresas");

  const { id } = await params;
  const caller = await getServerCaller();

  let empresa;
  try {
    empresa = await caller.empresas.buscarPorId({ id });
  } catch {
    notFound();
  }

  if (!empresa.ativa) redirect("/empresas");

  return (
    <AppShell user={session.user} titulo="Editar empresa" activeRoute="/empresas">
      <div className="mx-auto max-w-lg">
        <EmpresaForm modo="editar" empresa={empresa} />
      </div>
    </AppShell>
  );
}
