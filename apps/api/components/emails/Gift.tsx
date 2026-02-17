import { capitalizeFirstLetter } from "@chrryai/chrry/utils"
import { getSiteConfig, type SiteConfig } from "@chrryai/chrry/utils/siteConfig"
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"

export default function GiftEmail({
  origin,
  inviterName = "A friend",
  giftFingerprint,
  isExistingUser = false,
  plan = "plus",
  siteConfig = getSiteConfig(),
}: {
  origin?: string
  inviterName?: string | null
  giftFingerprint: string
  isExistingUser?: boolean
  plan?: "credits" | "plus" | "pro"
  siteConfig?: SiteConfig
}) {
  const resolvedOrigin = origin || `https://${siteConfig.domain}`

  return (
    <Html>
      <Head />
      {plan === "credits" ? (
        <>
          <Preview>
            🎁 You&apos;ve received a {siteConfig.name} Credits gift!
          </Preview>
          <Body style={main}>
            <Container style={container}>
              <Img
                src={`${resolvedOrigin}/icons/${siteConfig.name === "vex" ? "icon" : "chrry"}-128.png`}
                width="64"
                height="64"
                alt={siteConfig.name}
              />
              <Heading style={heading}>
                🎁 You&apos;ve received {siteConfig.name} Credits!
              </Heading>
              <Section style={body}>
                <Text style={paragraph}>
                  {inviterName} has gifted you a {siteConfig.name} Credits
                  subscription!
                  {isExistingUser
                    ? " Log in to your account to access your new premium features."
                    : " Start using premium AI features immediately - no registration required."}
                </Text>
                <Text style={paragraph}>
                  <a
                    href={`${resolvedOrigin}/gift/${giftFingerprint}`}
                    style={link}
                  >
                    {isExistingUser ? "Access Your Gift" : "Claim Your Gift"} →
                  </a>
                </Text>
                <Text style={footer}>
                  You can manage the gift at {siteConfig.name} anytime!
                </Text>
              </Section>
            </Container>
          </Body>
        </>
      ) : (
        <>
          <Preview>
            🎁 You&apos;ve received a {siteConfig.name}{" "}
            {capitalizeFirstLetter(plan)} gift subscription!
          </Preview>
          <Body style={main}>
            <Container style={container}>
              <Img
                src={`${resolvedOrigin}/icons/icon-128.png`}
                width="64"
                height="64"
                alt={siteConfig.name}
              />
              <Heading style={heading}>
                🎁 You&apos;ve received {siteConfig.name}{" "}
                {capitalizeFirstLetter(plan)}!
              </Heading>
              <Section style={body}>
                <Text style={paragraph}>
                  {inviterName} has gifted you a {siteConfig.name}{" "}
                  {capitalizeFirstLetter(plan)} subscription!
                  {isExistingUser
                    ? " Log in to your account to access your new premium features."
                    : " Start using premium AI features immediately - no registration required."}
                </Text>
                <Text style={paragraph}>
                  <a
                    href={`${resolvedOrigin}/?gift=${giftFingerprint}`}
                    style={link}
                  >
                    {isExistingUser ? "Access Your Gift" : "Claim Your Gift"} →
                  </a>
                </Text>
                <Text style={footer}>
                  This is a legitimate gift from {inviterName}. If you
                  didn&apos;t expect this, you can safely ignore this email.
                </Text>
              </Section>
            </Container>
          </Body>
        </>
      )}
    </Html>
  )
}

// Updated styles to match collaboration email
const main = {
  backgroundColor: "#ffffff",
  fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
}

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #eee",
  borderRadius: "5px",
  margin: "0 auto",
  padding: "20px",
  width: "640px",
}

const heading = {
  color: "#333",
  fontSize: "24px",
  margin: "16px 0",
  textAlign: "center" as const,
}

const body = {
  padding: "16px",
}

const paragraph = {
  color: "#444",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "16px 0",
}

const link = {
  color: "#2754C5",
  fontSize: "16px",
  textDecoration: "underline",
}

const footer = {
  color: "#666",
  fontSize: "14px",
  lineHeight: "24px",
  margin: "24px 0 0",
  textAlign: "center" as const,
}
