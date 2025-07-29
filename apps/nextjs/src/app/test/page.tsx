export default function TestPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl">Test Page - No Auth Required</h1>
      <p>If you can see this, the connection works\!</p>
      <p>Time: {new Date().toISOString()}</p>
    </div>
  );
}
