import { BlogPost } from "../blog-loader"
// @ts-ignore
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
      {posts.length === 0 ? (
        <p className={styles.emptyState}>
          No posts found. Check back later! 🌱
        </p>
      ) : (
        <ul className={styles.blogList}>
          {posts.map((post) => (
            <li key={post.slug} style={{ marginBottom: 24 }}>
              <article>
                <h2>
                  <a
                    href={`/blog/${post.slug}`}
                    aria-label={`Read full post: ${post.title}`}
                  >
                    {post.title}
                  </a>
                </h2>
                <p>{post.excerpt}</p>
                <small>
                  <time dateTime={post.date}>{timeAgo(post.date)}</time> by{" "}
                  {post.author}
                </small>
                <br />
                <a
                  href={`/blog/${post.slug}`}
                  className={styles.readMore}
                  aria-label={`Read more about ${post.title}`}
                >
                  Read more →
                </a>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
