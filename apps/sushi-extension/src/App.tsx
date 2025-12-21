import "chrry/globals.scss"
import "./App.css"
import { SushiApp } from "@chrryai/sushi"
import { HistoryRouterProvider } from "../../../packages/ui/context/providers/HistoryRouterProvider"

function App() {
  return (
    <HistoryRouterProvider>
      <SushiApp />
    </HistoryRouterProvider>
  )
}

export default App
