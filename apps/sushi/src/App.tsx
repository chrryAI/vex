import "chrry/globals.scss"
import "./index.css"
import "./App.css"
import { IDE } from "../../../packages/code/src/IDE"
import { HistoryRouterProvider } from "../../../packages/ui/context/providers/HistoryRouterProvider"

function App() {
  return (
    <HistoryRouterProvider>
      <IDE />
    </HistoryRouterProvider>
  )
}

export default App
