export { auth as default } from "@/auth";

export const config = {
  // Exclui assets estáticos e rotas de auth do Next.js, mas deixa /api/trpc
  // passar para o handler HTTP — a autenticação nessas rotas vive no tenantProcedure.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
