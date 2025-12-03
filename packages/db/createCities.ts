import { db } from "./index"
import { cities } from "./src/schema"
import citiesData from "all-the-cities"

export const createCities = async () => {
  const insertedCities: {
    name: string
    country: string
  }[] = []
  const isCI = process.env.CI
  const isDev = isCI
    ? false
    : process.env.DB_URL && process.env.DB_URL.includes("localhost")
  const filteredCitiesData = isDev
    ? citiesData.filter((item) => {
        return ["NL", "JP"].includes(item.country)
      })
    : citiesData

  const existingCities = await db.select().from(cities)

  await Promise.all(
    filteredCitiesData.map(async (item) => {
      if (
        insertedCities.some(
          (city) => city.name === item.name && city.country === item.country,
        ) ||
        existingCities.some(
          (city) => city.name === item.name && city.country === item.country,
        )
      ) {
        return
      }

      insertedCities.push(item)
      console.log("inserting", item.name, item.country)
      await db.insert(cities).values({
        name: item.name,
        country: item.country,
        population: item.population,
      })
    }),
  )
}
