export default function TestPage() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>✅ Server is Working!</h1>
      <p>If you can see this page, the Next.js server is running correctly.</p>
      <p>The main pages are hanging because they require database access.</p>
      <h2>What's needed:</h2>
      <ul>
        <li>A valid Supabase/Postgres database URL</li>
        <li>Update the POSTGRES_URL in the .env file</li>
      </ul>
    </div>
  );
}
