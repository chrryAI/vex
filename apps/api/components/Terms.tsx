import { chrryDev } from "./dotDev.tsx"

const css = `
.container {
  flex-direction: column;
  max-width: 50rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  display: flex;
  gap: 0.5rem;
}
.header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.header a { font-size: 0.85rem; }
h1 { margin: 0; font-size: 1.75rem; }
h2 { margin: 1.25rem 0 0.25rem; font-size: 1.1rem; }
p  { margin: 0.2rem 0; font-size: 0.95rem; line-height: 1.6; color: var(--shade-7); }
section { border-bottom: 1px dashed var(--shade-2); padding-bottom: 1rem; }
.meta { font-size: 0.85rem; color: var(--shade-6); margin-top: 1.5rem; display: flex; gap: 0.4rem; align-items: center; }
.ai-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 1.5rem;
  padding: 0.6rem 1rem;
  background: var(--shade-1);
  border: 1px solid var(--shade-2);
  border-radius: var(--radius);
  font-size: 0.9rem;
  color: var(--accent-6);
  text-decoration: none;
}
.ai-link:hover { background: var(--shade-2); }
`

export default function Terms({ hostname }: { hostname?: string }) {
  const config = chrryDev
  const name = config.name || "Chrry"
  const url = config.url || "https://chrry.ai"
  const email = "legal@chrry.ai"
  const updated = "March 15, 2026"

  return (
    <>
      <style>{css}</style>
      <div className="container">
        <div className="header">
          <a href="/">← Home 🍒</a>
          <span>/</span>
          <a href="/privacy">Privacy 🤫</a>
        </div>

        <h1>📋 Terms of Use</h1>
        <p>
          These terms govern your use of <strong>{name}</strong> (
          <a href={url}>{url}</a>) and all apps powered by Chrry AI. By using
          the service, you agree to these terms.
        </p>

        <section>
          <h2>1. Acceptance</h2>
          <p>
            By accessing or using {name}, you confirm that you are at least 13
            years old and accept these Terms of Use and our{" "}
            <a href="/privacy">Privacy Policy</a>. If you're using {name} on
            behalf of an organisation, you represent that you have authority to
            bind that organisation.
          </p>
        </section>

        <section>
          <h2>2. Permitted Use</h2>
          <p>
            You may use {name} for lawful purposes only. You agree not to misuse
            the service — including attempting to reverse-engineer, scrape, or
            disrupt the platform. We reserve the right to suspend accounts that
            violate these terms.
          </p>
        </section>

        <section>
          <h2>3. Agentic AI</h2>
          <p>
            {name} may perform autonomous actions on your behalf (searching,
            writing, scheduling, executing code). You are responsible for
            reviewing AI outputs before acting on them. We do not guarantee
            accuracy and accept no liability for decisions made based on AI
            responses.
          </p>
        </section>

        <section>
          <h2>4. Credits & Pricing</h2>
          <p>
            Some features require AI credits. Credits are consumed when you
            create anonymous apps or use advanced AI capabilities. Credits are
            non-refundable once used but never expire. Subscription plans renew
            automatically — cancel anytime from Settings before the renewal
            date.
          </p>
        </section>

        <section>
          <h2>5. Google Calendar & Third-Party Integrations</h2>
          <p>
            If you connect Google Calendar or other third-party services, {name}{" "}
            will access only the data scopes you explicitly authorise. We do not
            store third-party credentials — only OAuth tokens necessary for the
            integration. You can revoke access at any time from Settings.
          </p>
        </section>

        <section>
          <h2>6. Intellectual Property</h2>
          <p>
            Content you create using {name} is yours. {name}'s platform,
            branding, and codebase are the property of Chrry AI. The core
            platform is open source under AGPLv3 — see{" "}
            <a
              href="https://github.com/chrryai"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/chrryai
            </a>
            .
          </p>
        </section>

        <section>
          <h2>7. Liability</h2>
          <p>
            {name} is provided "as is". We are not liable for indirect,
            incidental, or consequential damages arising from use of the
            service. Our liability is limited to the amount you paid in the 3
            months prior to any claim.
          </p>
        </section>

        <section>
          <h2>8. Changes</h2>
          <p>
            We may update these terms. We'll notify you via email or in-app
            notice for material changes. Continued use after the effective date
            constitutes acceptance.
          </p>
        </section>

        <section>
          <a
            href={`${url}?ask=${encodeURIComponent("🥋 What are the terms of use for Chrry AI?")}`}
            className="ai-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            🍒 Questions about these terms? Ask our AI
          </a>
        </section>

        <p className="meta">
          🐸 Last updated: {updated} · <a href={`mailto:${email}`}>{email}</a>
        </p>
      </div>
    </>
  )
}
