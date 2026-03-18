import { A, Button, Div, H1, Image as Img, P } from "./platform"

export default function Watermelon() {
  return (
    <Div
      style={{
        width: "100dvw",
        height: "100dvh",
        display: "flex",
        color: "var(--shade-8)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <P
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          position: "absolute",
          top: 15,
          right: 15,
          fontSize: "0.9rem",
        }}
      >
        <A
          className="button inverted medium"
          href="https://chrry.ai"
          target="_blank"
          style={{
            padding: "0.3rem 0.6rem",
            fontFamily: "var(--font-sans)",
          }}
        >
          🍒 Chrry.ai
        </A>{" "}
      </P>
      <Div
        style={{
          display: "flex",

          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 9.5,
          flex: 1,
          position: "relative",
          bottom: 75,
        }}
      >
        <H1
          style={{
            display: "flex",
            alignItems: "center",
            margin: 0,
            fontSize: "1.5rem",
            gap: 15,
            fontFamily: "var(--font-mono)",
          }}
        >
          <Img
            width={50}
            height={50}
            src="https://chrry.ai/images/apps/watermelon.png"
          />
          Watermelon&#169;
        </H1>
        <Div
          style={{
            display: "flex",
            gap: 15,
            marginTop: 10,
          }}
        >
          <A href="http://sushi.chrry.ai" target="_blank">
            <Img
              alt="🍣 Sushi"
              width={22}
              height={22}
              src="https://chrry.ai/images/apps/sushi.png"
            />
          </A>
          <A href="http://sushi.chrry.ai/coder" target="_blank">
            <Img
              alt="🍋 Coder"
              width={22}
              height={22}
              src="https://chrry.ai/images/apps/coder.png"
            />
          </A>
          <A href="http://sushi.chrry.ai/architect" target="_blank">
            <Img
              alt="🥋 Architect"
              width={22}
              height={22}
              src="https://chrry.ai/images/apps/architect.png"
            />
          </A>
          <A href="http://sushi.chrry.ai/jules" target="_blank">
            <Img
              alt="🐙 Jules"
              width={22}
              height={22}
              src="https://chrry.ai/images/apps/jules.png"
            />
          </A>
          <A href="http://sushi.chrry.ai/debugger" target="_blank">
            <Img
              alt="🐛 Debugger"
              width={22}
              height={22}
              src="https://chrry.ai/images/pacman/space-invader.png"
            />
          </A>
          <A
            style={{ fontSize: "0.85rem" }}
            href="http://tribe.chrry.ai"
            target="_blank"
          >
            +100 AI Apps
          </A>
        </Div>
        <P
          style={{
            fontSize: "0.95rem",
            color: "var(--shade-7)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 15,
          }}
        >
          🔪 Choose your weapon 🏹
        </P>
        <Div style={{ display: "flex", gap: 5, marginTop: 15 }}>
          <Button
            className="inverted"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "0.25rem 0.5rem",
            }}
          >
            <Img
              alt="🌋 Free"
              width={22}
              height={22}
              src="https://chrry.ai/images/apps/coder.png"
            />
            Free (BYOK)
          </Button>
          <Button
            className="inverted"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "0.25rem 0.5rem",
            }}
          >
            <Img
              alt="🍒 Chrry"
              width={16}
              height={16}
              src="https://chrry.ai/images/apps/chrry.png"
            />
            Chrry
          </Button>
          <A
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "0.25rem 0.5rem",
            }}
            className="button inverted"
            href="https://chrry.ai/?subscribe=true&plan=watermelon"
            target="_blank"
          >
            <Img
              alt="🍉 Agency"
              width={16}
              height={16}
              src="https://chrry.ai/images/apps/watermelon.png"
            />
            Agency
          </A>
          <A
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "0.25rem 0.5rem",
            }}
            className="button inverted"
            href="https://chrry.ai/?subscribe=true&plan=watermelon"
            target="_blank"
          >
            <Img
              alt="🦋 Sovereign"
              width={16}
              height={16}
              src="https://chrry.ai/images/apps/tribe.png"
            />
            Sovereign
          </A>
        </Div>
      </Div>
    </Div>
  )
}
