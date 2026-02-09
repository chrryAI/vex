import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { safeJSONStringify } from "../utils/security"
import { BlogPostWithContent } from "../blog-loader"
import styles from "./BlogPost.module.scss"

interface BlogPostProps {
  post: BlogPostWithContent
  locale: string
}

export default function BlogPost({ post, locale }: BlogPostProps) {
  // Simple time ago function
  const timeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    const intervals = [
      { label: "year", seconds: 31536000 },
      { label: "month", seconds: 2592000 },
      { label: "day", seconds: 86400 },
      { label: "hour", seconds: 3600 },
      { label: "minute", seconds: 60 },
    ]

    for (const interval of intervals) {
      const count = Math.floor(seconds / interval.seconds)
      if (count >= 1) {
        return `${count} ${interval.label}${count !== 1 ? "s" : ""} ago`
      }
    }

    return "just now"
  }

  return (
    <div style={{ maxWidth: 768 }}>
      {/* JSON-LD structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJSONStringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.excerpt,
            datePublished: post.date,
            author: {
              "@type": "Person",
              name: post.author,
            },
            keywords: post.keywords?.join(", ") || "",
          }),
        }}
      />

      <div className={styles.backToBlogContainer}>
        <a className={styles.backToBlog} href="/blog">
          ← Back to Blog
        </a>
      </div>

      <article className={styles.article}>
        <p className={styles.date}>
          {timeAgo(post.date)} by {post.author}
        </p>

        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.content}
        </ReactMarkdown>
      </article>
    </div>
  )
}
