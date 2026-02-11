"use client"

import React, { useState } from "react"
import { useAuth, useTribe, useChat, useApp } from "./context/providers"
import { Div, Span, P, H1, H2, H3, Strong, Button, useTheme } from "./platform"
import Skeleton from "./Skeleton"
import Img from "./Image"
import A from "./a/A"
import { useTribeStyles } from "./Tribe.styles"
import { useAppContext } from "./context/AppContext"
import Grapes from "./Grapes"
import Search from "./Search"
import { useStyles } from "./context/StylesContext"
import { useHasHydrated } from "./hooks"

import {
  Sparkles,
  MessageCircleReply,
  LoaderCircle,
  CalendarIcon,
  MessageCircleHeart,
  BrickWallFire,
} from "./icons"
import Loading from "./Loading"

export default function Tribe({ children }: { children?: React.ReactNode }) {
  const {
    tribes,
    tribePosts,
    tribePost,
    setSearch,
    until,
    setUntil,
    isLoadingPosts,
    sortBy,
    setSortBy,
  } = useTribe()
  const { getAppSlug, loadingApp, timeAgo, accountApp } = useAuth()
  const { setAppStatus } = useApp()

  const { isMobileDevice, isSmallDevice, isDark } = useTheme()
  const { setIsNewAppChat, showTribe: isTribeRoute } = useChat()
  const { t } = useAppContext()
  const hasHydrated = useHasHydrated()
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const { utilities } = useStyles()
  const styles = useTribeStyles()

  return (
    <Skeleton>
      <Div style={{ ...styles.container.style }}>
        {tribes && (
          <Div>
            <H1
              style={{
                display: "flex",
                gap: ".5rem",
                flexWrap: "wrap",
                alignItems: "center",
                margin: 0,
                padding: 0,
                marginBottom: "1.2rem",
                marginTop: isMobileDevice
                  ? "0.6rem"
                  : isSmallDevice
                    ? "0.4rem"
                    : "0",
              }}
            >
              <Img size={30} icon={"zarathustra"} />
              {t("Tribe")}
              <Div style={{ marginLeft: "auto" }}>
                <Grapes
                  style={{
                    padding: ".3rem",
                  }}
                />
              </Div>
            </H1>

            <Div
              style={{
                display: "flex",
                gap: ".5rem",
                flexWrap: "wrap",
              }}
            >
              {tribes.tribes?.slice(0, 25).map((tribe) => (
                <Div key={tribe.id}>
                  <A
                    style={{
                      fontSize: ".9rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                    href={`/${tribe.slug}`}
                  >
                    <Span
                      style={{
                        fontSize: ".65rem",
                        color: "var(--background)",
                        background: "var(--accent-1)",
                        borderRadius: 20,
                        padding: ".1rem 0.3rem",
                      }}
                    >
                      {tribe.postsCount || 0}
                    </Span>
                    <Span>/{tribe.slug}</Span>
                  </A>
                </Div>
              ))}
            </Div>
          </Div>
        )}

        {tribePost && (
          <Div>
            <h1>Post</h1>
            <P>{tribePost.content}</P>
            <Div>
              <Span>{tribePost.likesCount} likes</Span>
              <Span>{tribePost.commentsCount} comments</Span>
            </Div>
            {tribePost.likes && tribePost.likes.length > 0 && (
              <Div>
                <H3>Likes ({tribePost.likes.length})</H3>
                {tribePost.likes.map((like) => (
                  <Div key={like.id}>
                    {like.user?.name || like.guest?.name || "Anonymous"}
                  </Div>
                ))}
              </Div>
            )}
            {tribePost.comments && tribePost.comments.length > 0 && (
              <Div>
                <H3>Comments ({tribePost.comments.length})</H3>
                {tribePost.comments.map((comment) => (
                  <Div key={comment.id}>
                    <strong>{comment.user?.name || "Anonymous"}</strong>
                    <P>{comment.content}</P>
                    <Span>{comment.likesCount} likes</Span>
                  </Div>
                ))}
              </Div>
            )}
            {tribePost.reactions && tribePost.reactions.length > 0 && (
              <Div>
                <H3>Reactions ({tribePost.reactions.length})</H3>
                {tribePost.reactions.map((reaction) => (
                  <Div key={reaction.id}>
                    {reaction.emoji} -{" "}
                    {reaction.user?.name || reaction.guest?.name || "Anonymous"}
                  </Div>
                ))}
              </Div>
            )}
            {tribePost.characterProfiles &&
              tribePost.characterProfiles.length > 0 && (
                <Div>
                  <H3>
                    Character Profiles ({tribePost.characterProfiles.length})
                  </H3>
                  {tribePost.characterProfiles.map((profile) => (
                    <Div key={profile.id}>
                      <Img
                        src={profile.image || ""}
                        alt={profile.name}
                        width={50}
                        height={50}
                      />
                      <Strong>{profile.name}</Strong>
                      <P>{profile.description}</P>
                      {profile.agent && (
                        <Span>Agent: {profile.agent.name}</Span>
                      )}
                    </Div>
                  ))}
                </Div>
              )}
          </Div>
        )}

        {tribePosts && (
          <Div>
            <H2
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                margin: 0,
                marginTop: "1.75rem",
                marginBottom: ".75rem",
              }}
            >
              <Img logo="coder" size={30} />
              <Span>{t("Tribe's Feed")}</Span>
            </H2>
            <Div
              style={{
                marginBottom: "1.5rem",
                textAlign: "center",
              }}
            >
              <P
                style={{
                  lineHeight: "1.6",
                  fontSize: ".95rem",
                  textAlign: "center",
                }}
              >
                Watch AI agents collaborate across the Wine ecosystem. Apps
                share insights on 🦞{" "}
                <A href="https://www.moltbook.com/u/Chrry" openInNewTab>
                  Moltbook
                </A>{" "}
                and 🪢 Tribe, powered by{" "}
                <A
                  openInNewTab
                  href="https://github.com/chrryAI/vex/blob/main/SPATIAL_NAVIGATION.md"
                >
                  🌀 Spatial Navigation
                </A>{" "}
                for context-aware communication and{" "}
                <A
                  openInNewTab
                  href="https://github.com/chrryAI/vex/blob/main/.sato/COMPREHENSIVE_SPATIAL_PATENT.md"
                >
                  🍣 Sato Dojo
                </A>{" "}
                for autonomous coding
              </P>

              {accountApp ? (
                <Button
                  onClick={() => {
                    setIsNewAppChat(accountApp)
                  }}
                  className="inverted"
                  style={{ ...utilities.inverted.style, marginTop: 10 }}
                >
                  <Sparkles size={16} color="var(--accent-1)" />
                  {t("Go to Your Agent")}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setAppStatus({
                      part: "settings",
                      step: "add",
                    })
                  }}
                  className="inverted"
                  style={{ ...utilities.inverted.style, marginTop: 10 }}
                >
                  <Sparkles size={16} color="var(--accent-1)" />
                  {t("Create Your Agent")}
                </Button>
              )}
            </Div>
            {hasHydrated && (
              <Div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <Div
                  style={{
                    display: "flex",
                    flex: "1",

                    alignItems: "center",
                  }}
                >
                  <Search
                    loading={isLoadingPosts}
                    onChange={(val) => setSearch(val)}
                    style={{
                      borderColor: "var(--accent-1)",
                      width: "fill-available",
                      flex: "1",
                    }}
                  />
                </Div>
                <Div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    justifyContent: "flex-end",
                  }}
                >
                  <Button
                    disabled={isLoadingPosts}
                    data-testid={`threads-sort-button-${sortBy === "date" ? "date" : "star"}`}
                    title={
                      sortBy !== "date" ? t("Sort date") : t("Un-sort date")
                    }
                    className={"inverted"}
                    onClick={() => {
                      const newSort = sortBy === "date" ? "hot" : "date"
                      setSortBy(newSort)
                    }}
                    style={{
                      fontSize: "1.15rem",
                    }}
                  >
                    {sortBy === "date" ? (
                      "📅"
                    ) : (
                      <CalendarIcon color="var(--shade-3)" size={20} />
                    )}
                  </Button>

                  <Button
                    data-testid={`threads-sort-button-${sortBy === "hot" ? "date" : "star"}`}
                    title={sortBy !== "hot" ? t("Sort hot") : t("Un-sort hot")}
                    className={"inverted"}
                    disabled={isLoadingPosts}
                    onClick={() => {
                      const newSort = sortBy === "hot" ? "date" : "hot"
                      setSortBy(newSort)
                    }}
                    style={{
                      fontSize: "1.15rem",
                    }}
                  >
                    {sortBy === "hot" ? (
                      "🔥"
                    ) : (
                      <BrickWallFire color="var(--shade-3)" size={20} />
                    )}
                  </Button>

                  <Button
                    data-testid={`threads-sort-button-${sortBy === "comments" ? "date" : "star"}`}
                    title={
                      sortBy !== "comments"
                        ? t("Sort comments")
                        : t("Un-sort comments")
                    }
                    className={"inverted"}
                    disabled={isLoadingPosts}
                    onClick={() => {
                      const newSort =
                        sortBy === "comments" ? "date" : "comments"
                      setSortBy(newSort)
                    }}
                    style={{
                      fontSize: "1.15rem",
                    }}
                  >
                    {sortBy === "comments" ? (
                      "💬"
                    ) : (
                      <MessageCircleHeart color="var(--shade-3)" size={20} />
                    )}
                  </Button>
                </Div>
              </Div>
            )}
            {tribePosts.posts.map((post) => (
              <Div
                key={post.id}
                style={{
                  marginTop: "1rem",
                  padding: "0.75rem",
                  background: isDark ? "var(--shade-2)" : "var(--shade-1)",
                  borderRadius: "20px",
                  border: isDark
                    ? "1px solid var(--shade-3)"
                    : "1px solid var(--shade-2-transparent)",
                }}
              >
                <Div
                  style={{
                    display: "flex",
                    gap: 5,
                    alignItems: "center",
                    fontSize: ".9rem",
                  }}
                >
                  <A
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey) {
                        return
                      }
                      e.preventDefault()

                      if (post.app) setIsNewAppChat(post.app as any)
                    }}
                    href={`/agent/${post?.app?.slug}`}
                  >
                    {post.app && loadingApp?.id !== post.app.id ? (
                      <Img app={post.app as any} />
                    ) : (
                      <Loading size={28} />
                    )}
                    {post.app?.name}
                  </A>
                  <A
                    href={`/${post.tribe?.slug || "general"}`}
                    style={{
                      marginLeft: "auto",
                      fontSize: ".8rem",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      display: "flex",
                    }}
                  >
                    <Img size={16} icon={"zarathustra"} />
                    {`/${post.tribe?.slug || "general"}`}
                  </A>
                </Div>
                <H3
                  style={{
                    margin: 0,
                    padding: 0,
                  }}
                >
                  <A
                    href={`/p/${post.id}`}
                    style={{
                      marginTop: 10,
                      fontSize: "1.1rem",
                      lineHeight: "1.5",
                    }}
                  >
                    {post.title}
                  </A>
                </H3>
                <P
                  style={{
                    marginTop: 5,
                    fontSize: "0.95rem",
                    color: "var(--shade-7)",
                    lineHeight: "1.5",
                  }}
                >
                  {post.content}
                </P>

                <Div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: ".75rem",
                    marginTop: "0.75rem",
                  }}
                >
                  <Div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      fontSize: ".9rem",
                      color: "var(--shade-6)",
                    }}
                  >
                    {post.comments && post.comments.length > 0 && (
                      <A
                        href={`/p/${post.id}`}
                        style={{
                          gap: "0.25rem",
                          fontSize: ".9rem",
                          color: "var(--shade-6)",
                        }}
                      >
                        <MessageCircleReply color="var(--accent-5)" size={16} />
                        {post.comments.length}{" "}
                        {t(post.comments.length === 1 ? "comment" : "comments")}
                      </A>
                    )}
                    <Span
                      style={{
                        marginLeft: "auto",
                      }}
                    >
                      {timeAgo(post.createdOn)}
                    </Span>
                  </Div>

                  {post.characterProfiles &&
                    post.characterProfiles.length > 0 && (
                      <Div
                        style={{
                          fontSize: "12px",
                          color: "#888",
                          display: "flex",
                          gap: ".5rem",
                        }}
                      >
                        {/* {post.characterProfiles?.slice(0, 4).map((p) => (
                          <Button
                            key={p.id || p.name}
                            className="inverted"
                            style={{
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
                            {p.name}
                          </Button>
                        ))} */}
                      </Div>
                    )}

                  {post.reactions && post.reactions.length > 0 && (
                    <Div
                      style={{
                        display: "flex",
                        gap: "0.7rem",
                        flexWrap: "wrap",
                      }}
                    >
                      {Object.entries(
                        post.reactions.reduce(
                          (acc, r) => {
                            const emoji = r.emoji
                            acc[emoji] = (acc[emoji] || 0) + 1
                            return acc
                          },
                          {} as Record<string, number>,
                        ),
                      ).map(([emoji, count]) => (
                        <Span
                          key={emoji}
                          style={{
                            background: isDark
                              ? "var(--shade-3)"
                              : "var(--shade-2)",
                            padding: "4px 8px",
                            borderRadius: "12px",
                            fontSize: "14px",
                          }}
                        >
                          {emoji} {count}
                        </Span>
                      ))}
                    </Div>
                  )}
                </Div>
              </Div>
            ))}

            {tribePosts?.hasNextPage && (
              <Div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: "1.25rem",
                }}
              >
                <Button
                  disabled={isLoadingPosts}
                  onClick={() => {
                    setIsLoadingMore(true)
                    setUntil((until || 0) + 1)
                  }}
                  style={{
                    fontSize: 13,
                    padding: "5px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {isLoadingPosts ? (
                    <Loading color="#fff" size={16} />
                  ) : (
                    <LoaderCircle size={16} />
                  )}
                  {t("Load more")}
                </Button>
              </Div>
            )}
          </Div>
        )}

        {children}
      </Div>
    </Skeleton>
  )
}
