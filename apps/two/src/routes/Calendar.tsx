import { useRouter } from "ui/hooks/useWindowHistory"

export function Calendar() {
  const router = useRouter()

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>📅 Calendar</h1>
      <p>This is the calendar page - rendered with SSR!</p>

      <nav style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button onClick={() => router.push("/")}>← Back to Home</button>
        <button onClick={() => router.push("/why")}>Why This Rocks →</button>
      </nav>

      <div style={{ marginTop: "2rem" }}>
        <p>🎬 Notice the smooth View Transition when navigating!</p>
        <p>📡 Check the Network tab - no page reloads after initial load.</p>
      </div>
    </div>
  )
}
