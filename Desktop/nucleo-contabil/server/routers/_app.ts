import { router } from "../trpc";
import { empresasRouter } from "./empresas";
import { obrigacoesRouter } from "./obrigacoes";
import { classificacaoRouter } from "./classificacao";
import { billingRouter } from "./billing";

export const appRouter = router({
  empresas: empresasRouter,
  obrigacoes: obrigacoesRouter,
  classificacao: classificacaoRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
