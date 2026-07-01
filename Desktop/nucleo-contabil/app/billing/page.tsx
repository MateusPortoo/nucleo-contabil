import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getServerCaller } from "@/lib/trpc/server";
import { AppShell } from "@/components/app-shell";
import { BillingPage } from "@/components/billing/billing-page";

export default async function BillingPageRoute() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.papel !== "socio") redirect("/");

  const caller = await getServerCaller();
  const inicial = await caller.billing.status();

  return (
    <AppShell user={session.user} titulo="Cobrança & Planos" activeRoute="/billing">
      <BillingPage inicial={inicial} />
    </AppShell>
  );
}
