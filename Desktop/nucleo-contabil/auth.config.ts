import type { NextAuthConfig } from "next-auth";
import type { Papel } from "@/lib/db/schema";

// Config edge-safe (sem db/bcrypt) — compartilhada entre o middleware (edge) e
// a instância completa em auth.ts. Os providers que tocam o banco ficam lá.
export default {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      if (!auth?.user) return false;
      const papel = auth.user.papel as Papel;
      const path = request.nextUrl.pathname;
      // Rotas de API protegidas pelo tenantProcedure — não redirecionar.
      if (path.startsWith("/api/trpc") || path.startsWith("/api/webhooks")) return true;
      // cliente → redireciona para /cliente se tentar acessar área do staff
      if (papel === "cliente" && !path.startsWith("/cliente")) {
        return Response.redirect(new URL("/cliente", request.nextUrl));
      }
      // staff → redireciona para / se tentar acessar portal do cliente
      if (papel !== "cliente" && path.startsWith("/cliente")) {
        return Response.redirect(new URL("/", request.nextUrl));
      }
      // /billing é exclusivo do sócio
      if (path.startsWith("/billing") && papel !== "socio") {
        return Response.redirect(new URL("/", request.nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.escritorioId = user.escritorioId;
        token.papel = user.papel;
        token.empresaId = user.empresaId;
      }
      return token;
    },
    session({ session, token }) {
      if (!token.sub) throw new Error("Sessão sem sub — token inválido.");
      session.user.id = token.sub;
      session.user.escritorioId = token.escritorioId as string;
      session.user.papel = token.papel as Papel;
      session.user.empresaId = (token.empresaId as string | null) ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
