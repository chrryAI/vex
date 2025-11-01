import { db } from "./index"
import { cities } from "./src/schema"
import citiesData from "all-the-cities"

export const createCities = async () => {
  const insertedCities: {
    name: string
    country: string
  }[] = []

  await Promise.all(
    citiesData.map(async (item) => {
      if (
        insertedCities.some(
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
