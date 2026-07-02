"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

type Props = {
  empresaId: string;
  ano: number;
  mes: number;
  label?: string;
};

export function BotaoRelatorio({ empresaId, ano, mes, label = "Exportar PDF" }: Props) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleClick() {
    setErro(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        empresaId,
        ano: String(ano),
        mes: String(mes),
      });
      const res = await fetch(`/api/relatorios/obrigacoes?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { error?: string }).error ?? "Erro ao gerar relatório.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "relatorio.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErro("Falha de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-line bg-panel px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-line disabled:opacity-60"
      >
        <FileDown className="size-4" />
        {loading ? "Gerando…" : label}
      </button>
      {erro && (
        <p className="text-xs text-red-600">{erro}</p>
      )}
    </div>
  );
}
