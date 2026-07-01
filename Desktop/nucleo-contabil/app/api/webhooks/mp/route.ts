import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { assinaturas } from "@/lib/db/schema";
import { PLANOS, type Faixa } from "@/lib/billing/planos";

const STATUS_MAP: Record<string, "ativa" | "pendente" | "cancelada"> = {
  authorized: "ativa",
  active: "ativa",
  paused: "pendente",
  cancelled: "cancelada",
  pending: "pendente",
};

// Verifica assinatura HMAC-SHA256 do MP (x-signature header)
function verificarAssinatura(req: NextRequest, _body: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return false;

  const header = req.headers.get("x-signature") ?? "";
  const tsMatch = header.match(/ts=([^,]+)/);
  const v1Match = header.match(/v1=([^,]+)/);
  if (!tsMatch || !v1Match) return false;

  const manifest = `id:${req.nextUrl.searchParams.get("data.id") ?? ""};request-id:${req.headers.get("x-request-id") ?? ""};ts:${tsMatch[1]};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    // timingSafeEqual exige buffers do mesmo tamanho; pré-checar evita exceção
    const a = Buffer.from(v1Match[1]);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// POST — recebe notificações reais do Mercado Pago
export async function POST(req: NextRequest) {
  const accessToken = process.env.MP_ACCESS_TOKEN;

  // Falha fechada: sem token não há como buscar a subscription no MP
  if (!accessToken) {
    console.error("[webhook/mp] MP_ACCESS_TOKEN não configurado");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const body = await req.text();

  // Falha fechada: sem secret não aceitamos nenhum payload
  if (!process.env.MP_WEBHOOK_SECRET || !verificarAssinatura(req, body)) {
    console.error("[webhook/mp] Assinatura inválida ou MP_WEBHOOK_SECRET ausente");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: { type?: string; data?: { id?: string } };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (payload.type !== "subscription_preapproval") {
    return NextResponse.json({ ok: true });
  }

  const mpId = payload.data?.id;
  if (!mpId) return NextResponse.json({ error: "missing id" }, { status: 400 });

  try {
    const { MercadoPagoConfig, PreApproval } = await import("mercadopago");
    const mp = new MercadoPagoConfig({ accessToken });
    const preapproval = new PreApproval(mp);
    const sub = await preapproval.get({ id: mpId });

    const novoStatus = STATUS_MAP[sub.status ?? ""] ?? "pendente";

    await db
      .update(assinaturas)
      .set({ status: novoStatus })
      .where(eq(assinaturas.mpSubscriptionId, mpId));

    console.log(`[webhook/mp] ${mpId} → ${novoStatus}`);
  } catch (err) {
    console.error("[webhook/mp] Erro ao processar evento:", err);
    return NextResponse.json({ error: "processing error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// GET — endpoint de stub autenticado para simular ativação sem conta MP real
export async function GET(req: NextRequest) {
  if (process.env.MP_STUB !== "true") {
    return NextResponse.json({ error: "stub desabilitado" }, { status: 403 });
  }

  // C-1 fix: exige sessão válida + verifica que o escritorioId pertence ao usuário
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const escritorioId = req.nextUrl.searchParams.get("escritorioId");
  const rawFaixa = req.nextUrl.searchParams.get("faixa");
  const faixa: Faixa | null = rawFaixa && rawFaixa in PLANOS ? (rawFaixa as Faixa) : null;

  if (!escritorioId || !faixa) {
    return NextResponse.json({ error: "params inválidos" }, { status: 400 });
  }

  // Garante que o caller só pode ativar o próprio escritório
  if (session.user.escritorioId !== escritorioId) {
    return NextResponse.json({ error: "acesso negado" }, { status: 403 });
  }

  await db
    .update(assinaturas)
    .set({ status: "ativa", faixa, limiteEmpresas: PLANOS[faixa].limiteEmpresas })
    .where(eq(assinaturas.escritorioId, escritorioId));

  console.log(`[webhook/mp/stub] ${escritorioId} → ativa (${faixa})`);
  return NextResponse.redirect(new URL("/billing", req.nextUrl));
}

// Exportado para testes: gera stub ID não-previsível
export function gerarStubId(faixa: string) {
  return `stub-${faixa}-${randomUUID()}`;
}
