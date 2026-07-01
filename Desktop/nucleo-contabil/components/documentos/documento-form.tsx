"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/react";
import type { RouterOutputs } from "@/lib/trpc/react";
import { tipoDocumentoEnum } from "@/lib/db/schema";

type Empresa = RouterOutputs["empresas"]["listar"][number];
type TipoDoc = (typeof tipoDocumentoEnum.enumValues)[number];

const TIPOS: { value: TipoDoc; label: string }[] = [
  { value: "nfe", label: "NF-e" },
  { value: "extrato", label: "Extrato Bancário" },
  { value: "recibo", label: "Recibo" },
  { value: "outro", label: "Outro" },
];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function isTipoDoc(v: string): v is TipoDoc {
  return (tipoDocumentoEnum.enumValues as readonly string[]).includes(v);
}

function mensagemErro(err: { data?: { code?: string } | null; message: string }): string {
  if (err.data?.code === "FORBIDDEN") return err.message;
  return "Ocorreu um erro ao enviar o documento. Tente novamente.";
}

type Props = {
  empresas: Empresa[];
  empresaFixa?: string; // empresaId pré-fixado (portal do cliente)
  papel: string;
};

export function DocumentoForm({ empresas, empresaFixa, papel }: Props) {
  const router = useRouter();
  const agora = new Date();

  const [empresaId, setEmpresaId] = useState(empresaFixa ?? empresas[0]?.id ?? "");
  const [tipo, setTipo] = useState<TipoDoc>("nfe");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [obrigacaoId, setObrigacaoId] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);

  const obrigacoesQuery = trpc.obrigacoes.listarPorEmpresaCompetencia.useQuery(
    { empresaId, ano, mes },
    { enabled: !!empresaId },
  );
  const obrigacoesDisp = obrigacoesQuery.data ?? [];

  const enviar = trpc.documentos.enviar.useMutation({
    onSuccess: () => router.push("/documentos"),
    onError: (e) => setErro(mensagemErro(e)),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!empresaId) return;
    enviar.mutate({
      empresaId,
      tipo,
      nomeArquivo: nomeArquivo.trim(),
      competenciaAno: ano,
      competenciaMes: mes,
      obrigacaoId: obrigacaoId || undefined,
    });
  }

  const isCliente = papel === "cliente";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* empresa */}
      {isCliente ? (
        <div>
          <span className="text-sm font-medium text-ink">Empresa</span>
          <p className="mt-1 rounded-lg border border-line bg-panel px-3 py-2.5 text-sm text-muted">
            {empresas.find((e) => e.id === empresaFixa)?.razaoSocial ?? "—"}
          </p>
        </div>
      ) : (
        <Field label="Empresa *">
          <select
            value={empresaId}
            onChange={(e) => { setEmpresaId(e.target.value); setObrigacaoId(""); }}
            required
            className="input"
          >
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.razaoSocial}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* competência */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mês *">
          <select
            value={mes}
            onChange={(e) => { setMes(Number(e.target.value)); setObrigacaoId(""); }}
            className="input"
          >
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Ano *">
          <input
            type="number"
            value={ano}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v) && v >= 2020 && v <= 2100) {
                setAno(v);
                setObrigacaoId("");
              }
            }}
            min={2020}
            max={2100}
            required
            className="input font-mono"
          />
        </Field>
      </div>

      {/* tipo */}
      <Field label="Tipo *">
        <select
          value={tipo}
          onChange={(e) => { if (isTipoDoc(e.target.value)) setTipo(e.target.value); }}
          className="input"
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </Field>

      {/* nome do arquivo */}
      <Field label="Nome do arquivo *">
        <input
          type="text"
          value={nomeArquivo}
          onChange={(e) => setNomeArquivo(e.target.value)}
          required
          placeholder="recibo_junho_2025.pdf"
          className="input"
        />
      </Field>

      {/* obrigação vinculada (opcional) */}
      <Field label="Obrigação vinculada (opcional)">
        <select
          value={obrigacaoId}
          onChange={(e) => setObrigacaoId(e.target.value)}
          className="input"
          disabled={obrigacoesDisp.length === 0}
        >
          <option value="">— nenhuma —</option>
          {obrigacoesDisp.map((o) => (
            <option key={o.id} value={o.id}>
              {o.tipoNome} ({o.tipoCodigo}) · {o.status.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        {obrigacoesDisp.length === 0 && empresaId && (
          <p className="mt-1 text-xs text-muted">
            Nenhuma obrigação encontrada para esta empresa/competência.
          </p>
        )}
      </Field>

      {erro && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={enviar.isPending}
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink/80 disabled:opacity-60"
        >
          {enviar.isPending ? "Enviando…" : "Enviar documento"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/documentos")}
          className="rounded-lg border border-line px-5 py-2.5 text-sm text-muted transition-colors hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
