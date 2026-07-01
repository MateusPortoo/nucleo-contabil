import { Building2 } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

type Props = {
  empresaNome: string;
  children: React.ReactNode;
};

export function PortalShell({ empresaNome, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line bg-panel px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="size-7 rounded-md bg-ink" />
          <div>
            <p className="text-xs font-medium text-muted">Portal do cliente</p>
            <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
              <Building2 className="size-3.5" />
              {empresaNome}
            </p>
          </div>
        </div>
        <SignOutButton />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
