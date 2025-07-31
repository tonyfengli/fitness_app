export default function WorkoutOverviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}