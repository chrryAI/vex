/**
 * Generated from BlogList.module.scss
 * Auto-converted SCSS to Unified Styles
 *
 * Works on both web and native! 🎉
 */

export const BlogListStyleDefs = {
  blogList: {
    padding: 0,
    margin: 0,
    maxWidth: 768,
    marginTop: 10,
  },
  title: {
    marginTop: 0,
    marginBottom: 0,
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
} as const

import { createStyleHook } from "../../../../packages/ui/styles/createStyleHook"
import { createUnifiedStyles } from "../../../../packages/ui/styles/createUnifiedStyles"

export const BlogListStyles = createUnifiedStyles(BlogListStyleDefs)

// Type for the hook return value
type BlogListStylesHook = {
  [K in keyof typeof BlogListStyleDefs]: {
    className?: string
    style?: Record<string, any>
  }
}

// Create the style hook using the factory
export const useBlogListStyles =
  createStyleHook<BlogListStylesHook>(BlogListStyles)
