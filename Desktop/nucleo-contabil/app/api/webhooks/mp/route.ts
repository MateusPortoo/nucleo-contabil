import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assinaturas } from "@/lib/db/schema";
import { PLANOS, type Faixa } from "@/lib/billing/planos";

// Mapa de status do MP → status interno
const STATUS_MAP: Record<string, "ativa" | "pendente" | "cancelada"> = {
  authorized: "ativa",
  active: "ativa",
  paused: "pendente",
  cancelled: "cancelada",
  pending: "pendente",
};

// Verifica assinatura HMAC-SHA256 do MP (x-signature header)
function verificarAssinatura(req: NextRequest, body: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return false;

  const header = req.headers.get("x-signature") ?? "";
  const tsMatch = header.match(/ts=([^,]+)/);
  const v1Match = header.match(/v1=([^,]+)/);
  if (!tsMatch || !v1Match) return false;

  const manifest = `id:${req.nextUrl.searchParams.get("data.id") ?? ""};request-id:${req.headers.get("x-request-id") ?? ""};ts:${tsMatch[1]};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(v1Match[1]), Buffer.from(expected));
  } catch {
    return false;
  }
}

// POST — recebe notificações reais do Mercado Pago
export async function POST(req: NextRequest) {
  const body = await req.text();

  if (process.env.MP_WEBHOOK_SECRET && !verificarAssinatura(req, body)) {
    console.error("[webhook/mp] Assinatura inválida");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: { type?: string; data?: { id?: string } };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Só processa eventos de preapproval (assinatura recorrente)
  if (payload.type !== "subscription_preapproval") {
    return NextResponse.json({ ok: true });
  }

  const mpId = payload.data?.id;
  if (!mpId) return NextResponse.json({ error: "missing id" }, { status: 400 });

  try {
    const { MercadoPagoConfig, PreApproval } = await import("mercadopago");
    const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
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

// GET — endpoint de stub para simular ativação sem conta MP real
export async function GET(req: NextRequest) {
  if (process.env.MP_STUB !== "true") {
    return NextResponse.json({ error: "stub desabilitado" }, { status: 403 });
  }

  const escritorioId = req.nextUrl.searchParams.get("escritorioId");
  const faixa = req.nextUrl.searchParams.get("faixa") as Faixa | null;

  if (!escritorioId || !faixa || !PLANOS[faixa]) {
    return NextResponse.json({ error: "params inválidos" }, { status: 400 });
  }

  await db
    .update(assinaturas)
    .set({ status: "ativa", faixa, limiteEmpresas: PLANOS[faixa].limiteEmpresas })
    .where(eq(assinaturas.escritorioId, escritorioId));

  console.log(`[webhook/mp/stub] ${escritorioId} → ativa (${faixa})`);
  return NextResponse.redirect(new URL("/billing", req.nextUrl));
}
