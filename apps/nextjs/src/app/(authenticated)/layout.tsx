import { Navigation } from "../_components/navigation";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navigation />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}