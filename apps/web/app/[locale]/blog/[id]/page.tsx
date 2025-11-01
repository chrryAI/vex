import React from "react"
import fs from "fs"
import path from "path"
import matter from "gray-matter"
import ReactMarkdown from "react-markdown"
import { ArrowLeft } from "chrry/icons"
import styles from "./page.module.scss"
import { Metadata } from "next"
import { getMetadata } from "../../../../utils"
import Image from "next/image"
import { getLocale } from "next-intl/server"
import { defaultLocale, LANGUAGES } from "chrry/locales"
import timeAgo from "chrry/utils/timeAgo"
import Img from "chrry/Img"
import MarkdownContent from "chrry/MarkdownContent"
import Link from "next/link"
import { FRONTEND_URL } from "chrry/utils"
import { getSiteConfig } from "chrry/utils/siteConfig"
import { notFound } from "next/navigation"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const locale = await getLocale()

  const decodedId = decodeURIComponent(id)
  const BLOG_DIR = path.join(process.cwd(), "app/content/blog")
  const filePath = path.join(BLOG_DIR, `${decodedId}.md`)

  if (!fs.existsSync(filePath)) {
    notFound()
  }
  // Read and parse the markdown file
  const fileContent = fs.readFileSync(filePath, "utf-8")
  const { data } = matter(fileContent)

  const title = `${data.title} - Vex`
  const description = data.excerpt
  const canonicalUrl = `https://chrry.ai/en/blog/${id}` // Always point to English version

  const metadata: Metadata = getMetadata({
    title,
    description,
    keywords: data.keywords || [],
    alternates: {
      canonical: canonicalUrl,
      languages: LANGUAGES.reduce(
        (acc, language) => {
          acc[language.code] = `https://chrry.ai/${language.code}/blog/${id}`
          return acc
        },
        {} as Record<string, string>,
      ),
    },
  })

  return metadata
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const siteConfig = getSiteConfig()
  if (siteConfig.mode !== "vex") {
    return notFound()
  }
  const { id } = (await params) as { id: string }
  const decodedId = decodeURIComponent(id)
  const locale = await getLocale()

  const BLOG_DIR = path.join(process.cwd(), `app/content/blog`)
  const filePath = path.join(BLOG_DIR, `${decodedId}.md`)

  const images = {
    "live-testing-fingerprint-strategy":
      "/images/blog/live-testing-fingerprint-strategy.jpg",
    "e2e-testing-strategy": "/images/blog/e2e-testing-strategy.jpg",
    "extension-first-architecture":
      "/images/blog/extension-first-architecture.jpg",
    "guest-subscriptions-and-invitations":
      "/images/blog/guest-subscriptions-and-invitations.jpg",
    "rag-system-architecture": "/images/blog/rag-system-architecture.jpg",
    "ai-character-profiling-system":
      "/images/blog/ai-character-profiling-system.jpg",
    "what-if-i-was-chatgpt": "/images/blog/what-if-i-was-chatgpt.jpg",
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`)
    notFound()
  }
  // Read and parse the markdown file
  const fileContent = fs.readFileSync(filePath, "utf-8")
  const { data, content } = matter(fileContent)
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: data.title,
            description: data.excerpt,
            datePublished: data.date,
            author: {
              "@type": "Person",
              name: data.author,
            },
            keywords: data.keywords || "",
          }),
        }}
      />

      <div className={styles.backToBlogContainer}>
        <Link
          className={styles.backToBlog}
          href={`${locale === defaultLocale ? "" : `/${locale}`}/blog`}
        >
          <ArrowLeft size={16} /> {"Back to Blog"}
        </Link>
      </div>
      <article className={styles.article}>
        <p className={styles.date}>
          {timeAgo(data.date, locale)} by {data.author}
        </p>
        {false ? (
          <Img
            style={{
              marginTop: "0.938rem",
              minHeight: "20rem",
              borderRadius: "1.25rem",
            }}
            src={images[id as keyof typeof images]}
            alt={data.title}
            containerClass={styles.image}
            width={"100%"}
            height={"auto"}
          />
        ) : (
          <div className={styles.videoContainer}>
            <video
              className={styles.video}
              src={`${FRONTEND_URL}/video/blob.mp4`}
              autoPlay
              loop
              muted
              playsInline
            ></video>
            {"Thinking..."}
          </div>
        )}
        <MarkdownContent content={content} />
      </article>
    </div>
  )
}
