import { redirect, notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { auth } from "@/auth";
import { getServerCaller } from "@/lib/trpc/server";
import { AppShell } from "@/components/app-shell";
import { EmpresaForm } from "@/components/empresas/empresa-form";
import type { RouterOutputs } from "@/lib/trpc/react";

type EmpresaRow = RouterOutputs["empresas"]["buscarPorId"];

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

  // HIGH-4 fix: apenas NOT_FOUND vira 404; outros erros sobem normalmente
  let empresa: EmpresaRow | undefined;
  try {
    empresa = await caller.empresas.buscarPorId({ id });
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") notFound();
    throw err;
  }
  if (!empresa) notFound();
  if (!empresa.ativa) redirect("/empresas");

  return (
    <AppShell user={session.user} titulo="Editar empresa" activeRoute="/empresas">
      <div className="mx-auto max-w-lg">
        <EmpresaForm modo="editar" empresa={empresa} />
      </div>
    </AppShell>
  );
}
