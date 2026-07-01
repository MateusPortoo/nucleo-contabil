"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Plus, PowerOff } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import type { RouterOutputs } from "@/lib/trpc/react";
import type { Papel } from "@/lib/db/schema";

type Empresa = RouterOutputs["empresas"]["listar"][number];

// Record<Regime, string> garante exaustividade em compile-time
const REGIME_LABEL: Record<"simples" | "presumido", string> = {
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
};

export function EmpresasLista({
  inicial,
  papel,
}: {
  inicial: RouterOutputs["empresas"]["listar"];
  papel: Papel; // HIGH-3 fix: union type, não string
}) {
  const { data: empresas, refetch } = trpc.empresas.listar.useQuery(undefined, {
    initialData: inicial,
  });

  const desativar = trpc.empresas.desativar.useMutation({
    onSuccess: () => refetch(),
  });

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  // MEDIUM fix: rastreia qual empresa está sendo processada pelo pending
  const pendingId = desativar.isPending ? desativar.variables?.id : null;

  const podeCriar = papel === "socio" || papel === "contador";
  const podeDesativar = papel === "socio";

  function handleDesativar(empresa: Empresa) {
    if (confirmandoId === empresa.id) {
      desativar.mutate({ id: empresa.id });
      setConfirmandoId(null);
    } else {
      setConfirmandoId(empresa.id);
    }
  }

  if (empresas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-line py-16 text-center">
        <Building2 className="size-10 text-muted/40" />
        <div>
          <p className="font-semibold text-ink">Nenhuma empresa cadastrada</p>
          <p className="text-sm text-muted">Comece criando a primeira empresa-cliente.</p>
        </div>
        {podeCriar && (
          <Link
            href="/empresas/nova"
            className="mt-2 flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/80"
          >
            <Plus className="size-4" />
            Nova empresa
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {podeCriar && (
        <div className="flex justify-end">
          <Link
            href="/empresas/nova"
            className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/80"
          >
            <Plus className="size-4" />
            Nova empresa
          </Link>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-panel text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">Regime</th>
              <th className="px-4 py-3">Status</th>
              {(podeCriar || podeDesativar) && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {empresas.map((emp) => (
              <tr
                key={emp.id}
                className={`bg-surface transition-colors hover:bg-panel/60 ${!emp.ativa ? "opacity-50" : ""}`}
              >
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">
                    {emp.nomeFantasia ?? emp.razaoSocial}
                  </p>
                  {emp.nomeFantasia && (
                    <p className="text-xs text-muted">{emp.razaoSocial}</p>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-muted">{emp.cnpj}</td>
                <td className="px-4 py-3 text-muted">
                  {REGIME_LABEL[emp.regimeTributario]}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      emp.ativa
                        ? "bg-status-entregue/10 text-status-entregue"
                        : "bg-line text-muted"
                    }`}
                  >
                    {emp.ativa ? "Ativa" : "Inativa"}
                  </span>
                </td>
                {(podeCriar || podeDesativar) && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {podeCriar && emp.ativa && (
                        <Link
                          href={`/empresas/${emp.id}`}
                          className="rounded-md border border-line px-3 py-1 text-xs text-muted transition-colors hover:text-ink"
                        >
                          Editar
                        </Link>
                      )}
                      {podeDesativar && emp.ativa && (
                        <button
                          type="button"
                          onClick={() => handleDesativar(emp)}
                          disabled={pendingId === emp.id}
                          className={`flex items-center gap-1 rounded-md border px-3 py-1 text-xs transition-colors ${
                            confirmandoId === emp.id
                              ? "border-red-300 bg-red-50 text-red-700"
                              : "border-line text-muted hover:text-red-600"
                          } disabled:opacity-50`}
                        >
                          <PowerOff className="size-3" />
                          {pendingId === emp.id
                            ? "Aguarde…"
                            : confirmandoId === emp.id
                              ? "Confirmar?"
                              : "Desativar"}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
