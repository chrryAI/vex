import { Page, Locator, expect } from "@playwright/test"

/** Type-safe input names for autocomplete */
export type InputName = "skInput" | "r8Input"

/** Type-safe button names for autocomplete */
export type ButtonName =
  | "accountButton"
  | "plusButton"
  | "plusButton1"
  | "buttonButton"
  | "tcnButton"
  | "pauseButton"
  | "freeByokButton"
  | "openroutersaveButton"
  | "fluxsaveButton"
  | "setupS3Button"
  | "choose10gbMonthFreeButton"
  | "hippoWmButtonButton"
  | "buttonButton1"
  | "switchToLightModeButton"
  | "setColorSchemeToRedButton"
  | "setColorSchemeButton"
  | "setColorSchemeToBlueButton"
  | "setColorSchemeToGreenButton"
  | "setColorSchemeButton1"
  | "setColorSchemeButton2"

/** Type-safe link names for autocomplete */
export type LinkName =
  | "chrryLink"
  | "aboutLink"
  | "iliyanLink"
  | "chrryLink1"
  | "perplexityLink"
  | "vexLink"
  | "sushiLink"
  | "claudeLink"
  | "popcornLink"
  | "twentythreeAiAppsLink"
  | "chrryLink2"
  | "agencyLink"
  | "sovereignLink"
  | "wannathisLink"
  | "agplv3Link"
  | "vexLink1"
  | "sushiLink1"
  | "pepperLink"
  | "wafflesLink"
  | "orbstackLink"
  | "postgresqlLink"
  | "falkordbLink"
  | "bunLink"
  | "honoLink"
  | "reactLink"
  | "viteLink"
  | "biomeLink"
  | "tauriLink"
  | "hetznerLink"
  | "minioLink"
  | "openaiLink"
  | "deepseekLink"
  | "claudeLink1"
  | "perplexityLink1"
  | "grokLink"
  | "geminiLink"
  | "orLink"
  | "replicateReplicateOptionalLink"
  | "s3MinioOptionalLink"
  | "tggcLink"
  | "aboutLink1"
  | "privacyLink"
  | "bamLink"
  | "chrryLink3"
  | "sushiLink2"
  | "macosDesktopAppLink"

/**
 * Page Object Model for Chrry - Your AI Super App
 * @page /
 * @warning LARGE POM (69 elements) - Consider splitting into multiple page objects
 */
export class ChrryYourAi {
  readonly page: Page

  // ============ Configuration ============

  private readonly CONFIG = {
    PAGE_PATH: "/",
    TIMEOUTS: {
      PAGE_LOAD: 10000,
      ELEMENT_VISIBLE: 2000,
      NAVIGATION: 30000,
    },
  } as const

  constructor(page: Page) {
    this.page = page
  }

  // ============ Private Helpers ============

  /**
   * Check if an element is visible on the page
   * @private
   */
  private async isVisible(
    locator: Locator,
    timeout = this.CONFIG.TIMEOUTS.ELEMENT_VISIBLE,
  ): Promise<boolean> {
    try {
      await locator.waitFor({ state: "visible", timeout })
      return true
    } catch {
      return false
    }
  }

  // ============ Form Elements ============

  /**
   * OpenRouter OpenRouter*Required link
   * @locator getByRole('link', { name: 'OpenRouter OpenRouter*Required' })
   * @example await page.orLink.click();
   */
  get orLink(): Locator {
    return this.page.getByRole("link", {
      name: "OpenRouter OpenRouter*Required",
    })
  }

  /**
   * sk-... text input
   * @locator getByTestId('openrouter-api-key')
   * @example await page.skInput.fill('value');
   */
  get skInput(): Locator {
    return this.page.getByTestId("openrouter-api-key")
  }

  /**
   * OpenRouterSave button
   * @locator getByRole('button', { name: /OpenRouterSave/i })
   * @example await page.openroutersaveButton.click();
   */
  get openroutersaveButton(): Locator {
    return this.page.getByRole("button", { name: /OpenRouterSave/i })
  }

  /**
   * Replicate Replicate*Optional link
   * @locator getByRole('link', { name: 'Replicate Replicate*Optional' })
   * @example await page.replicateReplicateOptionalLink.click();
   */
  get replicateReplicateOptionalLink(): Locator {
    return this.page.getByRole("link", { name: "Replicate Replicate*Optional" })
  }

  /**
   * r8_... text input
   * @locator getByTestId('replicate-api-key')
   * @example await page.r8Input.fill('value');
   */
  get r8Input(): Locator {
    return this.page.getByTestId("replicate-api-key")
  }

  /**
   * FluxSave button
   * @locator getByRole('button', { name: /FluxSave/i })
   * @example await page.fluxsaveButton.click();
   */
  get fluxsaveButton(): Locator {
    return this.page.getByRole("button", { name: /FluxSave/i })
  }

