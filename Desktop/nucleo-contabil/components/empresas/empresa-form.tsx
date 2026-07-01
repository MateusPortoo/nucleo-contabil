"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/react";
import type { RouterOutputs } from "@/lib/trpc/react";
import { regimeEnum } from "@/lib/db/schema";

type Empresa = RouterOutputs["empresas"]["buscarPorId"];
type Regime = (typeof regimeEnum.enumValues)[number];

const REGIMES: { value: Regime; label: string }[] = [
  { value: "simples", label: "Simples Nacional" },
  { value: "presumido", label: "Lucro Presumido" },
];

// HIGH fix: type guard em vez de cast unsafe
function isRegime(v: string): v is Regime {
  return (regimeEnum.enumValues as readonly string[]).includes(v);
}

function aplicarMascaraCnpj(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// MED-1 fix: mapeia código do tRPC para mensagem segura
function mensagemErro(err: { data?: { code?: string } | null; message: string }): string {
  if (err.data?.code === "FORBIDDEN") return err.message; // mensagens FORBIDDEN são controladas
  if (err.data?.code === "CONFLICT") return "CNPJ já cadastrado neste escritório.";
  return "Ocorreu um erro ao salvar. Tente novamente.";
}

type Props =
  | { modo: "criar"; empresa?: undefined }
  | { modo: "editar"; empresa: Empresa };

export function EmpresaForm({ modo, empresa }: Props) {
  const router = useRouter();
  const [razaoSocial, setRazaoSocial] = useState(empresa?.razaoSocial ?? "");
  const [nomeFantasia, setNomeFantasia] = useState(empresa?.nomeFantasia ?? "");
  const [cnpj, setCnpj] = useState(empresa?.cnpj ?? "");
  const [regime, setRegime] = useState<Regime>(empresa?.regimeTributario ?? "simples");
  const [erro, setErro] = useState<string | null>(null);

  const criar = trpc.empresas.criar.useMutation({
    onSuccess: () => router.push("/empresas"),
    onError: (e) => setErro(mensagemErro(e)),
  });
  const editar = trpc.empresas.editar.useMutation({
    onSuccess: () => router.push("/empresas"),
    onError: (e) => setErro(mensagemErro(e)),
  });

  const isPending = criar.isPending || editar.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const dados = {
      razaoSocial,
      // null → "" → undefined → null: conversão intencional para campo opcional
      nomeFantasia: nomeFantasia.trim() || undefined,
      cnpj,
      regimeTributario: regime,
    };
    if (modo === "criar") {
      criar.mutate(dados);
    } else {
      editar.mutate({ id: empresa.id, ...dados });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="Razão Social *">
        <input
          type="text"
          value={razaoSocial}
          onChange={(e) => setRazaoSocial(e.target.value)}
          required
          minLength={3}
          className="input"
          placeholder="Padaria Pão Quente Ltda"
        />
      </Field>

      <Field label="Nome Fantasia">
        <input
          type="text"
          value={nomeFantasia}
          onChange={(e) => setNomeFantasia(e.target.value)}
          className="input"
          placeholder="Pão Quente"
        />
      </Field>

      <Field label="CNPJ *">
        <input
          type="text"
          value={cnpj}
          onChange={(e) => setCnpj(aplicarMascaraCnpj(e.target.value))}
          required
          className="input font-mono"
          placeholder="00.000.000/0000-00"
        />
      </Field>

      <Field label="Regime Tributário *">
        <select
          value={regime}
          onChange={(e) => {
            const v = e.target.value;
            if (isRegime(v)) setRegime(v); // HIGH fix: runtime guard antes de setar
          }}
          className="input"
        >
          {REGIMES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>

      {erro && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
          {erro.includes("upgrade") && (
            <a href="/billing" className="ml-2 underline">
              Ver planos
            </a>
          )}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink/80 disabled:opacity-60"
        >
          {isPending ? "Salvando…" : modo === "criar" ? "Criar empresa" : "Salvar alterações"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/empresas")}
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
