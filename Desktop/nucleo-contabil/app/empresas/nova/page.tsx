import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { EmpresaForm } from "@/components/empresas/empresa-form";

export default async function NovaEmpresaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { papel } = session.user;
  if (papel !== "socio" && papel !== "contador") redirect("/empresas");

  return (
    <AppShell user={session.user} titulo="Nova empresa" activeRoute="/empresas">
      <div className="mx-auto max-w-lg">
        <p className="mb-6 text-sm text-muted">
          Preencha os dados da empresa-cliente. As obrigações da competência corrente serão geradas automaticamente.
        </p>
        <EmpresaForm modo="criar" />
      </div>
    </AppShell>
  );
}