  // ============ Main Elements ============

  /**
   * Account button
   * @locator getByTestId('account-button')
   * @example await page.accountButton.click();
   */
  get accountButton(): Locator {
    return this.page.getByTestId("account-button")
  }

  /**
   * Plus button
   * @locator getByTestId('subscribe-button')
   * @example await page.plusButton.click();
   */
  get plusButton(): Locator {
    return this.page.getByTestId("subscribe-button")
  }

  /**
   * Button
   * @locator locator('button').nth(2)
   * @example await page.plusButton1.click();
   */
  get plusButton1(): Locator {
    return this.page.locator("button").nth(2)
  }

  /**
   * Chrry link
   * @locator getByRole('link', { name: /Chrry/i })
   * @example await page.chrryLink.click();
   */
  get chrryLink(): Locator {
    return this.page.getByRole("link", { name: /Chrry/i })
  }

  /**
   * Button
   * @locator locator('button').nth(3)
   * @example await page.buttonButton.click();
   */
  get buttonButton(): Locator {
    return this.page.locator("button").nth(3)
  }

  /**
   * 7.2°CAmsterdam, Netherlands button
   * @locator getByRole('button', { name: /7\.2°CAmsterdam, Netherlands/i })
   * @example await page.tcnButton.click();
   */
  get tcnButton(): Locator {
    return this.page.getByRole("button", {
      name: /7\.2°CAmsterdam, Netherlands/i,
    })
  }

  /**
   * Link
   * @locator locator('a').nth(1)
   * @example await page.aboutLink.click();
   */
  get aboutLink(): Locator {
    return this.page.locator("a").nth(1)
  }

  /**
   * Button
   * @locator locator('button').nth(5)
   * @example await page.pauseButton.click();
   */
  get pauseButton(): Locator {
    return this.page.locator("button").nth(5)
  }

  /**
   * Link
   * @locator locator('a').nth(2)
   * @example await page.iliyanLink.click();
   */
  get iliyanLink(): Locator {
    return this.page.locator("a").nth(2)
  }

  /**
   * Link
   * @locator locator('a').nth(3)
   * @example await page.chrryLink1.click();
   */
  get chrryLink1(): Locator {
    return this.page.locator("a").nth(3)
  }

  /**
   * Perplexity link
   * @locator getByRole('link', { name: /Perplexity/i })
   * @example await page.perplexityLink.click();
   */
  get perplexityLink(): Locator {
    return this.page.getByRole("link", { name: /Perplexity/i })
  }

  /**
   * Link
   * @locator locator('a').nth(5)
   * @example await page.vexLink.click();
   */
  get vexLink(): Locator {
    return this.page.locator("a").nth(5)
  }

  /**
   * Link
   * @locator locator('a').nth(6)
   * @example await page.sushiLink.click();
   */
  get sushiLink(): Locator {
    return this.page.locator("a").nth(6)
  }

  /**
   * Claude link
   * @locator getByRole('link', { name: /Claude/i })
   * @example await page.claudeLink.click();
   */
  get claudeLink(): Locator {
    return this.page.getByRole("link", { name: /Claude/i })
  }

  /**
   * Link
   * @locator locator('a').nth(8)
   * @example await page.popcornLink.click();
   */
  get popcornLink(): Locator {
    return this.page.locator("a").nth(8)
  }

  /**
   * +23 AI Apps link
   * @locator getByRole('link', { name: '+23 AI Apps' })
   * @example await page.twentythreeAiAppsLink.click();
   */
  get twentythreeAiAppsLink(): Locator {
    return this.page.getByRole("link", { name: "+23 AI Apps" })
  }

  /**
   * Free (BYOK) button
   * @locator getByRole('button', { name: /Free \(BYOK\)/i })
   * @example await page.freeByokButton.click();
   */
  get freeByokButton(): Locator {
    return this.page.getByRole("button", { name: /Free \(BYOK\)/i })
  }

  /**
   * Chrry link
   * @locator getByRole('link', { name: /Chrry/i })
   * @example await page.chrryLink2.click();
   */
  get chrryLink2(): Locator {
    return this.page.getByRole("link", { name: /Chrry/i })
  }

  /**
   * Agency link
   * @locator getByRole('link', { name: 'Agency' })
   * @example await page.agencyLink.click();
   */
  get agencyLink(): Locator {
    return this.page.getByRole("link", { name: "Agency" })
  }

  /**
   * Sovereign link
   * @locator getByRole('link', { name: 'Sovereign' })
   * @example await page.sovereignLink.click();
   */
  get sovereignLink(): Locator {
    return this.page.getByRole("link", { name: "Sovereign" })
  }

  /**
   * Link
   * @locator locator('a').nth(13)
   * @example await page.wannathisLink.click();
   */
  get wannathisLink(): Locator {
    return this.page.locator("a").nth(13)
  }

