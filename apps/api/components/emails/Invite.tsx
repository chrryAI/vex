import * as React from "react"
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Img,
  Heading,
  Text,
  Link,
} from "@react-email/components"
import { SiteConfig, getSiteConfig } from "@chrryai/chrry/utils/siteConfig"

export default function InviteEmail({
  origin,
  inviterName = "a friend",
  siteConfig = getSiteConfig(),
}: {
  origin?: string
  inviterName?: string
  siteConfig?: SiteConfig
}) {
  const resolvedOrigin = origin || `https://${siteConfig.domain}`
  const iconName = siteConfig.name.toLowerCase() === "vex" ? "icon" : "chrry"

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Img
            src={`${resolvedOrigin}/icons/${iconName}-128.png`}
            width="64"
            height="64"
            alt={siteConfig.name}
          />
          <Heading style={heading}>
            You&apos;ve been invited to {siteConfig.name}!
          </Heading>
          <Section style={body}>
            <Text style={paragraph}>
              {inviterName} has invited you to join {siteConfig.name} - the
              platform for AI-powered collaboration.
            </Text>
            <Link href={`${resolvedOrigin}/?signIn=register`}>
              Accept Invitation →
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles remain the same
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
