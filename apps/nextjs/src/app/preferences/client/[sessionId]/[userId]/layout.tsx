export default function ClientPreferencesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}