  /**
   * GitHub link
   * @locator getByRole('link', { name: 'AGPLv3' })
   * @example await page.agplv3Link.click();
   */
  get agplv3Link(): Locator {
    return this.page.getByRole("link", { name: "AGPLv3" })
  }

  /**
   * Vex link
   * @locator locator('a').nth(15)
   * @example await page.vexLink1.click();
   */
  get vexLink1(): Locator {
    return this.page.locator("a").nth(15)
  }

  /**
   * Sushi link
   * @locator locator('a').nth(16)
   * @example await page.sushiLink1.click();
   */
  get sushiLink1(): Locator {
    return this.page.locator("a").nth(16)
  }

  /**
   * Pepper link
   * @locator locator('a').nth(17)
   * @example await page.pepperLink.click();
   */
  get pepperLink(): Locator {
    return this.page.locator("a").nth(17)
  }

  /**
   * Waffles link
   * @locator locator('a').nth(18)
   * @example await page.wafflesLink.click();
   */
  get wafflesLink(): Locator {
    return this.page.locator("a").nth(18)
  }

  /**
   * OrbStack link
   * @locator getByRole('link', { name: 'OrbStack' })
   * @example await page.orbstackLink.click();
   */
  get orbstackLink(): Locator {
    return this.page.getByRole("link", { name: "OrbStack" })
  }

  /**
   * PostgreSQL link
   * @locator getByRole('link', { name: 'PostgreSQL' })
   * @example await page.postgresqlLink.click();
   */
  get postgresqlLink(): Locator {
    return this.page.getByRole("link", { name: "PostgreSQL" })
  }

  /**
   * FalkorDB link
   * @locator getByRole('link', { name: 'FalkorDB' })
   * @example await page.falkordbLink.click();
   */
  get falkordbLink(): Locator {
    return this.page.getByRole("link", { name: "FalkorDB" })
  }

  /**
   * Bun link
   * @locator getByRole('link', { name: 'Bun' })
   * @example await page.bunLink.click();
   */
  get bunLink(): Locator {
    return this.page.getByRole("link", { name: "Bun" })
  }

  /**
   * Hono link
   * @locator getByRole('link', { name: 'Hono' })
   * @example await page.honoLink.click();
   */
  get honoLink(): Locator {
    return this.page.getByRole("link", { name: "Hono" })
  }

  /**
   * React link
   * @locator getByRole('link', { name: 'React' })
   * @example await page.reactLink.click();
   */
  get reactLink(): Locator {
    return this.page.getByRole("link", { name: "React" })
  }

  /**
   * Vite link
   * @locator getByRole('link', { name: 'Vite' })
   * @example await page.viteLink.click();
   */
  get viteLink(): Locator {
    return this.page.getByRole("link", { name: "Vite" })
  }

  /**
   * Biome link
   * @locator getByRole('link', { name: 'Biome' })
   * @example await page.biomeLink.click();
   */
  get biomeLink(): Locator {
    return this.page.getByRole("link", { name: "Biome" })
  }

  /**
   * Tauri link
   * @locator getByRole('link', { name: 'Tauri' })
   * @example await page.tauriLink.click();
   */
  get tauriLink(): Locator {
    return this.page.getByRole("link", { name: "Tauri" })
  }

  /**
   * Hetzner link
   * @locator getByRole('link', { name: 'Hetzner' })
   * @example await page.hetznerLink.click();
   */
  get hetznerLink(): Locator {
    return this.page.getByRole("link", { name: "Hetzner" })
  }

  /**
   * MinIO link
   * @locator getByRole('link', { name: 'MinIO' })
   * @example await page.minioLink.click();
   */
  get minioLink(): Locator {
    return this.page.getByRole("link", { name: "MinIO" })
  }

  /**
   * ChatGPT link
   * @locator getByRole('link', { name: 'OpenAI' })
   * @example await page.openaiLink.click();
   */
  get openaiLink(): Locator {
    return this.page.getByRole("link", { name: "OpenAI" })
  }

  /**
   * DeepSeek link
   * @locator getByRole('link', { name: 'DeepSeek' })
   * @example await page.deepseekLink.click();
   */
  get deepseekLink(): Locator {
    return this.page.getByRole("link", { name: "DeepSeek" })
  }

  /**
   * Claude link
   * @locator getByRole('link', { name: /Claude/i })
   * @example await page.claudeLink1.click();
   */
  get claudeLink1(): Locator {
    return this.page.getByRole("link", { name: /Claude/i })
  }

  /**
   * Perplexity link
   * @locator getByRole('link', { name: /Perplexity/i })
   * @example await page.perplexityLink1.click();
   */
  get perplexityLink1(): Locator {
    return this.page.getByRole("link", { name: /Perplexity/i })
  }

