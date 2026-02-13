"use client"

import { ExternalLink, Github, Package } from "lucide-react"
import { chrryDev } from "@chrryai/chrry/utils/siteConfig"

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
              <Github />{" "}
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://github.com/chrryai"
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
            {config.links.github && (
              <a
                href={config.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                <Github size={20} />
                <span>GitHub</span>
                <ExternalLink size={16} />
              </a>
            )}
            {config.links.npm && (
              <a
                href={config.links.npm}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                <Package size={20} />
                <span>npm</span>
                <ExternalLink size={16} />
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
