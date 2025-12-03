import { useRouter } from "ui/hooks/useWindowHistory"

export function Home() {
  const router = useRouter()

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>🚀 Fast SSR with Vite</h1>
      <p>No Next.js, no hydration errors, just speed!</p>

      <nav style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button onClick={() => router.push("/calendar")}>Go to Calendar</button>
        <button onClick={() => router.push("/why")}>Why This Rocks</button>
      </nav>

      <div
        style={{
          marginTop: "2rem",
          padding: "1rem",
          background: "#f0f0f0",
          borderRadius: "8px",
        }}
      >
        <h3>✨ Features:</h3>
        <ul>
          <li>⚡️ Lightning-fast dev server (&lt; 2s startup)</li>
          <li>🎬 View Transitions API</li>
          <li>🔄 SSR + Client-side navigation</li>
          <li>🎯 Your custom router</li>
          <li>✅ Zero hydration errors</li>
        </ul>
      </div>
    </div>
  )
}
