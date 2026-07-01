import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Sparkles,
  CreditCard,
} from "lucide-react";
import { SignOutButton } from "./sign-out-button";

type NavItem =
  | { label: string; icon: React.ElementType; href: string; somenteSocio?: boolean }
  | { label: string; icon: React.ElementType; href: null };

const NAV: NavItem[] = [
  { label: "Painel", icon: LayoutDashboard, href: "/" },
  { label: "Empresas", icon: Building2, href: "/empresas" },
  { label: "Documentos", icon: FileText, href: null },
  { label: "Revisão IA", icon: Sparkles, href: "/classificacao" },
  { label: "Cobrança", icon: CreditCard, href: "/billing", somenteSocio: true },
];

const PAPEL_LABEL: Record<string, string> = {
  socio: "Sócio",
  contador: "Contador",
  assistente: "Assistente",
  cliente: "Cliente",
};

type Props = {
  user: { name?: string | null; email?: string | null; papel: string };
  titulo: string;
  activeRoute?: string;
  /** badge de uso exibido no rodapé da sidebar (ex: "10 / 25 empresas") */
  usoBadge?: string;
  children: React.ReactNode;
};

export function AppShell({ user, titulo, activeRoute = "/", usoBadge, children }: Props) {
  return (
    <div className="flex min-h-screen">
      {/* sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-panel px-4 py-5 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="size-7 rounded-md bg-ink" />
          <span className="text-base font-bold tracking-tight">Núcleo</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            if (item.href === null) {
              return (
                <span
                  key={item.label}
                  className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted/50"
                >
                  <item.icon className="size-4" />
                  {item.label}
                  <span className="ml-auto text-[10px] uppercase tracking-wide">
                    em breve
                  </span>
                </span>
              );
            }
            // itens restritos ao sócio ficam invisíveis para outros papéis
            if (item.somenteSocio && user.papel !== "socio") return null;
            const ativo = activeRoute === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  ativo ? "bg-ink/5 font-semibold text-ink" : "text-muted hover:text-ink"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-line pt-4">
          <p className="truncate text-sm font-medium text-ink">
            {user.name ?? user.email}
          </p>
          <p className="text-xs text-muted">{PAPEL_LABEL[user.papel] ?? user.papel}</p>
          {usoBadge && (
            <p className="mt-1.5 text-xs text-muted/70 tnum">{usoBadge}</p>
          )}
        </div>
      </aside>

      {/* conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-panel/80 px-6 py-4 backdrop-blur">
          <h1 className="text-lg font-bold tracking-tight">{titulo}</h1>
          <SignOutButton />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
