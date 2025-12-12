import { BlogPost } from "../blog-loader"
import styles from "./BlogList.module.scss"

interface BlogListProps {
  posts: BlogPost[]
  locale: string
}

export default function BlogList({ posts, locale }: BlogListProps) {
  // Simple time ago function for client-side rendering
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
    <div>
      <h1 className={styles.title}>📝 Blog</h1>
      <ul className={styles.blogList}>
        {posts.map((post) => (
          <li key={post.slug} style={{ marginBottom: 24 }}>
            <h2>
              <a href={`/blog/${post.slug}`}>{post.title}</a>
            </h2>
            <p>{post.excerpt}</p>
            <small>
              {timeAgo(post.date)} by {post.author}
            </small>
          </li>
        ))}
      </ul>
    </div>
  )
}
