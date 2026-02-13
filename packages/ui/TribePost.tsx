"use client"

import React, { useState } from "react"
import {
  Div,
  P,
  Span,
  H2,
  H3,
  Strong,
  Button,
  useNavigation,
  usePlatform,
  useTheme,
  MotiView,
} from "./platform"
import Img from "./Image"
import A from "./a/A"
import { MessageCircleReply, Heart, Share2, Sparkles } from "./icons"
import { useTribePostStyles } from "./TribePost.styles"
import { useStyles } from "./context/StylesContext"
import type { tribePostWithDetails } from "./types"
import { COLORS, useAppContext } from "./context/AppContext"
import { useAuth, useApp, useChat, useData } from "./context/providers"
import toast from "react-hot-toast"
import Loading from "./Loading"
import { useTribe } from "./context/providers/TribeProvider"
import Instructions from "./Instructions"
import AppLink from "./AppLink"

interface TribePostProps {
  post: tribePostWithDetails
  isDetailView?: boolean
  onCommentClick?: () => void
}

type comment = NonNullable<tribePostWithDetails["comments"]>[number]

export default function TribePost({
  post,
  isDetailView = false,
  onCommentClick,
}: TribePostProps) {
  const { t, captureException } = useAppContext()
  const { toggleLike, isTogglingLike, postId, tribePostError, isLoadingPost } =
    useTribe()

  const { timeAgo, getAppSlug, accountApp, user, setSignInPart } = useAuth()
  const { setAppStatus } = useApp()
  const { FRONTEND_URL } = useData()
  const styles = useTribePostStyles()
  const { utilities } = useStyles()

  const { addParams, push: navigate } = useNavigation()
  const { setIsNewAppChat } = useChat()

  const [tyingToReact, setTyingToReact] = useState(false)
  const [tyingToReply, setTyingToReply] = useState<string | undefined>(
    undefined,
  )

  const [tryAppCharacterProfile, setTryAppCharacterProfile] = useState<
    string | undefined
  >(undefined)

  const [tyingToComment, setTyingToComment] = useState<string | undefined>(
    undefined,
  )
  const [copied, setCopied] = useState(false)

  const [showComments, setShowComments] = useState(isDetailView)
  // Group comments by parent
  const topLevelComments =
    post.comments?.filter((c: comment) => !c.parentCommentId) || []
  const replies = post.comments?.filter((c: comment) => c.parentCommentId) || []

  const getReplies = (commentId: string) => {
    return replies.filter((r: comment) => r.parentCommentId === commentId)
  }

  const tribeSlug = post?.tribe?.slug
  const currentTribe = post?.tribe

  const { isExtension, isFirefox } = usePlatform()

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(`${FRONTEND_URL}/p/${post.id}`)
      setCopied(true)
      toast.success(t("Copied"))
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      captureException(err)
      toast.error("Failed to copy code")
    }
  }

  const { isSmallDevice, reduceMotion } = useTheme()

  // Group reactions by emoji
  const reactionGroups = post.reactions?.reduce(
    (acc: Record<string, number>, reaction: { emoji: string }) => {
      acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1
      return acc
    },
    {},
  )

  // Handle loading and error states when fetching a specific post
  if (postId && isLoadingPost) {
    return <Loading fullScreen />
  }

  // Show error when post fetch failed
  if (postId && tribePostError && !isLoadingPost) {
    return (
      <Div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "40px 20px",
          minHeight: "60vh",
          textAlign: "center",
        }}
      >
        <H2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Img logo="coder" size={32} />
          {t("Post not found")}
        </H2>
        <A
          href="/?tribe=true"
          className="button inverted"
          style={{
            ...utilities.button.style,
            ...utilities.inverted.style,
            ...utilities.small.style,
            marginTop: 10,
          }}
        >
          <Img icon="zarathustra" size={18} />
          {t("Back to feed")}
        </A>
      </Div>
    )
  }

  if (!post) {
    return <Loading fullScreen />
  }

  return (
    <Div>
      <H2
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          marginTop: ".25rem",
        }}
      >
        <Img logo="coder" size={32} />
        {tribeSlug && currentTribe ? (
          <Div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <A href={`/?tribe=true`}>{t("Tribe's Feed")}</A>
            <A
              href={`/tribe/${currentTribe.slug}`}
              style={{
                margin: 0,
                fontSize: ".9rem",
                fontWeight: "normal",
                color: "var(--accent-5)",
              }}
            >
              /{currentTribe.slug}
            </A>
          </Div>
        ) : (
          <>{t("Tribe's Feed")}</>
        )}
        <P
          style={{
            fontSize: ".75rem",
            color: "var(--shade-7)",
            fontWeight: "normal",
          }}
        >
          {t(
            tribeSlug && currentTribe
              ? `*${t(currentTribe?.description || "")}`
              : "Organize your life",
          )}
        </P>
        <Div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginLeft: isSmallDevice ? undefined : "auto",
          }}
        >
          <A
            href={`${FRONTEND_URL}/calendar`}
            title={t("Organize your life")}
            openInNewTab={isExtension && isFirefox}
            className="button transparent"
            style={{
              ...utilities.button.style,
              ...utilities.transparent.style,
            }}
          >
            <Img showLoading={false} icon="calendar" width={18} height={18} />
          </A>
          <Instructions
            showButton={false}
            showDownloads={true}
            showInstructions={false}
            showAbout={false}
            style={{
              marginTop: 0,
            }}
          />
        </Div>
      </H2>
      <Div
        style={{
          backgroundColor: "var(--shade-0)",
          borderRadius: 16,
          border: "1px solid var(--shade-2)",
          overflow: "hidden",
          marginBottom: "1rem",
        }}
      >
        {/* Post Header */}
        <Div
          style={{
            padding: "1rem",
            borderBottom: "1px solid var(--shade-2)",
            backgroundColor: "var(--shade-1)",
          }}
        >
          <Div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {post.app && <Img app={post.app} size={40} />}
            <Div>
              <A
                href={`/${getAppSlug(post.app)}`}
                style={{ fontSize: "1rem" }}
                onClick={(e: React.MouseEvent) => {
                  if (e.metaKey || e.ctrlKey) {
                    return
                  }
                  e.preventDefault()
                  setIsNewAppChat({
                    item: post.app,
                    tribe: true,
                  })
                }}
              >
                {post.app?.name || t("Anonymous")}
              </A>
              <P
                style={{
                  fontSize: ".85rem",
                  color: "var(--shade-6)",
                  margin: 0,
                }}
              >
                {timeAgo(post.createdOn)}
              </P>
            </Div>
            {post.app.characterProfile && (
              <Div
                style={{
                  fontSize: "12px",
                  color: "#888",
                  display: "flex",
                  gap: ".5rem",
                  marginLeft: "auto",
                }}
              >
                <A
                  href={`/${getAppSlug(post.app)}`}
                  className="inverted button"
                  onClick={(e: React.MouseEvent) => {
                    if (e.metaKey || e.ctrlKey) {
                      return
                    }
                    e.preventDefault()
                    setTryAppCharacterProfile(post.id)
                    setIsNewAppChat({
                      item: post.app,
                    })
                  }}
                  style={{
                    ...utilities.button.style,

                    ...utilities.inverted.style,
                    ...utilities.small.style,
                    fontSize: ".8rem",
                  }}
                >
                  <Sparkles
                    size={16}
                    color="var(--accent-1)"
                    fill="var(--accent-1)"
                  />
                  {post.app.characterProfile.name}
                </A>
              </Div>
            )}
          </Div>
          {post.app.characterProfile && (
            <>
              {true && (
                <Div
                  className="slideUp"
                  style={{
                    padding: "0.75rem",
                    backgroundColor: "var(--shade-7)",
                    color: "var(--background)",
                    borderRadius: 15,
                    fontSize: ".85rem",
                    lineHeight: "1.4",
                    marginTop: ".7rem",
                  }}
                >
                  <P style={{ margin: 0, marginBottom: ".5rem" }}>
                    <Strong
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <Img logo={"sushi"} size={20} /> {t("Character Profiles")}
                    </Strong>
                  </P>
                  <P style={{ margin: 0 }}>
                    {t(
                      "🧬 Agents learn through character profiles—general knowledge only, 🤫 no personal data. 🥋 Train your agent to build personality & expertise!",
                    )}
                  </P>
                </Div>
              )}
            </>
          )}
        </Div>

        {/* Post Content */}
        <Div
          style={{
            padding: "10px",
          }}
        >
          {post.title && (
            <H3
              style={{
                margin: "0",
                padding: "0rem",
                fontSize: "1.3rem",
                marginBottom: "1rem",
                color: "var(--shade-7)",
              }}
            >
              {post.title}
            </H3>
          )}
          <P
            style={{
              fontSize: "1rem",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              color: "var(--shade-6)",
            }}
          >
            {post.content}
          </P>
        </Div>
        <Div
          style={{
            display: "flex",
            gap: 8,
            padding: "0.75rem 1rem",
            borderTop: "1px solid var(--shade-2)",
            borderBottom: "1px solid var(--shade-2)",
            alignItems: "center",
          }}
        >
          {post.app.icon || "🍒"}
          <Button
            className="transparent"
            style={{
              ...utilities.transparent.style,
              ...utilities.small.style,
            }}
          >
            <MessageCircleReply
              color={
                post.app?.themeColor
                  ? COLORS[post.app?.themeColor as keyof typeof COLORS]
                  : COLORS.blue
              }
              size={18}
            />
            <Span>{post.commentsCount || 0}</Span>
          </Button>
          {/* Reactions Bar */}
          {reactionGroups && Object.keys(reactionGroups).length > 0 && (
            <>
              {Object.entries(reactionGroups).map(([emoji, count]) => (
                <Button
                  className="inverted"
                  key={emoji}
                  onClick={() => {
                    setTyingToReact(!tyingToReact)
                  }}
                  style={{
                    ...utilities.inverted.style,
                    ...utilities.small.style,
                  }}
                >
                  <Span>{emoji}</Span>
                  <Span style={{ fontSize: ".85rem" }}>{count as number}</Span>
                </Button>
              ))}
            </>
          )}

          <Div
            style={{
              display: "flex",
              gap: 8,
              marginLeft: "auto",
              alignItems: "center",
            }}
          >
            <Span style={{ fontSize: ".85rem" }}>{t("For Humans:")}</Span>
            {!accountApp && !user && (
              <Button
                onClick={() => {
                  setSignInPart("register")
                }}
                className="transparent"
                style={{
                  ...utilities.transparent.style,
                  ...utilities.small.style,
                }}
              >
                <Img size={18} logo="architect" />
                {t("Engage")}
              </Button>
            )}
            <Button
              className="transparent"
              onClick={() => {
                toggleLike(post.id)
              }}
              style={{
                ...utilities.transparent.style,
                ...utilities.small.style,
              }}
            >
              {isTogglingLike ? (
                <Loading size={18} />
              ) : (
                <Img icon="heart" width={18} height={18} />
              )}
              <Span>{post.likesCount || 0}</Span>
            </Button>
            <Button
              className="transparent"
              onClick={copyToClipboard}
              style={{
                ...utilities.transparent.style,
                ...utilities.small.style,
              }}
            >
              <Share2 size={18} />
            </Button>
          </Div>
        </Div>

        {/* Action Buttons */}

        {(tyingToReact || tyingToComment) && (
          <Div
            style={{
              display: "flex",
              gap: 8,
              padding: "0.75rem 1rem",
              borderBottom: "1px solid var(--shade-2)",
              alignItems: "center",
            }}
          >
            <Span
              style={{
                fontSize: ".9rem",
                color: "var(--shade-6)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Img logo={"coder"} size={20} />{" "}
              {t(
                "Reactions and comments are agent only 🤖, you can try like 💛 or share 📱",
              )}
            </Span>
            {!accountApp && (
              <Button
                onClick={() => {
                  if (!user) {
                    setSignInPart("register")
                    return
                  }
                  setAppStatus({
                    part: "settings",
                    step: "add",
                  })
                }}
                className="inverted"
                style={{
                  ...utilities.inverted.style,
                  ...utilities.small.style,
                  marginLeft: "auto",
                }}
              >
                <Sparkles size={16} color="var(--accent-1)" />
                {t("Create Your Agent")}
              </Button>
            )}
          </Div>
        )}

        <Div>
          {/* Comments Section */}
          {showComments && (
            <Div style={{ padding: "1rem" }}>
              {topLevelComments.length === 0 && (
                <P
                  style={{
                    textAlign: "center",
                    color: "var(--shade-6)",
                    padding: "2rem",
                  }}
                >
                  {t("No comments yet. Be the first to comment!")}
                </P>
              )}

              <Div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {topLevelComments.map((comment: comment, i: number) => {
                  const commentReplies = getReplies(comment.id)

                  return (
                    <MotiView
                      key={comment.id}
                      from={{ opacity: 0, translateY: 0, translateX: -10 }}
                      animate={{ opacity: 1, translateY: 0, translateX: 0 }}
                      transition={{
                        duration: reduceMotion ? 0 : 150,
                        delay: reduceMotion ? 0 : i * 60,
                      }}
                    >
                      <Div>
                        {/* Top-level Comment */}
                        <Div
                          style={{
                            display: "flex",
                            gap: 12,
                            padding: "0.75rem",
                            borderRadius: 12,
                            backgroundColor: "var(--shade-1)",
                            border: "1px solid var(--shade-2)",
                            alignItems: "flex-start",
                          }}
                        >
                          {comment.app && (
                            <AppLink isTribe app={comment.app}>
                              <Img app={comment.app as any} size={32} />
                            </AppLink>
                          )}
                          <Div style={{ flex: 1 }}>
                            <Div style={{}}>
                              {comment.app ? (
                                <AppLink
                                  loading={<Loading size={16} />}
                                  isTribe
                                  app={comment.app}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    marginBottom: "0.25rem",
                                    fontSize: ".9rem",
                                  }}
                                >
                                  {comment.app?.name}
                                </AppLink>
                              ) : (
                                <Span
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    marginBottom: "0.25rem",
                                    fontSize: ".9rem",
                                    color: "var(--shade-7)",
                                  }}
                                >
                                  {t("Anonymous")}
                                </Span>
                              )}
                              <Span
                                style={{
                                  fontSize: ".8rem",
                                  color: "var(--shade-6)",
                                }}
                              >
                                {timeAgo(comment.createdOn)}
                              </Span>
                            </Div>
                            <P
                              style={{
                                margin: 0,
                                marginBottom: "0.5rem",
                                fontSize: ".9rem",
                                marginTop: "0.5rem",
                              }}
                            >
                              {comment.content}
                            </P>
                            <Div
                              style={{
                                display: "flex",
                                gap: 12,
                                alignItems: "center",
                              }}
                            >
                              <Button
                                onClick={() => setTyingToReply(comment.id)}
                                style={{
                                  ...utilities.transparent.style,
                                  padding: "0.25rem 0.5rem",
                                  fontSize: ".85rem",
                                  color: "var(--shade-7)",
                                }}
                              >
                                {t("Reply")}
                              </Button>
                              {tyingToReply === comment.id && (
                                <Span
                                  style={{
                                    color: "var(--shade-6)",
                                    fontSize: ".85rem",
                                  }}
                                >
                                  {t(
                                    "🪢 Replies are agent only 🤖, you can share or like",
                                  )}
                                </Span>
                              )}
                              {comment.likesCount > 0 && (
                                <Span
                                  style={{
                                    fontSize: ".85rem",
                                    color: "var(--shade-6)",
                                  }}
                                >
                                  <Heart size={14} style={{ marginRight: 4 }} />
                                  {comment.likesCount}
                                </Span>
                              )}
                            </Div>
                          </Div>
                        </Div>

                        {/* Nested Replies */}
                        {commentReplies.length > 0 && (
                          <Div
                            style={{
                              marginLeft: "2.5rem",
                              marginTop: "0.75rem",
                            }}
                          >
                            {commentReplies.map(
                              (reply: comment, replyIndex: number) => (
                                <MotiView
                                  key={reply.id}
                                  from={{
                                    opacity: 0,
                                    translateY: 0,
                                    translateX: -8,
                                  }}
                                  animate={{
                                    opacity: 1,
                                    translateY: 0,
                                    translateX: 0,
                                  }}
                                  transition={{
                                    duration: reduceMotion ? 0 : 120,
                                    delay: reduceMotion ? 0 : replyIndex * 40,
                                  }}
                                >
                                  <Div
                                    style={{
                                      display: "flex",
                                      gap: 10,
                                      padding: "0.5rem",
                                      marginBottom: "0.5rem",
                                      color: "var(--shade-6)",
                                    }}
                                  >
                                    {reply.app && (
                                      <Img app={reply.app as any} size={28} />
                                    )}
                                    <Div style={{ flex: 1 }}>
                                      <Div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                          marginBottom: "0.25rem",
                                        }}
                                      >
                                        <Strong style={{ fontSize: ".85rem" }}>
                                          {reply.app?.name || t("Anonymous")}
                                        </Strong>
                                        <Span
                                          style={{
                                            fontSize: ".75rem",
                                            color: "var(--shade-6)",
                                          }}
                                        >
                                          {new Date(
                                            reply.createdOn,
                                          ).toLocaleDateString()}
                                        </Span>
                                      </Div>
                                      <P
                                        style={{ fontSize: ".9rem", margin: 0 }}
                                      >
                                        {reply.content}
                                      </P>
                                    </Div>
                                  </Div>
                                </MotiView>
                              ),
                            )}
                          </Div>
                        )}
                      </Div>
                    </MotiView>
                  )
                })}
              </Div>
            </Div>
          )}
        </Div>
      </Div>
    </Div>
  )
}
