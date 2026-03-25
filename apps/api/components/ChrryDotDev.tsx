export const chrryDev = {
  mode: "chrryDev",
  slug: "chrryDev",
  storeSlug: "chrry",
  favicon: "chrry",
  isStoreApp: true,
  store: "https://chrry.dev",
  name: "Chrry",
  domain: "chrry.dev",
  url: "https://chrry.dev",
  email: "iliyan@chrry.ai",
  description:
    "🐝 A modern, cross-platform AI Infrastructure for Universal React and TypeScript",
  logo: "/assets/cherry-logo.svg", // Cross-platform SVG
  primaryColor: "#E91E63", // Cherry pink
  links: {
    github: "https://github.com/chrryAI/vex",
    npm: "https://www.npmjs.com/package/@chrryai/chrry",
    // docs: "https://chrry.dev/docs",
    // demo: "https://chrry.dev/demo",
  },
  features: [
    {
      title: "Sushi(WIP)",
      description:
        "🏢 Enterprise-grade compiler infrastructure with multi-agent 🤖 coordination",
      icon: "🍣",
      link: "https://github.com/chrryAI/sushi",
      isOpenSource: true,
    },
    {
      title: "Waffles",
      description: "Playwright testing utilities for Sushi 🍣 e2e strikes 🎯",
      icon: "🧇",
      link: "https://github.com/chrryAI/waffles",
      isOpenSource: true,
    },
    {
      title: "Pepper",
      description: "Universal router with view transitions",
      icon: "🌶️",
      link: "https://github.com/chrryAI/pepper",
      isOpenSource: true,
    },
    {
      title: "Components",
      description: "100+ production-ready UI components",
      icon: "🎨",
      link: "https://github.com/chrryAI/vex/tree/main/packages/ui",
      isOpenSource: true,
    },
    {
      title: "Styles",
      description: "SCSS to TypeScript converter",
      icon: "🎭",
      link: "https://github.com/chrryAI/vex/tree/main/scripts/scss-to-universal.js",
      isOpenSource: true,
    },
    {
      title: "Hooks",
      description: "Reusable React hooks",
      icon: "🪝",
      link: "https://github.com/chrryAI/vex/tree/main/packages/ui/hooks",
      isOpenSource: true,
    },
    {
      title: "Context",
      description: "State management providers",
      icon: "🔄",
      link: "https://github.com/chrryAI/vex/blob/main/packages/ui/context",
      isOpenSource: true,
    },
    {
      title: "Platform",
      description: "Cross-platform utilities",
      icon: "📱",
      link: "https://github.com/chrryAI/vex/tree/main/packages/ui/platform",
      isOpenSource: true,
    },
  ],
}

// Inline SVG icons for SSR compatibility
const GithubIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
)

const PackageIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m7.5 4.27 9 5.15" />
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </svg>
)

const ExternalLinkIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  </svg>
)

const css = `

.container {
  flex-direction: column;
  max-width: 37.5rem;
  margin: 0 auto;
  padding: 0.3125rem 0.5rem 1.25rem;
  display: flex;
}

.logo {
  flex-direction: column;
  justify-content: center;
  align-items: center;
  display: flex;
}



.header {
  flex-flow: column wrap;
  display: flex;
}

.description {
  margin-top: 0;
  display: flex;
}

.links {
  gap: 1.5625rem;
  margin-top: 0.5rem;
  margin-bottom: 1.25rem;
  display: flex;
}

.link {
  display: inline-flex;
}

.features {
  flex-direction: column;
  gap: 0.5rem;
  display: flex;
}

.feature {
  display: flex;
  flex-direction: column;
  align-self: flex-start;
  align-items: flex-start;
}

.vex {
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4375rem;
  width: 100%;
  margin-top: 0.5rem;
  display: flex;
}

.featureTitle {
  gap: 0.5rem;
  margin: 0;
  display: flex;
  font-size: 1rem;
}

.featureDescription {
  color: var(--foreground);
  font-size: 0.95rem;

}


`

export default function Chrry() {
  const config = chrryDev

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="container">
        <div className="header">
          <div className="header-inner">
            <div className="vex">
              <span>Built by </span>
              <a href={"https://vex.chrry.ai"}>
                <img
                  alt="Vex"
                  src="/icons/vex-icon.png"
                  width={24}
                  height={24}
                />
                Vex
              </a>
              <code className="install-cmd">npm install @chrryai/chrry</code>
            </div>
          </div>

          <div className="logo">
            <img
              alt="Chrry"
              src="/logo/cherry-500.png"
              width={250}
              height={250}
            />
            <h1>
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={"https://chrry.ai"}
              >
                Chrry
              </a>
            </h1>
          </div>

          <p className="description">{config.description}</p>

          <div className="links">
            <a
              href={"https://chrry.ai"}
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              🍒 Chrry.ai
            </a>
            <a href="https://chrry.ai/about">🧐 /about</a>
            <a href="/privacy">🤫 /privacy</a>
            {config.links.github && (
              <a
                href={config.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                <GithubIcon />
                <span>GitHub</span>
                <ExternalLinkIcon />
              </a>
            )}
            {config.links.npm && (
              <a
                href={config.links.npm}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                <PackageIcon />
                <span>npm</span>
                <ExternalLinkIcon />
              </a>
            )}
          </div>
        </div>

        <div className="features">
          {config.features.map((feature) => (
            <a
              key={feature.icon}
              href={feature.link}
              target={feature.isOpenSource ? "_blank" : undefined}
              rel={feature.isOpenSource ? "noopener noreferrer" : undefined}
              className="feature"
            >
              <div className="featureTitle">
                <span>{feature.icon}</span> <span>{feature.title}</span>
              </div>
              <p className="featureDescription">{feature.description}</p>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
