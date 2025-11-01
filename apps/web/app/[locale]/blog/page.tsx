import fs from "fs"
import path from "path"
import matter from "gray-matter"
import Link from "next/link"
import styles from "./page.module.scss"
import { Metadata } from "next"
import { getMetadata } from "../../../utils"
import { NotebookPen } from "chrry/icons"
import { getLocale } from "next-intl/server"
import timeAgo from "chrry/utils/timeAgo"
import Img from "chrry/Img"
import { LANGUAGES } from "chrry/locales"
import { defaultLocale } from "chrry/locales"
import { getSiteConfig } from "chrry/utils/siteConfig"
import { notFound } from "next/navigation"

export async function generateMetadata() {
  const title = "Blog - Vex"
  const description = "Read about the latest news and updates from Vex"
  const canonicalUrl = `https://chrry.ai/blog` // Always point to English version
  const metadata: Metadata = getMetadata({
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: LANGUAGES.reduce(
        (acc, language) => {
          acc[language.code] = `https://chrry.ai/${language.code}/blog`
          return acc
        },
        {} as Record<string, string>,
      ),
    },
  })

  return metadata
}

function getBlogPosts() {
  const BLOG_DIR = path.join(process.cwd(), `app/content/blog`)

  const files = fs.readdirSync(BLOG_DIR)

  return files
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const filePath = path.join(BLOG_DIR, file)
      const content = fs.readFileSync(filePath, "utf-8")
      const { data } = matter(content)
      return {
        slug: file.replace(".md", ""),
        title: data.title || "Untitled",
        excerpt: data.excerpt || "No excerpt available",
        date: data.date || new Date().toISOString().split("T")[0],
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export default async function BlogPage() {
  const siteConfig = getSiteConfig()
  if (siteConfig.mode !== "vex") {
    return notFound()
  }
  const locale = await getLocale()
  const posts = getBlogPosts()
  return (
    <div>
      <h1 className={styles.title}>
        <NotebookPen size={24} /> Blog{" "}
      </h1>
      <ul className={styles.blogList}>
        {posts.map((post) => (
          <li key={post.slug} style={{ marginBottom: 24 }}>
            <h2>
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
            <p>{post.excerpt}</p>
            <small>{timeAgo(post.date, locale)}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}
