import "server-only";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@/lib/db";
import { documentos, obrigacoes, tipoDocumentoEnum } from "@/lib/db/schema";
import { router, tenantProcedure, comPapel } from "../trpc";

const tipoDocumentoValues = tipoDocumentoEnum.enumValues;

const enviarInput = z.object({
  empresaId: z.string().uuid(),
  tipo: z.enum(tipoDocumentoValues),
  nomeArquivo: z.string().min(1).max(255),
  competenciaAno: z.number().int().min(2020).max(2100),
  competenciaMes: z.number().int().min(1).max(12),
  obrigacaoId: z.string().uuid().optional(),
});

export const documentosRouter = router({
  listar: tenantProcedure
    .input(
      z.object({
        empresaId: z.string().uuid().optional(),
        ano: z.number().int().optional(),
        mes: z.number().int().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filtros = [eq(documentos.escritorioId, ctx.escritorioId)];

      // cliente só enxerga documentos da própria empresa
      if (ctx.papel === "cliente") {
        filtros.push(eq(documentos.empresaId, ctx.empresaId!));
      } else if (input.empresaId) {
        filtros.push(eq(documentos.empresaId, input.empresaId));
      }

      if (input.ano) filtros.push(eq(documentos.competenciaAno, input.ano));
      if (input.mes) filtros.push(eq(documentos.competenciaMes, input.mes));

      return db
        .select({
          id: documentos.id,
          empresaId: documentos.empresaId,
          tipo: documentos.tipo,
          nomeArquivo: documentos.nomeArquivo,
          competenciaAno: documentos.competenciaAno,
          competenciaMes: documentos.competenciaMes,
          obrigacaoId: documentos.obrigacaoId,
          criadoEm: documentos.criadoEm,
        })
        .from(documentos)
        .where(and(...filtros))
        .orderBy(desc(documentos.criadoEm));
    }),

  enviar: tenantProcedure.input(enviarInput).mutation(async ({ ctx, input }) => {
    // cliente só pode enviar para a própria empresa
    if (ctx.papel === "cliente" && input.empresaId !== ctx.empresaId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Você só pode enviar documentos para a sua empresa.",
      });
    }

    return db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(documentos)
        .values({
          escritorioId: ctx.escritorioId,
          empresaId: input.empresaId,
          tipo: input.tipo,
          nomeArquivo: input.nomeArquivo,
          competenciaAno: input.competenciaAno,
          competenciaMes: input.competenciaMes,
          obrigacaoId: input.obrigacaoId ?? null,
        })
        .returning();

      if (!doc) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // avança status somente de pendente_documentos → em_classificacao (não regride)
      if (input.obrigacaoId) {
        await tx
          .update(obrigacoes)
          .set({ status: "em_classificacao" })
          .where(
            and(
              eq(obrigacoes.id, input.obrigacaoId),
              eq(obrigacoes.escritorioId, ctx.escritorioId),
              eq(obrigacoes.status, "pendente_documentos"),
            ),
          );
      }

      return doc;
    });
  }),

  excluir: comPapel("socio", "contador")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [excluido] = await db
        .delete(documentos)
        .where(and(eq(documentos.id, input.id), eq(documentos.escritorioId, ctx.escritorioId)))
        .returning({ id: documentos.id });

      if (!excluido) throw new TRPCError({ code: "NOT_FOUND" });
      return excluido;
    }),
});
