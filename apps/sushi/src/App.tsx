import "../../../packages/ui/globals.scss"
// import "./index.css"
// import "./App.css"
import { IDE } from "../../../packages/code/src/IDE"
import { HistoryRouterProvider } from "../../../packages/ui/context/providers/HistoryRouterProvider"
import Chrry from "../../../packages/ui/Chrry"

function App() {
  return (
    <HistoryRouterProvider>
      <Chrry />
    </HistoryRouterProvider>
  )
}

export default App
