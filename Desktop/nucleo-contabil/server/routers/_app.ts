import { router } from "../trpc";
import { empresasRouter } from "./empresas";
import { obrigacoesRouter } from "./obrigacoes";
import { classificacaoRouter } from "./classificacao";
import { billingRouter } from "./billing";
import { documentosRouter } from "./documentos";

export const appRouter = router({
  empresas: empresasRouter,
  obrigacoes: obrigacoesRouter,
  classificacao: classificacaoRouter,
  billing: billingRouter,
  documentos: documentosRouter,
});

export type AppRouter = typeof appRouter;
