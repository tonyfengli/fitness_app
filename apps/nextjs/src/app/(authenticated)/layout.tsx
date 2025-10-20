"use client";

import { usePathname } from "next/navigation";
import { Navigation } from "../_components/navigation";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isCircuitConfigPage = pathname?.includes("/circuit-config");
  const isCircuitSessionsPage = pathname?.startsWith("/circuit-sessions");

  return (
    <div className="flex h-screen flex-col">
      {!isCircuitConfigPage && !isCircuitSessionsPage && <Navigation />}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
