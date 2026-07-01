export type Faixa = "ate10" | "ate25" | "ate50";

export type Plano = {
  faixa: Faixa;
  label: string;
  limiteEmpresas: number;
  precoMensal: number; // BRL
  mpPlanId: string | null; // null até ter conta MP real
};

export const PLANOS: Record<Faixa, Plano> = {
  ate10: {
    faixa: "ate10",
    label: "Starter",
    limiteEmpresas: 10,
    precoMensal: 197,
    mpPlanId: process.env.MP_PLAN_ID_ATE10 ?? null,
  },
  ate25: {
    faixa: "ate25",
    label: "Profissional",
    limiteEmpresas: 25,
    precoMensal: 347,
    mpPlanId: process.env.MP_PLAN_ID_ATE25 ?? null,
  },
  ate50: {
    faixa: "ate50",
    label: "Escritório",
    limiteEmpresas: 50,
    precoMensal: 547,
    mpPlanId: process.env.MP_PLAN_ID_ATE50 ?? null,
  },
};

export const FAIXAS_ORDENADAS: Faixa[] = ["ate10", "ate25", "ate50"];
