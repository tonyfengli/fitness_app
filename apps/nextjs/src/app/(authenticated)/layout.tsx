import { Navigation } from "../_components/navigation";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col">
      <Navigation />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
