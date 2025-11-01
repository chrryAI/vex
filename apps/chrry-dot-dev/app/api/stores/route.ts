import { NextRequest, NextResponse } from "next/server"
import { getStores, createStore } from "@repo/db"

export async function GET(request: NextRequest) {
  try {
    const stores = await getStores({
      page: 1,
      pageSize: 100,
    })
    return NextResponse.json(stores)
  } catch (error) {
    console.error("Error fetching stores:", error)
    return NextResponse.json(
      { error: "Failed to fetch stores" },
      { status: 500 },
    )
  }
}

// export async function POST(request: NextRequest) {
//   try {
//     const body = await request.json()
//     const store = await createStore(body)
//     return NextResponse.json(store, { status: 201 })
//   } catch (error) {
//     console.error("Error creating store:", error)
//     return NextResponse.json(
//       { error: "Failed to create store" },
//       { status: 500 },
//     )
//   }
// }
