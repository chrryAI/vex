import { useAuth } from "./context/providers"
import Modal from "./Modal"
import { Button, Div, H3, P, Span } from "./platform"
import { useState } from "react"
import { appWithStore } from "./types"
import { COLORS, useAppContext } from "./context/AppContext"
import { useStarStyles } from "./Star.styles"
import { useStyles } from "./context/StylesContext"
import Img from "./Image"

const Grappes = ({ style }: { style?: React.CSSProperties }) => {
  const { grapes, setIsPear, grape, track } = useAuth()
  const [showGrapes, setShowGrapes] = useState(false)
  const [selectedGrapeApp, setSelectedGrapeApp] = useState<
    appWithStore | undefined
  >()

  const { utilities } = useStyles()

  const { t } = useAppContext()

  return (
    <Div>
      {grapes.length > 0 && (
        <Modal
          isModalOpen={showGrapes}
          hasCloseButton={true}
          onToggle={(open) => {
            if (!open) {
              setShowGrapes(false)
              setSelectedGrapeApp(undefined)
              track({
                name: "grape_modal_close",
                props: {
                  apps_shown: grapes.length,
                },
              })
            } else {
              setShowGrapes(true)
              track({
                name: "grape_modal_open",
                props: {
                  apps_available: grapes.length,
                },
              })
            }
          }}
          icon={"🍇"}
          title={<Div>{t("Discover apps, earn credits")}</Div>}
        >
          <Div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {/* App List */}
            <Div
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 15,
                fontSize: 14,
              }}
            >
              {grapes?.map((app) => (
                <Button
                  key={app.id}
                  className={`card link border ${selectedGrapeApp?.id === app.id ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedGrapeApp(app)
                    track({
                      name: "grape_app_select",
                      props: {
                        app: app.name,
                        slug: app.slug,
                        id: app.id,
                      },
                    })
                  }}
                  style={{
                    ...utilities.link.style,
                    ...{
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                      border: "1px dashed var(--shade-2)",
                      borderRadius: 20,
                      padding: 10,
                      flex: 1,
                    },
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    padding: "15px",
                    borderColor:
                      selectedGrapeApp?.id === app.id
                        ? COLORS[app.themeColor as keyof typeof COLORS]
                        : "var(--shade-2)",
                    borderStyle: "solid",
                  }}
                >
                  <Img app={app} showLoading={false} size={50} />
                  <Span
                    style={{
                      fontWeight: "bold",
                      fontSize: "0.8rem",
                      color: "var(--shade-7)",
                    }}
                  >
                    {app.name}
                  </Span>
                </Button>
              ))}
            </Div>

            {/* Selected App Details */}
            {selectedGrapeApp && (
              <Div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                  padding: "20px",
                  borderTop: "1px dashed var(--shade-2)",
                }}
              >
                <Div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <Img app={selectedGrapeApp} showLoading={false} size={40} />
                  <Div>
                    <H3
                      style={{
                        margin: 0,
                        fontSize: "1.2rem",
                      }}
                    >
                      {selectedGrapeApp.icon} {selectedGrapeApp.name}
                    </H3>
                    <Span
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--shade-6)",
                      }}
                    >
                      {selectedGrapeApp.subtitle || selectedGrapeApp.title}
                    </Span>
                  </Div>
                </Div>

                <P
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--shade-7)",
                    margin: 0,
                  }}
                >
                  {selectedGrapeApp.description}
                </P>

                <Div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginTop: "10px",
                  }}
                >
                  <Button
                    className="button inverted"
                    onClick={() => {
                      track({
                        name: "grape_pear_feedback",
                        props: {
                          app: selectedGrapeApp.name,
                          slug: selectedGrapeApp.slug,
                          id: selectedGrapeApp.id,
                        },
                      })
                      setShowGrapes(false)
                      setSelectedGrapeApp(undefined)
                      setIsPear(selectedGrapeApp)
                    }}
                    style={{}}
                  >
                    🍐 Give Feedback with Pear
                  </Button>
                </Div>
              </Div>
            )}
          </Div>
        </Modal>
      )}
      <Button
        // href={getAppSlug(grape)}
        title={t("Discover apps, earn credits")}
        // openInNewTab={isExtension && isFirefox}
        className="button transparent"
        style={{
          ...utilities.button.style,
          ...utilities.transparent.style,
          ...style,
        }}
        onClick={() => {
          setShowGrapes(true)
          track({
            name: "grape_icon_click",
            props: {
              apps_available: grapes.length,
            },
          })
        }}
      >
        <Img showLoading={false} app={grape} width={18} height={18} />
        {grapes.length > 0 && (
          <Span
            style={{
              color: COLORS.purple,
              fontFamily: "var(--font-mono)",
              fontSize: ".7rem",
            }}
          >
            {grapes.length}
          </Span>
        )}
      </Button>
    </Div>
  )
}

export default Grappes
