import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"

export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  date: string
  author: string
  image?: string
  tags?: string[]
  keywords?: string[]
}

export interface BlogPostWithContent extends BlogPost {
  content: string
}

const BLOG_DIR = path.join(process.cwd(), "content/blog")

/**
 * Sanitize slug for URL safety
 */
function sanitizeSlug(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
}

/**
 * Get all blog posts sorted by date (newest first)
 */
export function getBlogPosts(): BlogPost[] {
  try {
    const files = fs.readdirSync(BLOG_DIR)

    return files
      .filter((file) => file.endsWith(".md"))
      .map((file) => {
        const filePath = path.join(BLOG_DIR, file)
        const content = fs.readFileSync(filePath, "utf-8")
        const { data } = matter(content)

        return {
          slug: sanitizeSlug(file.replace(".md", "")),
          title: data.title || "Untitled",
          excerpt: data.excerpt || "No excerpt available",
          date: data.date || new Date().toISOString().split("T")[0],
          author: data.author || "Anonymous",
          image: data.image,
          tags: data.tags || [],
          keywords: data.keywords || [],
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  } catch (error) {
    console.error("Error reading blog posts:", error)
    return []
  }
}

/**
 * Get a single blog post by slug
 */
export function getBlogPost(slug: string): BlogPostWithContent | null {
  try {
    const filePath = path.join(BLOG_DIR, `${slug}.md`)

    if (!fs.existsSync(filePath)) {
      return null
    }

    const fileContent = fs.readFileSync(filePath, "utf-8")
    const { data, content } = matter(fileContent)

    return {
      slug: sanitizeSlug(slug),
      title: data.title || "Untitled",
      excerpt: data.excerpt || "No excerpt available",
      date: data.date || new Date().toISOString().split("T")[0],
      author: data.author || "Anonymous",
      image: data.image,
      tags: data.tags || [],
      keywords: data.keywords || [],
      content, // React-markdown handles rendering safely
    }
  } catch (error) {
    console.error(`Error reading blog post ${slug}:`, error)
    return null
  }
}