  /**
   * Grok link
   * @locator getByRole('link', { name: 'Grok' })
   * @example await page.grokLink.click();
   */
  get grokLink(): Locator {
    return this.page.getByRole("link", { name: "Grok" })
  }

  /**
   * Gemini link
   * @locator getByRole('link', { name: 'Gemini' })
   * @example await page.geminiLink.click();
   */
  get geminiLink(): Locator {
    return this.page.getByRole("link", { name: "Gemini" })
  }

  /**
   * S3/MinIO*Optional link
   * @locator getByRole('link', { name: 'S3/MinIO*Optional' })
   * @example await page.s3MinioOptionalLink.click();
   */
  get s3MinioOptionalLink(): Locator {
    return this.page.getByRole("link", { name: "S3/MinIO*Optional" })
  }

  /**
   * Setup S3 button
   * @locator getByRole('button', { name: /Setup S3/i })
   * @example await page.setupS3Button.click();
   */
  get setupS3Button(): Locator {
    return this.page.getByRole("button", { name: /Setup S3/i })
  }

  /**
   * Choose 10GB/month of free storage button
   * @locator getByRole('button', { name: /Choose 10GB/month of free storage/i })
   * @example await page.choose10gbMonthFreeButton.click();
   */
  get choose10gbMonthFreeButton(): Locator {
    return this.page.getByRole("button", {
      name: "/Choose 10GB/month of free storage/i",
    })
  }

  /**
   * 🔑 AES-256 GCM (Galois/Counter Mode) link
   * @locator getByRole('link', { name: '🔑 AES-256 GCM (Galois/Counter Mode)' })
   * @example await page.tggcLink.click();
   */
  get tggcLink(): Locator {
    return this.page.getByRole("link", {
      name: "🔑 AES-256 GCM (Galois/Counter Mode)",
    })
  }

  /**
   * Div
   * @locator getByTestId('hippo-wm')
   */
  get hippoWm(): Locator {
    return this.page.getByTestId("hippo-wm")
  }

  /**
   * Button
   * @locator getByTestId('hippo-wm-button')
   * @example await page.hippoWmButtonButton.click();
   */
  get hippoWmButtonButton(): Locator {
    return this.page.getByTestId("hippo-wm-button")
  }

  /**
   * 🍒 /about link
   * @locator getByRole('link', { name: '🍒 /about' })
   * @example await page.aboutLink1.click();
   */
  get aboutLink1(): Locator {
    return this.page.getByRole("link", { name: "🍒 /about" })
  }

  /**
   * 🤫 /privacy link
   * @locator getByRole('link', { name: '🤫 /privacy' })
   * @example await page.privacyLink.click();
   */
  get privacyLink(): Locator {
    return this.page.getByRole("link", { name: "🤫 /privacy" })
  }

  /**
   * BAM 💥 link
   * @locator getByRole('link', { name: 'BAM 💥' })
   * @example await page.bamLink.click();
   */
  get bamLink(): Locator {
    return this.page.getByRole("link", { name: "BAM 💥" })
  }

  /**
   * 🌀 link
   * @locator getByRole('link', { name: '🌀' })
   * @example await page.chrryLink3.click();
   */
  get chrryLink3(): Locator {
    return this.page.getByRole("link", { name: "🌀" })
  }

  /**
   * Link
   * @locator locator('a').nth(44)
   * @example await page.sushiLink2.click();
   */
  get sushiLink2(): Locator {
    return this.page.locator("a").nth(44)
  }

  /**
   * Button
   * @locator locator('button').nth(12)
   * @example await page.buttonButton1.click();
   */
  get buttonButton1(): Locator {
    return this.page.locator("button").nth(12)
  }

  /**
   * macOS Desktop App link
   * @locator getByRole('link', { name: 'macOS Desktop App' })
   * @example await page.macosDesktopAppLink.click();
   */
  get macosDesktopAppLink(): Locator {
    return this.page.getByRole("link", { name: "macOS Desktop App" })
  }

  /**
   * Switch to light mode button
   * @locator getByTestId('undefined-light')
   * @example await page.switchToLightModeButton.click();
   */
  get switchToLightModeButton(): Locator {
    return this.page.getByTestId("undefined-light")
  }

  /**
   * Set color scheme to red button
   * @locator getByTestId('undefined-red')
   * @example await page.setColorSchemeToRedButton.click();
   */
  get setColorSchemeToRedButton(): Locator {
    return this.page.getByTestId("undefined-red")
  }

  /**
   * Set color scheme to orange button
   * @locator getByTestId('undefined-orange')
   * @example await page.setColorSchemeButton.click();
   */
  get setColorSchemeButton(): Locator {
    return this.page.getByTestId("undefined-orange")
  }

  /**
   * Set color scheme to blue button
   * @locator getByTestId('undefined-blue')
   * @example await page.setColorSchemeToBlueButton.click();
   */
  get setColorSchemeToBlueButton(): Locator {
    return this.page.getByTestId("undefined-blue")
  }

