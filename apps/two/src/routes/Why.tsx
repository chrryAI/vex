import { useRouter } from "ui/hooks/useWindowHistory"

export function Why() {
  const router = useRouter()

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>💡 Why This Approach Rocks</h1>

      <div style={{ marginTop: "2rem" }}>
        <h2>🚀 Performance</h2>
        <ul>
          <li>
            <strong>Dev server:</strong> &lt; 2 seconds (vs 5+ minutes with
            Next.js)
          </li>
          <li>
            <strong>HMR:</strong> Instant updates with Vite's native ESM
          </li>
          <li>
            <strong>Build time:</strong> 10x faster than Next.js
          </li>
        </ul>

        <h2>🎯 Simplicity</h2>
        <ul>
          <li>No magic framework conventions</li>
          <li>Explicit SSR flow - easy to debug</li>
          <li>Full control over rendering</li>
          <li>No mysterious crashes</li>
        </ul>

        <h2>✨ Your Custom Router</h2>
        <ul>
          <li>View Transitions API for smooth animations</li>
          <li>Instant client-side navigation</li>
          <li>Smart swipe gesture detection</li>
          <li>Prefetching support</li>
        </ul>
      </div>

      <nav style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button onClick={() => router.push("/")}>← Back to Home</button>
        <button onClick={() => router.push("/calendar")}>Calendar →</button>
      </nav>
    </div>
  )
}
