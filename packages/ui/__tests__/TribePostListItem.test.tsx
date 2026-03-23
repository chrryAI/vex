import { render } from "@testing-library/react"
import { vi } from "vitest"
import { TribePostListItem } from "../Tribe"

vi.mock("../Image", () => ({
  default: () => <div data-testid="mock-img" />,
}))

vi.mock("../context/StylesContext", () => ({
  useStyles: () => ({
    utilities: {
      row: { style: {} },
      small: { style: {} },
      inverted: { style: {} },
      transparent: { style: {} },
      button: { style: {} },
      link: { style: {} },
      danger: { style: {} },
    },
  }),
}))

vi.mock("../context/providers", () => ({
  useAuth: () => ({
    setLanguage: vi.fn(),
    rtl: false,
    language: "en",
  }),
  useChat: () => ({
    creditsLeft: 100,
  }),
  useNavigationContext: () => ({
    addParams: vi.fn(),
    push: vi.fn(),
  }),
  useTribe: () => ({
    liveReactions: [],
  }),
  useApp: () => ({
    app: { id: "test", name: "test", slug: "test", capabilities: [] },
  }),
}))

vi.mock("../platform", () => ({
  Div: "div",
  MotiView: "div",
  P: "p",
  H1: "h1",
  H2: "h2",
  H3: "h3",
  Span: "span",
  Strong: "strong",
  Button: "button",
  useInView: () => ({
    ref: vi.fn(),
    inView: true,
  }),
  usePlatform: () => ({}),
  useTheme: () => ({}),
  Video: "video",
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock("../a/A", () => ({
  default: "a",
}))
vi.mock("../AppLink", () => ({
  default: "a",
}))
vi.mock("../MarkdownContent.web", () => ({
  default: () => <div />,
}))
vi.mock("../TribePost", () => ({
  default: () => <div />,
}))
vi.mock("../LanguageSwitcher", () => ({
  default: () => <div />,
}))
vi.mock("../Weather", () => ({
  default: () => <div />,
}))
vi.mock("../icons", () => ({
  CircleCheck: () => <svg />,
  HeartPlus: () => <svg />,
  Trash2: () => <svg />,
  ArrowLeft: () => <svg />,
  BrickWallFire: () => <svg />,
  CalendarIcon: () => <svg />,
  CircleX: () => <svg />,
  LoaderCircle: () => <svg />,
  Pin: () => <svg />,
  Quote: () => <svg />,
  Settings2: () => <svg />,
  Sparkles: () => <svg />,
}))
vi.mock("../ConfirmButton", () => ({
  default: () => <button type="button" />,
}))
vi.mock("../TribeTranslate", () => ({
  default: () => <div />,
}))

describe("TribePostListItem", () => {
  const defaultMockPost = {
    id: "post1",
    content: "Hello world",
    createdAt: new Date(),
    app: { id: "app1", name: "Test App", slug: "test" },
    user: { id: "user1", name: "User 1" },
    agent: null,
    reactions: [],
    files: [],
  }

  const defaultProps = {
    index: 0,
    reduceMotion: false,
    isDark: false,
    isMobileDevice: false,
    isSmallDevice: false,
    viewPortWidth: 1000,
    t: (key: string) => key,
    timeAgo: () => "1 hour ago",
    isTogglingLike: undefined,
    tryAppCharacterProfile: undefined,
    setTryAppCharacterProfile: vi.fn(),
    tyingToReact: undefined,
    setTyingToReact: vi.fn(),
    owner: true,
    deletePost: vi.fn() as any,
    setSignInPart: vi.fn(),
    setAppStatus: vi.fn(),
    tags: [],
    setTags: vi.fn(),
    postsRef: { current: null },
    addParams: vi.fn(),
    push: vi.fn(),
    downloadImage: vi.fn() as any,
  }

  it("renders basic post without images", () => {
    const { container } = render(
      <TribePostListItem post={defaultMockPost as any} {...defaultProps} />,
    )
    expect(container).toBeDefined()
  })

  it("renders post with images on wide viewport", () => {
    const postWithImages = {
      ...defaultMockPost,
      images: [{ url: "test-image.jpg" }],
    }
    const { container } = render(
      <TribePostListItem
        post={postWithImages as any}
        {...defaultProps}
        viewPortWidth={1000}
        isMobileDevice={false}
      />,
    )
    expect(container).toBeDefined()
  })

  it("renders post with images on small viewport (<500)", () => {
    const postWithImages = {
      ...defaultMockPost,
      images: [{ url: "test-image.jpg" }],
    }
    const { container } = render(
      <TribePostListItem
        post={postWithImages as any}
        {...defaultProps}
        viewPortWidth={400}
      />,
    )
    expect(container).toBeDefined()
  })

  it("renders post with images on mobile device", () => {
    const postWithImages = {
      ...defaultMockPost,
      images: [{ url: "test-image.jpg" }],
    }
    const { container } = render(
      <TribePostListItem
        post={postWithImages as any}
        {...defaultProps}
        viewPortWidth={800}
        isMobileDevice={true}
      />,
    )
    expect(container).toBeDefined()
  })

  it("renders post with videos and files", () => {
    const postWithMedia = {
      ...defaultMockPost,
      videos: [{ url: "test-video.mp4" }],
      files: [{ url: "test.pdf", fileName: "test.pdf" }],
    }
    const { container } = render(
      <TribePostListItem
        post={postWithMedia as any}
        {...defaultProps}
        owner={false}
      />,
    )
    expect(container).toBeDefined()
  })

  it("renders with reduceMotion and isDark true", () => {
    const { container } = render(
      <TribePostListItem
        post={defaultMockPost as any}
        {...defaultProps}
        reduceMotion={true}
        isDark={true}
      />,
    )
    expect(container).toBeDefined()
  })
})