  /**
   * Set color scheme to green button
   * @locator getByTestId('undefined-green')
   * @example await page.setColorSchemeToGreenButton.click();
   */
  get setColorSchemeToGreenButton(): Locator {
    return this.page.getByTestId("undefined-green")
  }

  /**
   * Set color scheme to violet button
   * @locator getByTestId('undefined-violet')
   * @example await page.setColorSchemeButton1.click();
   */
  get setColorSchemeButton1(): Locator {
    return this.page.getByTestId("undefined-violet")
  }

  /**
   * Set color scheme to purple button
   * @locator getByTestId('undefined-purple')
   * @example await page.setColorSchemeButton2.click();
   */
  get setColorSchemeButton2(): Locator {
    return this.page.getByTestId("undefined-purple")
  }

  // ============ Actions ============

  async clickButton(buttonName: ButtonName): Promise<void> {
    const buttonMap: Record<ButtonName, Locator> = {
      accountButton: this.accountButton,
      plusButton: this.plusButton,
      plusButton1: this.plusButton1,
      buttonButton: this.buttonButton,
      tcnButton: this.tcnButton,
      pauseButton: this.pauseButton,
      freeByokButton: this.freeByokButton,
      openroutersaveButton: this.openroutersaveButton,
      fluxsaveButton: this.fluxsaveButton,
      setupS3Button: this.setupS3Button,
      choose10gbMonthFreeButton: this.choose10gbMonthFreeButton,
      hippoWmButtonButton: this.hippoWmButtonButton,
      buttonButton1: this.buttonButton1,
      switchToLightModeButton: this.switchToLightModeButton,
      setColorSchemeToRedButton: this.setColorSchemeToRedButton,
      setColorSchemeButton: this.setColorSchemeButton,
      setColorSchemeToBlueButton: this.setColorSchemeToBlueButton,
      setColorSchemeToGreenButton: this.setColorSchemeToGreenButton,
      setColorSchemeButton1: this.setColorSchemeButton1,
      setColorSchemeButton2: this.setColorSchemeButton2,
    }
    const button = buttonMap[buttonName]
    if (!button) throw new Error(`Button '${buttonName}' not found`)
    await button.click()
  }

  async fillInput(inputName: InputName, value: string): Promise<void> {
    const inputMap: Record<InputName, Locator> = {
      skInput: this.skInput,
      r8Input: this.r8Input,
    }
    const input = inputMap[inputName]
    if (!input) throw new Error(`Input '${inputName}' not found`)
    await input.fill(value)
  }

  async clickLink(linkName: LinkName): Promise<void> {
    const linkMap: Record<LinkName, Locator> = {
      chrryLink: this.chrryLink,
      aboutLink: this.aboutLink,
      iliyanLink: this.iliyanLink,
      chrryLink1: this.chrryLink1,
      perplexityLink: this.perplexityLink,
      vexLink: this.vexLink,
      sushiLink: this.sushiLink,
      claudeLink: this.claudeLink,
      popcornLink: this.popcornLink,
      twentythreeAiAppsLink: this.twentythreeAiAppsLink,
      chrryLink2: this.chrryLink2,
      agencyLink: this.agencyLink,
      sovereignLink: this.sovereignLink,
      wannathisLink: this.wannathisLink,
      agplv3Link: this.agplv3Link,
      vexLink1: this.vexLink1,
      sushiLink1: this.sushiLink1,
      pepperLink: this.pepperLink,
      wafflesLink: this.wafflesLink,
      orbstackLink: this.orbstackLink,
      postgresqlLink: this.postgresqlLink,
      falkordbLink: this.falkordbLink,
      bunLink: this.bunLink,
      honoLink: this.honoLink,
      reactLink: this.reactLink,
      viteLink: this.viteLink,
      biomeLink: this.biomeLink,
      tauriLink: this.tauriLink,
      hetznerLink: this.hetznerLink,
      minioLink: this.minioLink,
      openaiLink: this.openaiLink,
      deepseekLink: this.deepseekLink,
      claudeLink1: this.claudeLink1,
      perplexityLink1: this.perplexityLink1,
      grokLink: this.grokLink,
      geminiLink: this.geminiLink,
      orLink: this.orLink,
      replicateReplicateOptionalLink: this.replicateReplicateOptionalLink,
      s3MinioOptionalLink: this.s3MinioOptionalLink,
      tggcLink: this.tggcLink,
      aboutLink1: this.aboutLink1,
      privacyLink: this.privacyLink,
      bamLink: this.bamLink,
      chrryLink3: this.chrryLink3,
      sushiLink2: this.sushiLink2,
      macosDesktopAppLink: this.macosDesktopAppLink,
    }
    const link = linkMap[linkName]
    if (!link) throw new Error(`Link '${linkName}' not found`)
    await link.click()
  }

