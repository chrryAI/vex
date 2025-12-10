import "chrry/globals.scss"
// import "chrry/styles/view-transitions.css"
import "./App.css"
import Chrry from "../../../packages/ui/Chrry"
import { HistoryRouterProvider } from "../../../packages/ui/context/providers/HistoryRouterProvider"
import { updateExtensionIcon } from "./utils/updateIcon"
function App() {
  return (
    <HistoryRouterProvider>
      <Chrry useExtensionIcon={updateExtensionIcon} />
    </HistoryRouterProvider>
  )
}

// Separate component to access context

export default App
