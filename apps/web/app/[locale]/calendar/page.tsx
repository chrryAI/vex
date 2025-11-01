import React from "react"
import Calendar from "chrry/Calendar"

export default function page() {
  return <Calendar defaultView="month" defaultDate={new Date()} />
}