  // ============ Assertions ============

  /** Verify page has loaded successfully */
  async expectPageLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\//)
    await expect(this.accountButton).toBeVisible({ timeout: 10000 })
  }

  /** Verify all interactive buttons are visible */
  async expectAllButtonsVisible(): Promise<void> {
    await expect(this.accountButton).toBeVisible()
    await expect(this.plusButton).toBeVisible()
    await expect(this.plusButton1).toBeVisible()
    await expect(this.buttonButton).toBeVisible()
    await expect(this.tcnButton).toBeVisible()
    await expect(this.pauseButton).toBeVisible()
    await expect(this.freeByokButton).toBeVisible()
    await expect(this.openroutersaveButton).toBeVisible()
    await expect(this.fluxsaveButton).toBeVisible()
    await expect(this.setupS3Button).toBeVisible()
    await expect(this.choose10gbMonthFreeButton).toBeVisible()
    await expect(this.hippoWmButtonButton).toBeVisible()
    await expect(this.buttonButton1).toBeVisible()
    await expect(this.switchToLightModeButton).toBeVisible()
    await expect(this.setColorSchemeToRedButton).toBeVisible()
    await expect(this.setColorSchemeButton).toBeVisible()
    await expect(this.setColorSchemeToBlueButton).toBeVisible()
    await expect(this.setColorSchemeToGreenButton).toBeVisible()
    await expect(this.setColorSchemeButton1).toBeVisible()
    await expect(this.setColorSchemeButton2).toBeVisible()
  }

  /**
   * Verify specific element is visible
   * @param locator - Element locator to check
   */
  async expectElementVisible(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible()
  }

  // ============ State Checks (Priority 3: Complete coverage) ============

  /**
   * Check if Account is visible
   */
  async isAccountButtonVisible(): Promise<boolean> {
    return this.isVisible(this.accountButton)
  }

  /**
   * Check if Plus is visible
   */
  async isPlusButtonVisible(): Promise<boolean> {
    return this.isVisible(this.plusButton)
  }

  /**
   * Check if plusButton is visible
   */
  async isPlusButton1Visible(): Promise<boolean> {
    return this.isVisible(this.plusButton1)
  }

  /**
   * Check if Chrry is visible
   */
  async isChrryLinkVisible(): Promise<boolean> {
    return this.isVisible(this.chrryLink)
  }

  /**
   * Check if buttonButton is visible
   */
  async isButtonButtonVisible(): Promise<boolean> {
    return this.isVisible(this.buttonButton)
  }

  /**
   * Check if 7.2°CAmsterdam, Netherlands is visible
   */
  async isTcnButtonVisible(): Promise<boolean> {
    return this.isVisible(this.tcnButton)
  }

  /**
   * Check if aboutLink is visible
   */
  async isAboutLinkVisible(): Promise<boolean> {
    return this.isVisible(this.aboutLink)
  }

  /**
   * Check if pauseButton is visible
   */
  async isPauseButtonVisible(): Promise<boolean> {
    return this.isVisible(this.pauseButton)
  }

  /**
   * Check if iliyanLink is visible
   */
  async isIliyanLinkVisible(): Promise<boolean> {
    return this.isVisible(this.iliyanLink)
  }

  /**
   * Check if chrryLink is visible
   */
  async isChrryLink1Visible(): Promise<boolean> {
    return this.isVisible(this.chrryLink1)
  }

  /**
   * Check if Perplexity is visible
   */
  async isPerplexityLinkVisible(): Promise<boolean> {
    return this.isVisible(this.perplexityLink)
  }

  /**
   * Check if vexLink is visible
   */
  async isVexLinkVisible(): Promise<boolean> {
    return this.isVisible(this.vexLink)
  }

  /**
   * Check if sushiLink is visible
   */
  async isSushiLinkVisible(): Promise<boolean> {
    return this.isVisible(this.sushiLink)
  }

  /**
   * Check if Claude is visible
   */
  async isClaudeLinkVisible(): Promise<boolean> {
    return this.isVisible(this.claudeLink)
  }

  /**
   * Check if popcornLink is visible
   */
  async isPopcornLinkVisible(): Promise<boolean> {
    return this.isVisible(this.popcornLink)
  }

  /**
   * Check if +23 AI Apps is visible
   */
  async isTwentythreeAiAppsLinkVisible(): Promise<boolean> {
    return this.isVisible(this.twentythreeAiAppsLink)
  }

  /**
   * Check if Free (BYOK) is visible
   */
  async isFreeByokButtonVisible(): Promise<boolean> {
    return this.isVisible(this.freeByokButton)
  }

  /**
   * Check if Chrry is visible
   */
  async isChrryLink2Visible(): Promise<boolean> {
    return this.isVisible(this.chrryLink2)
  }

  /**
   * Check if Agency is visible
   */
  async isAgencyLinkVisible(): Promise<boolean> {
    return this.isVisible(this.agencyLink)
  }

  /**
   * Check if Sovereign is visible
   */
  async isSovereignLinkVisible(): Promise<boolean> {
    return this.isVisible(this.sovereignLink)
  }

  /**
   * Check if wannathisLink is visible
   */
  async isWannathisLinkVisible(): Promise<boolean> {
    return this.isVisible(this.wannathisLink)
  }

  /**
   * Check if GitHub is visible
   */
  async isAgplv3LinkVisible(): Promise<boolean> {
    return this.isVisible(this.agplv3Link)
  }

  /**
   * Check if Vex is visible
   */
  async isVexLink1Visible(): Promise<boolean> {
    return this.isVisible(this.vexLink1)
  }

  /**
   * Check if Sushi is visible
   */
  async isSushiLink1Visible(): Promise<boolean> {
    return this.isVisible(this.sushiLink1)
  }

  /**
   * Check if Pepper is visible
   */
  async isPepperLinkVisible(): Promise<boolean> {
    return this.isVisible(this.pepperLink)
  }

  /**
   * Check if Waffles is visible
   */
  async isWafflesLinkVisible(): Promise<boolean> {
    return this.isVisible(this.wafflesLink)
  }

  /**
   * Check if OrbStack is visible
   */
  async isOrbstackLinkVisible(): Promise<boolean> {
    return this.isVisible(this.orbstackLink)
  }

  /**
   * Check if PostgreSQL is visible
   */
  async isPostgresqlLinkVisible(): Promise<boolean> {
    return this.isVisible(this.postgresqlLink)
  }

  /**
   * Check if FalkorDB is visible
   */
  async isFalkordbLinkVisible(): Promise<boolean> {
    return this.isVisible(this.falkordbLink)
  }

  /**
   * Check if Bun is visible
   */
  async isBunLinkVisible(): Promise<boolean> {
    return this.isVisible(this.bunLink)
  }

  /**
   * Check if Hono is visible
   */
  async isHonoLinkVisible(): Promise<boolean> {
    return this.isVisible(this.honoLink)
  }

  /**
   * Check if React is visible
   */
  async isReactLinkVisible(): Promise<boolean> {
    return this.isVisible(this.reactLink)
  }

  /**
   * Check if Vite is visible
   */
  async isViteLinkVisible(): Promise<boolean> {
    return this.isVisible(this.viteLink)
  }

  /**
   * Check if Biome is visible
   */
  async isBiomeLinkVisible(): Promise<boolean> {
    return this.isVisible(this.biomeLink)
  }

  /**
   * Check if Tauri is visible
   */
  async isTauriLinkVisible(): Promise<boolean> {
    return this.isVisible(this.tauriLink)
  }

  /**
   * Check if Hetzner is visible
   */
  async isHetznerLinkVisible(): Promise<boolean> {
    return this.isVisible(this.hetznerLink)
  }

  /**
   * Check if MinIO is visible
   */
  async isMinioLinkVisible(): Promise<boolean> {
    return this.isVisible(this.minioLink)
  }

  /**
   * Check if ChatGPT is visible
   */
  async isOpenaiLinkVisible(): Promise<boolean> {
    return this.isVisible(this.openaiLink)
  }

  /**
   * Check if DeepSeek is visible
   */
  async isDeepseekLinkVisible(): Promise<boolean> {
    return this.isVisible(this.deepseekLink)
  }

  /**
   * Check if Claude is visible
   */
  async isClaudeLink1Visible(): Promise<boolean> {
    return this.isVisible(this.claudeLink1)
  }

  /**
   * Check if Perplexity is visible
   */
  async isPerplexityLink1Visible(): Promise<boolean> {
    return this.isVisible(this.perplexityLink1)
  }

  /**
   * Check if Grok is visible
   */
  async isGrokLinkVisible(): Promise<boolean> {
    return this.isVisible(this.grokLink)
  }

  /**
   * Check if Gemini is visible
   */
  async isGeminiLinkVisible(): Promise<boolean> {
    return this.isVisible(this.geminiLink)
  }

  /**
   * Check if OpenRouter OpenRouter*Required is visible
   */
  async isOrLinkVisible(): Promise<boolean> {
    return this.isVisible(this.orLink)
  }

  /**
   * Check if skInput is visible
   */
  async isSkInputVisible(): Promise<boolean> {
    return this.isVisible(this.skInput)
  }

  /**
   * Check if OpenRouterSave is visible
   */
  async isOpenroutersaveButtonVisible(): Promise<boolean> {
    return this.isVisible(this.openroutersaveButton)
  }

  /**
   * Check if Replicate Replicate*Optional is visible
   */
  async isReplicateReplicateOptionalLinkVisible(): Promise<boolean> {
    return this.isVisible(this.replicateReplicateOptionalLink)
  }

  /**
   * Check if r8Input is visible
   */
  async isR8InputVisible(): Promise<boolean> {
    return this.isVisible(this.r8Input)
  }

  /**
   * Check if FluxSave is visible
   */
  async isFluxsaveButtonVisible(): Promise<boolean> {
    return this.isVisible(this.fluxsaveButton)
  }

  /**
   * Check if S3/MinIO*Optional is visible
   */
  async isS3MinioOptionalLinkVisible(): Promise<boolean> {
    return this.isVisible(this.s3MinioOptionalLink)
  }

  /**
   * Check if Setup S3 is visible
   */
  async isSetupS3ButtonVisible(): Promise<boolean> {
    return this.isVisible(this.setupS3Button)
  }

  /**
   * Check if Choose 10GB/month of free storage is visible
   */
  async isChoose10gbMonthFreeButtonVisible(): Promise<boolean> {
    return this.isVisible(this.choose10gbMonthFreeButton)
  }

  /**
   * Check if 🔑 AES-256 GCM (Galois/Counter Mode) is visible
   */
  async isTggcLinkVisible(): Promise<boolean> {
    return this.isVisible(this.tggcLink)
  }

  /**
   * Check if hippoWm is visible
   */
  async isHippoWmVisible(): Promise<boolean> {
    return this.isVisible(this.hippoWm)
  }

  /**
   * Check if hippoWmButtonButton is visible
   */
  async isHippoWmButtonButtonVisible(): Promise<boolean> {
    return this.isVisible(this.hippoWmButtonButton)
  }

  /**
   * Check if 🍒 /about is visible
   */
  async isAboutLink1Visible(): Promise<boolean> {
    return this.isVisible(this.aboutLink1)
  }

  /**
   * Check if 🤫 /privacy is visible
   */
  async isPrivacyLinkVisible(): Promise<boolean> {
    return this.isVisible(this.privacyLink)
  }

  /**
   * Check if BAM 💥 is visible
   */
  async isBamLinkVisible(): Promise<boolean> {
    return this.isVisible(this.bamLink)
  }

  /**
   * Check if 🌀 is visible
   */
  async isChrryLink3Visible(): Promise<boolean> {
    return this.isVisible(this.chrryLink3)
  }

  /**
   * Check if sushiLink is visible
   */
  async isSushiLink2Visible(): Promise<boolean> {
    return this.isVisible(this.sushiLink2)
  }

  /**
   * Check if buttonButton is visible
   */
  async isButtonButton1Visible(): Promise<boolean> {
    return this.isVisible(this.buttonButton1)
  }

  /**
   * Check if macOS Desktop App is visible
   */
  async isMacosDesktopAppLinkVisible(): Promise<boolean> {
    return this.isVisible(this.macosDesktopAppLink)
  }

  /**
   * Check if Switch to light mode is visible
   */
  async isSwitchToLightModeButtonVisible(): Promise<boolean> {
    return this.isVisible(this.switchToLightModeButton)
  }

  /**
   * Check if Set color scheme to red is visible
   */
  async isSetColorSchemeToRedButtonVisible(): Promise<boolean> {
    return this.isVisible(this.setColorSchemeToRedButton)
  }

  /**
   * Check if Set color scheme to orange is visible
   */
  async isSetColorSchemeButtonVisible(): Promise<boolean> {
    return this.isVisible(this.setColorSchemeButton)
  }

  /**
   * Check if Set color scheme to blue is visible
   */
  async isSetColorSchemeToBlueButtonVisible(): Promise<boolean> {
    return this.isVisible(this.setColorSchemeToBlueButton)
  }

  /**
   * Check if Set color scheme to green is visible
   */
  async isSetColorSchemeToGreenButtonVisible(): Promise<boolean> {
    return this.isVisible(this.setColorSchemeToGreenButton)
  }

  /**
   * Check if Set color scheme to violet is visible
   */
  async isSetColorSchemeButton1Visible(): Promise<boolean> {
    return this.isVisible(this.setColorSchemeButton1)
  }

  /**
   * Check if Set color scheme to purple is visible
   */
  async isSetColorSchemeButton2Visible(): Promise<boolean> {
    return this.isVisible(this.setColorSchemeButton2)
  }

  // ============ Navigation ============

  /**
   * Navigate to the page
   * @param baseUrl - Optional base URL override (defaults to env variable)
   * @example
   * // Use environment variable
   * await page.goto();
   * // Or override
   * await page.goto('https://staging.example.com');
   */
  async goto(baseUrl?: string): Promise<void> {
    const url =
      baseUrl || process.env.BASE_URL || "https://watermelon.chrry.ai/"
    await this.page.goto(url)
    await this.page.waitForLoadState("domcontentloaded")
  }
}
