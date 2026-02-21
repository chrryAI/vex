import { describe, it, expect, vi, beforeEach } from "vitest"
import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import MarkdownContent from "../MarkdownContent.web"
import { mockAppContext, mockTheme } from "./mocks/mockContexts"

// Mock dependencies
vi.mock("../context/AppContext", () => ({
  useAppContext: () => mockAppContext,
}))

vi.mock("../platform", async (importOriginal) => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    useTheme: () => mockTheme,
    Div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Button: ({ children, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
  }
})

vi.mock("../platform/usePlatformStyles", () => ({
  usePlatformStyles: (styles: any) => styles,
}))

// Mock components used in overrides
vi.mock("../Img", () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} data-testid="custom-img" />,
}))

vi.mock("../TextWithLinks", () => ({
  default: ({ text, href, onClick }: any) => (
    <a href={href} onClick={onClick} data-testid="custom-link">
      {text}
    </a>
  ),
}))

vi.mock("../Store", () => ({
  default: () => <div data-testid="custom-store">Store Component</div>,
}))

vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children, language }: any) => (
    <pre data-testid="syntax-highlighter" data-language={language}>
      {children}
    </pre>
  ),
}))

describe("MarkdownContent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders basic markdown content", () => {
    render(<MarkdownContent content="Hello **world**" />)
    expect(screen.getByText("Hello")).toBeDefined()
    expect(screen.getByText("world")).toBeDefined()
    // Markdown-to-jsx renders strong tags for **
    const strongElement = screen.getByText("world")
    expect(strongElement.tagName).toBe("STRONG")
  })

  it("renders code blocks with custom component", () => {
    const code = "console.log('test')"
    const markdown = "```javascript\n" + code + "\n```"

    render(<MarkdownContent content={markdown} />)

    const codeBlock = screen.getByTestId("syntax-highlighter")
    expect(codeBlock).toBeDefined()
    expect(codeBlock.getAttribute("data-language")).toBe("javascript")
    expect(codeBlock.textContent).toContain(code)
  })

  it("renders inline code correctly", () => {
    render(<MarkdownContent content="Use `code` here" />)
    const inlineCode = screen.getByText("code")
    expect(inlineCode.tagName).toBe("CODE")
  })

  it("renders links with custom TextWithLinks component", () => {
    render(<MarkdownContent content="[Link](https://example.com)" />)
    const link = screen.getByTestId("custom-link")
    expect(link).toBeDefined()
    expect(link.getAttribute("href")).toBe("https://example.com")
    expect(link.textContent).toBe("Link")
  })

  it("renders images with custom Img component", () => {
    render(<MarkdownContent content="![Alt text](image.jpg)" />)
    const img = screen.getByTestId("custom-img")
    expect(img).toBeDefined()
    expect(img.getAttribute("src")).toBe("image.jpg")
    expect(img.getAttribute("alt")).toBe("Alt text")
  })

  it("handles citations correctly", () => {
    const content = "This is a fact [1]."
    const webSearchResults = [
      { title: "Source 1", url: "https://source1.com", snippet: "Snippet 1" }
    ]

    render(<MarkdownContent content={content} webSearchResults={webSearchResults} />)

    const citation = screen.getByTestId("custom-link")
    expect(citation).toBeDefined()
    expect(citation.textContent).toBe("[1]")
    expect(citation.getAttribute("href")).toBe("https://source1.com")
  })

  it("renders custom components like <StoreCompact />", () => {
    render(<MarkdownContent content="<StoreCompact />" />)
    expect(screen.getByTestId("custom-store")).toBeDefined()
  })

  it("memoizes options correctly (implicit test via re-renders)", () => {
    const { rerender } = render(<MarkdownContent content="Initial" />)
    expect(screen.getByText("Initial")).toBeDefined()

    rerender(<MarkdownContent content="Updated" />)
    expect(screen.getByText("Updated")).toBeDefined()

    // If memoization was broken in a way that caused crashes or weird behavior,
    // it would likely fail here or in more complex scenarios.
    // Since we're just testing the component logic, ensuring it updates is good.
  })
})
