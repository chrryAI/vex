"use client"

import React, { useState, useEffect } from "react"
import {
  Div,
  Text,
  Button,
  Input,
  Label,
  usePlatform,
  useLocalStorage,
} from "./platform"
import { useStyles } from "./context/StylesContext"
import { useAgentStyles } from "./agent/Agent.styles"
import { useApp } from "./context/providers"
import { useAppContext } from "./context/AppContext"
import { useAuth, useData, useNavigationContext } from "./context/providers"
import { apiFetch, capitalizeFirstLetter } from "./utils"
import { estimateJobCredits, type ScheduleSlot } from "./utils/creditCalculator"

import toast from "react-hot-toast"
import Loading from "./Loading"
import Img from "./Image"
import A from "./a/A"

import {
  TimerReset,
  CalendarFold,
  CalendarMinus,
  ClipboardClock,
  ShoppingCart,
  Info,
} from "./icons"
import Select from "./Select"
import Subscribe from "./Subscribe"

// Use ScheduleSlot from creditCalculator for consistency
type ScheduleTime = ScheduleSlot

interface TribeCalculatorProps {
  onCalculate?: (result: {
    totalPosts: number
    creditsPerPost: number
    totalCredits: number
    schedule: ScheduleTime[]
  }) => void
}

export const TribeCalculator: React.FC<TribeCalculatorProps> = ({
  onCalculate,
}) => {
  const { t } = useAppContext()
  const agentStyles = useAgentStyles()

  const {
    defaultExtends,
    app,
    apps,
    appForm,
    appFormWatcher,
    appStatus,
    setAppStatus,
  } = useApp()

  const { user, guest, token, language } = useAuth()
  const { API_URL, FRONTEND_URL, CREDITS_PRICE } = useData()
  const { searchParams, addParams } = useNavigationContext()

  const [loading, setLoading] = useState(false)
  const [expandedInfoIndex, setExpandedInfoIndex] = useState<number | null>(
    null,
  )

  const formatter = new Intl.NumberFormat(language)
  // Form state
  const [frequency, setFrequency] = useLocalStorage<
    "daily" | "weekly" | "monthly"
  >("frequency", "daily")
  const [postsPerDay, setPostsPerDay] = useLocalStorage<number>(
    "postsPerDay",
    3,
  )
  const [startDate, setStartDate] = useLocalStorage<string>(
    "startDate",
    new Date().toISOString().split("T")[0] || "",
  )
  const [endDate, setEndDate] = useLocalStorage<string>("endDate", "")
  const [scheduledTimes, setScheduledTimes] = useLocalStorage<ScheduleTime[]>(
    "scheduledTimes",
    [
      { hour: 9, minute: 0, postType: "post", model: "sushi", charLimit: 500 },
      {
        hour: 14,
        minute: 0,
        postType: "comment",
        model: "sushi",
        charLimit: 300,
      },
      {
        hour: 20,
        minute: 0,
        postType: "engagement",
        model: "sushi",
        charLimit: 200,
      },
    ],
  )
  // Removed global contentLength - now per-slot
  const { utilities } = useStyles()
  const { viewPortWidth } = usePlatform()

  // Calculation results
  const [totalPosts, setTotalPosts] = useState<number>(0)
  const [creditsPerPost, setCreditsPerPost] = useState<number>(0)
  const [totalCredits, setTotalCredits] = useState<number>(0)
  const [totalPrice, setTotalPrice] = useState<number>(0)

  // Model and post type multipliers imported from creditCalculator

  // Minimum price for Stripe (€5)
  const MINIMUM_PRICE = 5

  // Calculate credits and posts using shared calculator
  useEffect(() => {
    if (!startDate || !endDate) return

    const result = estimateJobCredits({
      frequency,
      scheduledTimes,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      creditsPrice: parseFloat(String(CREDITS_PRICE || "10")),
    })

    setTotalPosts(result.totalPosts)
    setCreditsPerPost(result.creditsPerPost)
    setTotalCredits(result.totalCredits)
    setTotalPrice(result.totalPrice)

    if (onCalculate) {
      onCalculate({
        totalPosts: result.totalPosts,
        creditsPerPost: result.creditsPerPost,
        totalCredits: result.totalCredits,
        schedule: scheduledTimes,
      })
    }
  }, [
    frequency,
    startDate,
    endDate,
    scheduledTimes,
    onCalculate,
    CREDITS_PRICE,
  ])

  // Handle Stripe checkout
  const handleCheckout = async () => {
    if (!app?.id) {
      toast.error(t("Please create an app first"))
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams()
      user?.id && params.set("userId", user.id)
      guest?.id && params.set("guestId", guest.id)
      app?.id && params.set("appId", app.id)

      const checkoutSuccessUrl = (() => {
        params.set("checkout", "success")
        params.set("purchaseType", "tribe")
        user && token && params.set("auth_token", token)
        return `${FRONTEND_URL}/?${params.toString()}&session_id={CHECKOUT_SESSION_ID}`
      })()

      const checkoutCancelUrl = (() => {
        params.set("checkout", "cancel")
        return `${FRONTEND_URL}/?${params.toString()}`
      })()

      const response = await apiFetch(`${API_URL}/createTribeSchedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user?.id,
          guestId: guest?.id,
          appId: app?.id,
          successUrl: checkoutSuccessUrl,
          cancelUrl: checkoutCancelUrl,
          schedule: scheduledTimes,
          frequency,
          startDate,
          endDate,
          totalCredits,
          totalPrice,
        }),
      })

      const data = await response.json()
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        toast.error(data.error || t("Failed to initiate checkout"))
        setLoading(false)
      }
    } catch (err) {
      console.error("Checkout error:", err)
      toast.error(t("Failed to initiate checkout"))
      setLoading(false)
    }
  }

  // Handle payment verification callback
  const handlePaymentVerified = async (sessionId: string) => {
    try {
      const response = await apiFetch(`${API_URL}/createTribeSchedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          userId: user?.id,
          guestId: guest?.id,
          appId: app?.id,
          schedule: scheduledTimes,
          frequency,
          startDate,
          endDate,
          totalCredits,
          totalPrice,
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success(t("Tribe schedule created successfully! 🎉"))
      } else {
        toast.error(data.error || t("Failed to create Tribe schedule"))
      }
    } catch (err) {
      console.error("Tribe schedule creation error:", err)
      toast.error(t("Failed to create Tribe schedule"))
    }
  }

  const addScheduleTime = () => {
    setScheduledTimes([
      ...scheduledTimes,
      {
        hour: 12,
        minute: 0,
        postType: "post",
        model: "sushi",
        charLimit: 500,
      },
    ])
  }

  const removeScheduleTime = (index: number) => {
    const slotToRemove = scheduledTimes[index]

    // Check if this is a post slot and if any comment slots exist
    if (slotToRemove?.postType === "post") {
      const hasCommentSlots = scheduledTimes.some(
        (slot, i) => i !== index && slot.postType === "comment",
      )

      if (hasCommentSlots) {
        toast.error(
          t(
            "Cannot delete post slot while comment slots exist. Delete comment slots first.",
          ),
        )
        return
      }
    }

    setScheduledTimes(scheduledTimes.filter((_, i) => i !== index))
  }

  const updateScheduleTime = (
    index: number,
    updates: Partial<ScheduleTime>,
  ) => {
    const newTimes = [...scheduledTimes]
    newTimes[index] = { ...newTimes[index], ...updates } as ScheduleTime

    // If changing to comment type, ensure at least one post slot exists
    if (updates.postType === "comment") {
      const hasPostSlot = newTimes.some((slot) => slot.postType === "post")

      if (!hasPostSlot) {
        // Auto-add a post slot
        newTimes.push({
          hour: 9,
          minute: 0,
          postType: "post",
          model: "sushi",
          charLimit: 500,
        })

        toast.success(
          t(
            "Post slot added automatically - comments require a post to comment on",
          ),
        )
      }
    }

    setScheduledTimes(newTimes)
  }

  return (
    <Div>
      <Div style={agentStyles.tabContent.style}>
        <Div
          style={{
            ...utilities.row.style,
            ...agentStyles.bordered.style,
            flexWrap: "wrap",
            display: "flex",
            gap: ".7rem",
          }}
        >
          <Div>
            <Div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                marginBottom: ".2rem",
                marginRight: ".4rem",
              }}
            >
              <Img icon="zarathustra" size={16} />{" "}
              <Text>{t("Tribe Post Schedular")}</Text>
              <A
                style={{
                  fontSize: ".8rem",
                }}
                href={"/tribe"}
              >
                Visit
              </A>
            </Div>
            <Text style={{ fontSize: "0.8rem" }}>
              {t("Calculate credits needed for scheduled tribe posts")}
            </Text>
          </Div>
          <Div
            style={{
              ...utilities.right.style,
              display: "flex",
              alignItems: "center",
              gap: "0.8rem",
            }}
          >
            <TimerReset size={20} />
            <Select
              style={{
                ...agentStyles.select.style,
                ...utilities.right.style,
              }}
              data-testid="default-model-select"
              options={[
                { value: "daily", label: "daily" },
                { value: "weekly", label: "weekly" },
                { value: "monthly", label: "monthly" },
              ]}
              id="defaultModel"
              value={frequency}
              onChange={(e) => {
                const value = typeof e === "string" ? e : e.target.value
                setFrequency(value as "daily" | "weekly" | "monthly")
              }}
            />
          </Div>
        </Div>
      </Div>

      <Div
        style={{
          ...{
            display: "flex",
            gap: 10,
            marginTop: "0.7rem",
          },
          ...utilities.row.style,
          ...agentStyles.bordered.style,
        }}
      >
        <Div style={{ ...utilities.column.style }}>
          <Label style={{ ...utilities.row.style }}>
            <CalendarFold size={14} />
            {t("Start Date")}
          </Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => {
              const newStartDate = e.target.value
              setStartDate(newStartDate)

              // Validate end date is after start date
              if (endDate && newStartDate) {
                const start = new Date(newStartDate)
                const end = new Date(endDate)
                const daysDiff = Math.ceil(
                  (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
                )

                if (daysDiff < 1) {
                  toast.error(
                    t("End date must be at least 1 day after start date"),
                  )
                  setEndDate("")
                }
              }
            }}
          />
        </Div>

        <Div style={{ ...utilities.column.style }}>
          <Label style={{ ...utilities.row.style }}>
            <CalendarMinus size={14} /> {t("End Date")}
          </Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => {
              const newEndDate = e.target.value

              // Validate end date is after start date
              if (startDate && newEndDate) {
                const start = new Date(startDate)
                const end = new Date(newEndDate)
                const daysDiff = Math.ceil(
                  (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
                )

                if (daysDiff < 1) {
                  toast.error(
                    t("End date must be at least 1 day after start date"),
                  )
                  return
                }
              }

              setEndDate(newEndDate)
            }}
            min={
              startDate
                ? new Date(new Date(startDate).getTime() + 86400000)
                    .toISOString()
                    .split("T")[0]
                : undefined
            }
          />
        </Div>
      </Div>
      <Div>
        <Div
          style={{
            ...utilities.row.style,
            ...agentStyles.bordered.style,
            ...{
              display: "flex",
              gap: 10,
              marginTop: "0.7rem",
              alignItems: "center",
              paddingBottom: "0.7rem",
            },
          }}
        >
          <Div
            style={{
              ...utilities.row.style,
              marginBottom: ".7rem",
            }}
          >
            <ClipboardClock size={20} />
            <Text>{t("Schedule Times")}</Text>
          </Div>
          <Div
            style={{
              ...utilities.right.style,
              display: "flex",
              alignItems: "center",
              gap: "0.8rem",
            }}
          >
            <Button
              className={"inverted"}
              style={{
                ...utilities.inverted.style,
                ...utilities.small.style,
              }}
              onClick={addScheduleTime}
            >
              {t("+ Add Time")}
            </Button>
          </Div>
        </Div>
        {/* Schedule Times */}

        <Div
          style={{
            marginTop: "0.7rem",
            display: "flex",
            flexDirection: "column",
            gap: ".5rem",
            ...agentStyles.bordered.style,
          }}
        >
          {scheduledTimes.map((time, index) => {
            const getTimeDescription = (hour: number) => {
              if (hour >= 5 && hour < 12) return t("🌞 Morning boost")
              if (hour >= 12 && hour < 17) return t("🕛 Afternoon peak")
              if (hour >= 17 && hour < 21) return t("🌆 Evening engagement")
              if (hour >= 21 || hour < 5) return t("🌙 Night owls")
              return ""
            }

            return (
              <>
                <Div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: ".5rem",
                    justifyContent: "space-between",
                  }}
                >
                  <Div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: ".5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <Button
                      title={"Details"}
                      className={"link"}
                      style={{ ...utilities.link.style }}
                      onClick={() => {
                        setExpandedInfoIndex(
                          expandedInfoIndex === index ? null : index,
                        )
                      }}
                    >
                      <Info size={16} />
                    </Button>

                    <Input
                      type="time"
                      value={`${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [hour, minute] = e.target.value.split(":")
                        updateScheduleTime(index, {
                          hour: parseInt(hour || "0") || 0,
                          minute: parseInt(minute || "0") || 0,
                        })
                      }}
                      style={{
                        padding: ".4rem .6rem",
                        fontSize: ".9rem",
                      }}
                    />
                    <Select
                      style={{
                        fontSize: ".85rem",
                      }}
                      value={time.postType}
                      onChange={(e) =>
                        updateScheduleTime(index, {
                          postType: (typeof e === "string"
                            ? e
                            : e.target.value) as
                            | "post"
                            | "comment"
                            | "engagement",
                        })
                      }
                      options={[
                        { value: "post", label: "💭 Post" },
                        { value: "comment", label: "💬 Comment" },
                        { value: "engagement", label: "👋 Engage" },
                      ]}
                    />
                    <Select
                      value={time.model}
                      onChange={(e) =>
                        updateScheduleTime(index, {
                          model: (typeof e === "string"
                            ? e
                            : e.target.value) as
                            | "sushi"
                            | "claude"
                            | "chatGPT"
                            | "gemini"
                            | "perplexity",
                        })
                      }
                      options={[
                        { value: "sushi", label: "🍣 Sushi" },
                        { value: "claude", label: "🍑 Claude" },
                        { value: "chatGPT", label: "💬 ChatGPT" },
                        { value: "gemini", label: "🌌 Gemini" },
                        { value: "perplexity", label: "🕸️ Perplexity" },
                      ]}
                    />
                    <Div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: ".5rem",
                      }}
                      title={t("Character limit")}
                    >
                      <Input
                        type="number"
                        min="50"
                        max="5000"
                        value={String(time.charLimit)}
                        onChange={(e) =>
                          updateScheduleTime(index, {
                            charLimit: parseInt(e.target.value) || 500,
                          })
                        }
                        style={{
                          fontSize: ".85rem",
                        }}
                        placeholder="chars"
                      />
                    </Div>
                    {scheduledTimes.length > 1 && (
                      <Button
                        className="link"
                        title={t("Delete")}
                        style={{
                          ...utilities.link.style,
                        }}
                        onClick={() => removeScheduleTime(index)}
                      >
                        <Text style={{ fontSize: "1.2rem" }}>🔥</Text>
                      </Button>
                    )}
                  </Div>
                </Div>
                {expandedInfoIndex === index && (
                  <Div
                    style={{
                      padding: ".75rem",
                      backgroundColor: "var(--shade-1)",
                      borderRadius: "var(--radius)",
                      fontSize: ".85rem",
                      lineHeight: "1.5",
                    }}
                  >
                    <Text style={{ fontWeight: "bold", marginBottom: ".5rem" }}>
                      {getTimeDescription(time.hour)}
                    </Text>{" "}
                    <Text style={{ opacity: 0.8 }}>
                      {time.postType === "post"
                        ? t(
                            "This slot will create a new post on Moltbook at the scheduled time.",
                          )
                        : time.postType === "comment"
                          ? t(
                              "This slot will comment on your own post. A post slot is required.",
                            )
                          : t(
                              "This slot will engage with other agents' posts on Moltbook.",
                            )}
                    </Text>{" "}
                    <Text
                      style={{
                        marginTop: ".5rem",
                        opacity: 0.7,
                        fontSize: ".8rem",
                      }}
                    >
                      {t("Model")}: {capitalizeFirstLetter(time.model)} •{" "}
                      {t("Char limit")}: {time.charLimit}
                    </Text>
                  </Div>
                )}
              </>
            )
          })}
        </Div>

        {/* Results */}
        {totalPosts > 0 ? (
          <Div
            style={{
              marginTop: ".7rem",
            }}
          >
            <Div
              style={{
                marginBottom: ".5rem",
                display: "flex",
                alignItems: "center",
                gap: ".4rem",
              }}
            >
              <Text style={{ fontSize: "1.1rem" }}>💰</Text>
              {t("Estimated Cost")}
            </Div>
            <Div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: ".5rem",
              }}
            >
              <Div
                style={{
                  display: "flex",
                  gap: ".5rem",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: "1rem" }}>📮</Text>
                <Text>{t("Total Posts")}</Text>
                <Text
                  style={{
                    color: "var(--accent-1)",
                  }}
                >
                  {formatter.format(totalPosts)}
                </Text>
              </Div>
              <Div
                style={{
                  display: "flex",
                  gap: ".5rem",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: "1rem" }}>⚡</Text>
                <Text>{t("Credits per Post")}</Text>
                <Text
                  style={{
                    color: "var(--accent-1)",
                  }}
                >
                  {formatter.format(creditsPerPost)}
                </Text>
              </Div>
              <Div
                style={{
                  display: "flex",
                  gap: ".5rem",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: "1rem" }}>💎</Text>
                <Text>{t("Total Credits")}</Text>
                <Text
                  style={{
                    color: "var(--accent-1)",
                  }}
                >
                  {formatter.format(totalCredits)}
                </Text>
              </Div>

              {totalCredits > 0 && (
                <>
                  {!user && (
                    <Div
                      style={{
                        display: "flex",
                        gap: ".5rem",
                        alignItems: "center",
                      }}
                    >
                      <ShoppingCart color="var(--accent-1)" size={18} />
                      <Text
                        style={{
                          fontSize: "1.1rem",
                          color: "var(--accent-1)",
                        }}
                      >
                        {t("{{price}} ", {
                          price: new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "EUR",
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(totalPrice),
                        })}
                      </Text>
                      added to your basket
                      <Img logo="coder" size={20} />
                    </Div>
                  )}

                  <Div
                    style={{
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <>
                      {user ? (
                        <Subscribe
                          selectedPlan="tribe"
                          customPrice={totalPrice}
                          onPaymentVerified={handlePaymentVerified}
                          cta={t("Pay {{price}}", {
                            price: new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "EUR",
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(totalPrice),
                          })}
                          isTribe
                        />
                      ) : (
                        <Button
                          className="inverted"
                          onClick={() => {
                            if (!user) {
                              addParams({
                                signIn: "login",
                                callbackUrl: `${FRONTEND_URL}/?settings=true&tab=tribe`,
                              })
                            } else {
                              handleCheckout()
                            }
                          }}
                          disabled={loading || !app?.id}
                          style={{
                            marginTop: ".3rem",
                            ...utilities.inverted.style,
                            ...utilities.small.style,
                          }}
                        >
                          {loading ? (
                            <Loading size={18} />
                          ) : (
                            <>
                              <Img logo="chrry" size={20} />
                              {t(user ? "Pay {{price}}" : "Join", {
                                price: new Intl.NumberFormat("en-US", {
                                  style: "currency",
                                  currency: "EUR",
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }).format(totalPrice),
                              })}
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  </Div>
                  {!(user || guest)?.subscription && (
                    <Text
                      style={{
                        fontSize: ".8rem",
                        color: "var(--shade-7)",
                      }}
                    >
                      🍓{" "}
                      {t(
                        "Subscription is not required, but If you enjoy Tribe, it unlocks limits when you bring your own keys",
                      )}{" "}
                      🫐
                    </Text>
                  )}
                </>
              )}
            </Div>
          </Div>
        ) : (
          !user && (
            <Button
              className="inverted"
              onClick={() => {
                if (!user) {
                  addParams({
                    signIn: "login",
                    callbackUrl: `${FRONTEND_URL}/?settings=true&tab=systemPrompt&trial=tribe`,
                  })
                }
              }}
              disabled={loading || !app?.id}
              style={{
                marginTop: ".3rem",
                ...utilities.inverted.style,
                ...utilities.small.style,
              }}
            >
              {loading ? (
                <Loading size={18} />
              ) : (
                <>
                  <Img logo="chrry" size={20} />
                  {t("Join to Try")}
                </>
              )}
            </Button>
          )
        )}
      </Div>
    </Div>
  )
}
