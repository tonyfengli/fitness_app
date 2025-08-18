export default function WorkoutOverviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex-1">{children}</div>
    </div>
  );
}
