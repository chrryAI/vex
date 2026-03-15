import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"

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
.header a {
  font-size: 0.85rem;
}
h1 { margin: 0; font-size: 1.75rem; }
h2 { margin: 1.25rem 0 0.25rem; font-size: 1.1rem; }
p  { margin: 0.2rem 0; font-size: 0.95rem; line-height: 1.6; color: var(--shade-7); }
section { border-bottom: 1px dashed var(--shade-2); padding-bottom: 1rem; }
.meta { font-size: 0.85rem; color: var(--shade-6); margin-top: 1.5rem; display: flex; gap: 0.4rem; align-items: center; }
.ai-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  text-align: center;
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

export default function Privacy({ hostname }: { hostname?: string }) {
  const config = getSiteConfig(hostname || "chrry.ai")
  const name = config.name || "Chrry"
  const url = config.url || "https://chrry.ai"
  const email = "iliyan@chrry.ai"
  const updated = "March 15, 2025"

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="container">
        <div className="header">
          <a href="/">← Home 🍒</a>
          <span>/</span>
          <a href="/terms">Terms 🥋</a>
        </div>

        <h1>🔒 Privacy Policy</h1>
        <p>
          This policy applies to <strong>{name}</strong> (
          <a href={url}>{url}</a>) and all white-label apps powered by Chrry AI.
        </p>

        <section>
          <h2>1. What We Collect</h2>
          <p>
            We collect only what's necessary: your messages (to power AI
            responses), a device fingerprint or account token (to maintain your
            session), and anonymous usage analytics (page views, feature
            interactions, performance metrics, conversion events). We do{" "}
            <strong>not</strong> sell your data.
          </p>
        </section>

        <section>
          <h2>2. Analytics</h2>
          <p>
            We use privacy-first analytics (Plausible) — no cookies, no
            cross-site tracking. Data is aggregated and anonymised. We track:
            page views, feature usage, performance, and conversion flows.
          </p>
        </section>

        <section>
          <h2>3. AI Conversations</h2>
          <p>
            Your chat messages are sent to our AI inference provider to generate
            responses. If you enable memory, key facts from your conversations
            are stored and used to personalise future responses. You can delete
            your memory at any time from Settings.
          </p>
        </section>

        <section>
          <h2>🔥 4. Burn Mode (Anonymous Sessions)</h2>
          <p>
            Burn mode is designed for maximum privacy: messages are ephemeral,
            nothing is stored after the session ends, no memory is extracted,
            and you maintain full data sovereignty. Activate via the 🔥 icon.
          </p>
        </section>

        <section>
          <h2>5. Character Profiles</h2>
          <p>
            When you interact with AI characters, we may store conversation
            context to maintain consistent character behaviour across sessions.
            This data is never shared with third parties and you can clear it at
            any time.
          </p>
        </section>

        <section>
          <h2>6. Cookies & Storage</h2>
          <p>
            We use <code>localStorage</code> and cookies only for essential
            session management: your auth token, device ID, theme preference,
            and locale. No marketing or tracking cookies.
          </p>
        </section>

        <section>
          <h2>7. Security</h2>
          <p>
            All data is encrypted in transit (TLS) and at rest. We follow
            security best practices and conduct regular audits. If you discover
            a vulnerability, please email{" "}
            <a href={`mailto:${email}`}>{email}</a>.
          </p>
        </section>

        <section>
          <h2>8. Your Rights</h2>
          <p>
            You have the right to access, export, correct, or delete your data
            at any time. Contact us at <a href={`mailto:${email}`}>{email}</a>{" "}
            or use the Settings → Data panel in the app.
          </p>
        </section>

        <section>
          <h2>9. Changes</h2>
          <p>
            We'll notify you of material changes via email or an in-app notice.
            Continued use after changes constitutes acceptance.
          </p>
        </section>
        <section>
          <a
            href={`${url}?ask=🤫 Tell me about your privacy policy`}
            className="ai-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            🍒 Questions about your privacy? Ask our AI
          </a>
        </section>

        <p className="meta">
          🐸 Last updated: {updated} · <a href={`mailto:${email}`}>{email}</a>
        </p>
      </div>
    </>
  )
}
