// /**
//  * FalkorDB Setup Wizard
//  *
//  * Runs automatically on every app launch (install or dev mode).
//  * Logic:
//  *  1. Call `falkor_check` Tauri command → FalkorStatus
//  *  2. If FalkorDB is not running → show "FalkorDB not found" error with install instructions
//  *  3. If FalkorDB running but graph empty (graph_exists = false) → run full seed
//  *  4. If graph exists with data → silently done (re-install safe, no dialog)
//  *
//  * Setup state is persisted in localStorage('vex_falkor_initialized') so repeated
//  * launches skip the wizard unless FalkorDB is gone again.
//  */

// import { invoke } from "@tauri-apps/api/core"
// import type React from "react"
// import { useEffect, useState } from "react"

// interface FalkorStatus {
//   running: boolean
//   graph_exists: boolean
//   node_count: number
// }

// type WizardStep =
//   | "checking" // initial check
//   | "not_running" // FalkorDB not detected
//   | "seeding" // graph empty, seeding in progress
//   | "done" // all good

// interface Props {
//   /** Called once setup is confirmed complete */
//   onReady: () => void
// }

// export function SetupWizard({ onReady }: Props) {
//   const [step, setStep] = useState<WizardStep>("checking")
//   const [status, setStatus] = useState<FalkorStatus | null>(null)
//   const [seedProgress, setSeedProgress] = useState("")
//   const [error, setError] = useState<string | null>(null)

//   useEffect(() => {
//     void runCheck()
//   }, [])

//   async function runCheck() {
//     setStep("checking")
//     try {
//       const s = await invoke<FalkorStatus>("falkor_check")
//       setStatus(s)

//       if (!s.running) {
//         setStep("not_running")
//         return
//       }

//       if (!s.graph_exists || s.node_count === 0) {
//         // Graph is empty — run seed via API
//         setStep("seeding")
//         await runSeed()
//         return
//       }

//       // FalkorDB is running and has data → done
//       localStorage.setItem("vex_falkor_initialized", "true")
//       setStep("done")
//       onReady()
//     } catch (e) {
//       setError(String(e))
//       setStep("not_running")
//     }
//   }

//   async function runSeed() {
//     try {
//       setSeedProgress("Seeding stores and apps…")
//       const apiBase =
//         (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3000"

//       // Seed public data (stores + apps)
//       const res = await fetch(`${apiBase}/api/falkor/seed`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ scope: "public" }),
//       })

//       if (!res.ok) throw new Error(`Seed API returned ${res.status}`)

//       setSeedProgress("Done!")
//       localStorage.setItem("vex_falkor_initialized", "true")
//       setStep("done")
//       onReady()
//     } catch (e) {
//       setError(`Seeding failed: ${String(e)}`)
//       // Still mark done so the app is usable without FalkorDB
//       setStep("done")
//       onReady()
//     }
//   }

//   // Once done, render nothing
//   if (step === "done") return null

//   return (
//     <div style={overlay}>
//       <div style={card}>
//         {step === "checking" && (
//           <>
//             <Spinner />
//             <h2 style={heading}>Checking local database…</h2>
//             <p style={sub}>Connecting to FalkorDB</p>
//           </>
//         )}

//         {step === "not_running" && (
//           <>
//             <div style={icon}>⚠️</div>
//             <h2 style={heading}>FalkorDB not found</h2>
//             <p style={sub}>
//               {error ??
//                 "FalkorDB is not running on localhost:6379. Start it with Docker:"}
//             </p>
//             <code style={code}>docker run -p 6379:6379 falkordb/falkordb</code>
//             <div style={row}>
//               <button style={btnSecondary} onClick={onReady}>
//                 Continue without it
//               </button>
//               <button style={btnPrimary} onClick={runCheck}>
//                 Retry
//               </button>
//             </div>
//           </>
//         )}

//         {step === "seeding" && (
//           <>
//             <Spinner />
//             <h2 style={heading}>Setting up local workspace…</h2>
//             <p style={sub}>{seedProgress || "Initializing graph…"}</p>
//           </>
//         )}
//       </div>
//     </div>
//   )
// }

// // ---------------------------------------------------------------------------
// // Styles (inline — no CSS files needed)
// // ---------------------------------------------------------------------------

// const overlay: React.CSSProperties = {
//   position: "fixed",
//   inset: 0,
//   background: "rgba(10, 10, 15, 0.92)",
//   backdropFilter: "blur(12px)",
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "center",
//   zIndex: 9999,
// }

// const card: React.CSSProperties = {
//   background: "rgba(18, 18, 24, 0.95)",
//   border: "1px solid rgba(255,255,255,0.08)",
//   borderRadius: 16,
//   padding: "40px 48px",
//   width: 420,
//   display: "flex",
//   flexDirection: "column",
//   alignItems: "center",
//   gap: 16,
//   boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
// }

// const heading: React.CSSProperties = {
//   color: "#fff",
//   fontSize: 20,
//   fontWeight: 600,
//   margin: 0,
//   textAlign: "center",
// }

// const sub: React.CSSProperties = {
//   color: "rgba(255,255,255,0.5)",
//   fontSize: 14,
//   margin: 0,
//   textAlign: "center",
//   lineHeight: 1.6,
// }

// const code: React.CSSProperties = {
//   background: "rgba(255,255,255,0.06)",
//   border: "1px solid rgba(255,255,255,0.1)",
//   borderRadius: 8,
//   padding: "10px 16px",
//   fontSize: 12,
//   color: "#a8ff78",
//   fontFamily: "monospace",
//   width: "100%",
//   textAlign: "center",
// }

// const icon: React.CSSProperties = {
//   fontSize: 40,
// }

// const row: React.CSSProperties = {
//   display: "flex",
//   gap: 12,
//   marginTop: 8,
//   width: "100%",
// }

// const btnBase: React.CSSProperties = {
//   flex: 1,
//   padding: "10px 0",
//   borderRadius: 8,
//   border: "none",
//   cursor: "pointer",
//   fontSize: 14,
//   fontWeight: 500,
//   transition: "opacity 0.15s",
// }

// const btnPrimary: React.CSSProperties = {
//   ...btnBase,
//   background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
//   color: "#fff",
// }

// const btnSecondary: React.CSSProperties = {
//   ...btnBase,
//   background: "rgba(255,255,255,0.07)",
//   color: "rgba(255,255,255,0.7)",
// }

// // ---------------------------------------------------------------------------
// // Spinner
// // ---------------------------------------------------------------------------

// function Spinner() {
//   return (
//     <div
//       style={{
//         width: 40,
//         height: 40,
//         borderRadius: "50%",
//         border: "3px solid rgba(255,255,255,0.1)",
//         borderTopColor: "#7c3aed",
//         animation: "spin 0.8s linear infinite",
//       }}
//     />
//   )
// }
