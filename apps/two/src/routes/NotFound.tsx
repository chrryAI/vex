import { useRouter, usePathname } from "ui/hooks/useWindowHistory"

export function NotFound() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div
      style={{ padding: "2rem", fontFamily: "system-ui", textAlign: "center" }}
    >
      <h1>404 - Page Not Found</h1>
      <p>
        The page <code>{pathname}</code> does not exist.
      </p>

      <button onClick={() => router.push("/")} style={{ marginTop: "2rem" }}>
        ← Go Home
      </button>
    </div>
  )
}
