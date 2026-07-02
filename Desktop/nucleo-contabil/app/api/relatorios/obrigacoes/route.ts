import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { obrigacoes, empresas, tiposObrigacao, documentos, escritorios } from "@/lib/db/schema";
import { RelatorioPDF } from "@/lib/relatorios/pdf-obrigacoes";
import type { ObrigacaoPDF } from "@/lib/relatorios/pdf-obrigacoes";

const querySchema = z.object({
  empresaId: z.string().uuid(),
  ano: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.escritorioId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { escritorioId, papel, empresaId: sessionEmpresaId, name: usuarioNome } = session.user;

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const { empresaId, ano, mes } = parsed.data;

  // Cliente só pode gerar relatório da própria empresa
  // Null-check explícito: sessionEmpresaId pode ser null em sessões sem empresa vinculada
  if (papel === "cliente" && (!sessionEmpresaId || empresaId !== sessionEmpresaId)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  // Empresa + escritório em paralelo (empresa filtra por escritorioId — previne IDOR)
  const [[empresa], [escritorio]] = await Promise.all([
    db
      .select({ id: empresas.id, razaoSocial: empresas.razaoSocial, nomeFantasia: empresas.nomeFantasia })
      .from(empresas)
      .where(and(eq(empresas.id, empresaId), eq(empresas.escritorioId, escritorioId)))
      .limit(1),
    db
      .select({ nome: escritorios.nome })
      .from(escritorios)
      .where(eq(escritorios.id, escritorioId))
      .limit(1),
  ]);

  if (!empresa) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  // Busca obrigações da competência
  const hoje = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: obrigacoes.id,
      tipoCodigo: tiposObrigacao.codigo,
      tipoNome: tiposObrigacao.nome,
      prazo: obrigacoes.prazo,
      status: obrigacoes.status,
    })
    .from(obrigacoes)
    .innerJoin(tiposObrigacao, eq(tiposObrigacao.id, obrigacoes.tipoObrigacaoId))
    .where(
      and(
        eq(obrigacoes.escritorioId, escritorioId),
        eq(obrigacoes.empresaId, empresaId),
        eq(obrigacoes.competenciaAno, ano),
        eq(obrigacoes.competenciaMes, mes),
      ),
    )
    .orderBy(obrigacoes.prazo)
    .limit(501); // sentinela: 501 detecta truncamento sem falso positivo no limite exato

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nenhuma obrigação encontrada para esta competência." }, { status: 404 });
  }

  const truncated = rows.length > 500;
  const rowsSliced = truncated ? rows.slice(0, 500) : rows;

  // Busca documentos em batch (evita N+1)
  const obrigacaoIds = rowsSliced.map((r) => r.id);
  const docs = await db
    .select({
      id: documentos.id,
      obrigacaoId: documentos.obrigacaoId,
      tipo: documentos.tipo,
      nomeArquivo: documentos.nomeArquivo,
      criadoEm: documentos.criadoEm,
    })
    .from(documentos)
    .where(
      and(
        eq(documentos.escritorioId, escritorioId),
        eq(documentos.empresaId, empresaId),
        inArray(documentos.obrigacaoId, obrigacaoIds),
      ),
    )
    .orderBy(documentos.criadoEm)
    .limit(1000);

  // Agrupa documentos por obrigacaoId em O(N)
  const docsByObrig = new Map<string, typeof docs>();
  for (const d of docs) {
    if (!d.obrigacaoId) continue;
    const list = docsByObrig.get(d.obrigacaoId) ?? [];
    list.push(d);
    docsByObrig.set(d.obrigacaoId, list);
  }

  const obrigacoesPDF: ObrigacaoPDF[] = rowsSliced.map((r) => ({
    id: r.id,
    tipoCodigo: r.tipoCodigo,
    tipoNome: r.tipoNome,
    prazo: r.prazo.slice(0, 10), // garante YYYY-MM-DD sem hora
    status: r.status,
    atrasada: r.status !== "entregue" && r.prazo < hoje,
    documentos: (docsByObrig.get(r.id) ?? []).map((d) => ({
      id: d.id,
      tipo: d.tipo,
      nomeArquivo: d.nomeArquivo,
      criadoEm: d.criadoEm.toISOString(),
    })),
  }));

  const contadorNome = usuarioNome ?? "Contador";

  const pdf = createElement(RelatorioPDF, {
    escritorioNome: escritorio?.nome ?? "Escritório",
    empresaNome: empresa.nomeFantasia ?? empresa.razaoSocial,
    competenciaAno: ano,
    competenciaMes: mes,
    contadorNome,
    obrigacoes: obrigacoesPDF,
    geradoEm: new Date().toISOString(),
  }) as ReactElement<DocumentProps>; // renderToBuffer exige DocumentProps; createElement retorna ReactElement<unknown>

  let nodeBuffer: Buffer;
  try {
    nodeBuffer = await renderToBuffer(pdf);
  } catch (err) {
    // Não logar o objeto err bruto — pode conter dados da empresa
    const msg = err instanceof Error ? err.message : "desconhecido";
    console.error("[relatorio/pdf] renderToBuffer falhou:", msg);
    return NextResponse.json({ error: "Falha ao gerar o PDF. Tente novamente." }, { status: 500 });
  }

  if (nodeBuffer.length === 0) {
    return NextResponse.json({ error: "PDF gerado está vazio." }, { status: 500 });
  }

  const buffer = new Uint8Array(nodeBuffer);

  // Sanitiza para ASCII puro: remove acentos, aspas e chars de controle
  const nomeBase = empresa.razaoSocial
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // decompõe acentos
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_") // só alfanumérico + _ -
    .replace(/_+/g, "_")
    .toLowerCase()
    || "empresa";
  const filename = `relatorio_${nomeBase}_${ano}_${String(mes).padStart(2, "0")}.pdf`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(truncated ? { "X-Truncated": "obrigacoes" } : {}),
    },
  });
}
