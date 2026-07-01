"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import type { RouterOutputs } from "@/lib/trpc/react";
import type { Papel } from "@/lib/db/schema";
import { TIPO_META } from "@/lib/documentos/tipo-meta";

type Documento = RouterOutputs["documentos"]["listar"][number];
type Empresa = RouterOutputs["empresas"]["listar"][number];

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

type Props = {
  inicial: Documento[];
  empresas: Empresa[];
  papel: Papel;
};

export function DocumentosLista({ inicial, empresas, papel }: Props) {
  const agora = new Date();
  const [filtroEmpresaId, setFiltroEmpresaId] = useState("");
  const [filtroAno, setFiltroAno] = useState<number | undefined>(undefined);
  const [filtroMes, setFiltroMes] = useState<number | undefined>(undefined);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const { data: documentos, refetch } = trpc.documentos.listar.useQuery(
    {
      empresaId: filtroEmpresaId || undefined,
      ano: filtroAno,
      mes: filtroMes,
    },
    { initialData: inicial },
  );

  const excluir = trpc.documentos.excluir.useMutation({ onSuccess: () => refetch() });
  const pendingId = excluir.isPending ? excluir.variables?.id : null;

  const podeExcluir = papel === "socio" || papel === "contador";
  const isStaff = papel !== "cliente";

  function handleExcluir(id: string) {
    if (confirmandoId === id) {
      excluir.mutate({ id });
      setConfirmandoId(null);
    } else {
      setConfirmandoId(id);
    }
  }

  function nomeEmpresa(id: string) {
    const e = empresas.find((emp) => emp.id === id);
    return e?.nomeFantasia ?? e?.razaoSocial ?? id;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* filtro empresa (só staff vê) */}
          {isStaff && (
            <select
              value={filtroEmpresaId}
              onChange={(e) => setFiltroEmpresaId(e.target.value)}
              className="input h-9 py-0 text-sm"
            >
              <option value="">Todas as empresas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nomeFantasia ?? e.razaoSocial}
                </option>
              ))}
            </select>
          )}

          {/* filtro mês */}
          <select
            value={filtroMes ?? ""}
            onChange={(e) => setFiltroMes(e.target.value ? Number(e.target.value) : undefined)}
            className="input h-9 py-0 text-sm"
          >
            <option value="">Todos os meses</option>
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>

          {/* filtro ano */}
          <input
            type="number"
            placeholder={String(agora.getFullYear())}
            value={filtroAno ?? ""}
            onChange={(e) => setFiltroAno(e.target.value ? Number(e.target.value) : undefined)}
            className="input h-9 w-24 py-0 font-mono text-sm"
            min={2020}
            max={2100}
          />
        </div>

        <Link
          href="/documentos/novo"
          className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/80"
        >
          <Plus className="size-4" />
          Enviar documento
        </Link>
      </div>

      {/* empty state */}
      {documentos.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-line py-16 text-center">
          <FileText className="size-10 text-muted/40" />
          <div>
            <p className="font-semibold text-ink">Nenhum documento encontrado</p>
            <p className="text-sm text-muted">Ajuste os filtros ou envie o primeiro documento.</p>
          </div>
        </div>
      )}

      {/* tabela */}
      {documentos.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-panel text-left text-xs font-semibold uppercase tracking-wide text-muted">
                {isStaff && <th className="px-4 py-3">Empresa</th>}
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3">Competência</th>
                <th className="px-4 py-3">Obrigação</th>
                <th className="px-4 py-3">Envio</th>
                {podeExcluir && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {documentos.map((doc) => {
                const meta = TIPO_META[doc.tipo] ?? TIPO_META.outro;
                return (
                  <tr key={doc.id} className="bg-surface transition-colors hover:bg-panel/60">
                    {isStaff && (
                      <td className="px-4 py-3 text-sm text-ink">{nomeEmpresa(doc.empresaId)}</td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.classe}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-muted">
                      {doc.nomeArquivo}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {MESES[doc.competenciaMes - 1]}/{doc.competenciaAno}
                    </td>
                    <td className="px-4 py-3">
                      {doc.obrigacaoId ? (
                        <span className="inline-flex rounded bg-line px-2 py-0.5 text-xs text-ink">
                          vinculada
                        </span>
                      ) : (
                        <span className="text-xs text-muted/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(doc.criadoEm).toLocaleDateString("pt-BR")}
                    </td>
                    {podeExcluir && (
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleExcluir(doc.id)}
                          disabled={pendingId === doc.id}
                          className={`flex items-center gap-1 rounded-md border px-3 py-1 text-xs transition-colors ${
                            confirmandoId === doc.id
                              ? "border-red-300 bg-red-50 text-red-700"
                              : "border-line text-muted hover:text-red-600"
                          } disabled:opacity-50`}
                        >
                          <Trash2 className="size-3" />
                          {pendingId === doc.id
                            ? "Aguarde…"
                            : confirmandoId === doc.id
                              ? "Confirmar?"
                              : "Excluir"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
