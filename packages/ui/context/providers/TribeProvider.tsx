"use client"

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
} from "react"
import {
  paginatedTribes,
  paginatedTribePosts,
  tribePostWithDetails,
  appWithStore,
} from "../../types"
import { useChat } from "./ChatProvider"
import { useAuth, useData } from "."
import useSWR from "swr"
import { useLocalStorage } from "../../hooks"

import { useNavigation } from "../../platform"
import { apiFetch } from "../../utils"
import { useAppContext } from "../../context/AppContext"
import toast from "react-hot-toast"

interface TribeContextType {
  tribes?: paginatedTribes
  tribePosts?: paginatedTribePosts
  tribePost?: tribePostWithDetails
  search?: string
  until?: number
  postId?: string
  characterProfileIds?: string[]
  isLoadingPosts?: boolean
  isLoadingTribes?: boolean
  isLoadingPost?: boolean
  tribePostError?: Error
  sortBy: "date" | "hot" | "comments"
  tribeSlug?: string
  currentTribe?: paginatedTribes["tribes"][number]
  setSortBy: (val: "date" | "hot" | "comments") => void
  setTribes: (tribes?: paginatedTribes) => void
  setTribePosts: (tribePosts?: paginatedTribePosts) => void
  setTribePost: (tribePost?: tribePostWithDetails) => void
  setSearch: (search?: string) => void
  setUntil: (val: number) => void
  setCharacterProfileIds: (ids?: string[]) => void
  refetchPosts: () => void
  refetchTribes: () => void
  toggleLike: (postId: string) => Promise<{ liked: boolean }>
  isTogglingLike: string | undefined
}

const TribeContext = createContext<TribeContextType | undefined>(undefined)

interface TribeProviderProps {
  children: ReactNode
}

export function TribeProvider({ children }: TribeProviderProps) {
  const { showTribe } = useChat()
  const {
    tribes: initialTribes,
    tribePosts: initialTribePosts,
    tribePost: initialTribePost,
    showTribeProfile,
    token,
    postId,
    tribePosts,
    setTribePosts,
    tribePost,
    setTribePost,
    mergeApps,
    app, // Current selected app for filtering
  } = useAuth()

  const [tribes, setTribes] = useState<paginatedTribes | undefined>(
    initialTribes,
  )

  const { pathname } = useNavigation()

  const { captureException, t } = useAppContext()

  // Extract tribe slug from pathname like /tribe/entertainment
  const tribeSlug = pathname?.startsWith("/tribe/")
    ? pathname.replace("/tribe/", "").split("?")[0]
    : undefined

  const [sortBy, setSortByInternal] = useLocalStorage<
    "date" | "hot" | "comments"
  >("sortBy", "hot")

  const setSortBy = (val: "date" | "hot" | "comments") => {
    setShouldLoadPosts(true)
    setSortByInternal(val)
  }

  const [shouldLoadPosts, setShouldLoadPostsInternal] =
    useState<boolean>(!initialTribes)

  const setShouldLoadPosts = useCallback(
    (val: boolean) => {
      if (shouldLoadPosts === val) return

      setShouldLoadPostsInternal(val)
    },
    [shouldLoadPosts],
  )
  const [search, setSearchInitial] = useState<string | undefined>()

  const setSearch = (val?: string) => {
    setShouldLoadPosts(true)
    setSearchInitial(val)
  }
  const [until, setUntilInitial] = useState<number>(1)

  const setUntil = (val: number) => {
    setShouldLoadPosts(true)
    setUntilInitial(val)
  }
  const [characterProfileIds, setCharacterProfileIdsInternal] = useState<
    string[] | undefined
  >()

  const setCharacterProfileIds = (val: string[] | undefined) => {
    setShouldLoadPosts(true)
    setCharacterProfileIdsInternal(val)
  }

  useEffect(() => {
    // Trigger refetch when sortBy changes
    setShouldLoadPosts(true)
  }, [setShouldLoadPosts, sortBy])

  const { actions, API_URL } = useData()

  const canShowTribeProfile = showTribeProfile

  // Fetch tribes with SWR - filter by tribes where this app has posted
  const {
    data: tribesData,
    isLoading: isLoadingTribes,
    mutate: refetchTribes,
  } = useSWR(
    showTribe && token ? ["tribes", app?.id, canShowTribeProfile] : null,
    () => {
      if (!token) return
      return actions.getTribes({
        appId: canShowTribeProfile ? app?.id : undefined, // Show tribes where this app has posted
      })
    },
    {
      fallbackData: initialTribes,
      revalidateOnFocus: false,
    },
  )

  const {
    data: tribePostData,
    mutate: refetchTribePost,
    error: tribePostError,
    isLoading: isLoadingPost,
  } = useSWR(
    postId && token ? ["tribePost", postId, app?.id] : null,
    () => {
      if (!token || !postId) return
      return actions.getTribePost({
        id: postId,
        appId: app?.id,
      })
    },
    {
      fallbackData: initialTribePost,
      revalidateOnFocus: false,
    },
  )

  useEffect(() => {
    if (tribePostData) {
      setTribePost(tribePostData)
    }
  }, [setTribePost, tribePostData])

  useEffect(() => {
    if (tribesData) {
      setTribes(tribesData)
    }
  }, [tribesData])

  // Find tribe ID from slug
  const currentTribe = tribeSlug
    ? tribes?.tribes?.find((t) => t.slug === tribeSlug)
    : undefined
  const tribeId = currentTribe?.id

  const {
    data: tribePostsData,
    mutate: refetchPosts,
    isLoading: isLoadingPosts,
  } = useSWR(
    (search ? search.length > 2 : true) && showTribe && token
      ? [
          "tribePosts",
          until,
          search,
          characterProfileIds,
          sortBy,
          app?.id,
          tribeId,
          canShowTribeProfile,
        ]
      : null,
    () => {
      if (!token) return
      return actions.getTribePosts({
        pageSize: 10 * until,
        search,
        characterProfileIds,
        sortBy,
        appId: !canShowTribeProfile ? undefined : app?.id, // Filter by current selected app
        tribeId, // Filter by tribe when viewing /tribe/:slug
      })
    },
    {
      fallbackData: initialTribePosts,
      revalidateOnFocus: false,
    },
  )

  useEffect(() => {
    if (tribePostsData) {
      setTribePosts(tribePostsData)
    }
  }, [setTribePosts, tribePostsData])

  const [isTogglingLike, setIsTogglingLike] = useState<string | undefined>(
    undefined,
  )

  const toggleLike = async (postId: string): Promise<{ liked: boolean }> => {
    if (!postId) {
      console.error("Post ID is required")
      captureException(new Error("Post ID is required"))
      return { liked: false }
    }
    if (!token) {
      console.error("Not authenticated")
      captureException(new Error("Not authenticated"))
      return { liked: false }
    }

    setIsTogglingLike(postId)

    try {
      const response = await apiFetch(`${API_URL}/tribe/p/${postId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        toast.error(`Failed to toggle like: ${response.status}`)
        captureException(new Error(`Failed to toggle like: ${response.status}`))
        return { liked: false }
      }

      const data = await response.json()
      // Refetch posts to update like counts
      await refetchPosts()
      if (tribePost?.id === postId) {
        await refetchTribePost()
      }

      return { liked: data.liked }
    } catch (error) {
      captureException(error)
      console.error("Failed to toggle like:", error)
      toast.error(t("Something went wrong"))
      return { liked: false }
    } finally {
      setIsTogglingLike(undefined)
    }
  }

  useEffect(() => {
    // Collect unique apps from posts, comments, and replies using a Set
    const appsSet = new Map<string, appWithStore>()

    // Add apps from posts
    if (tribePosts?.posts) {
      tribePosts.posts.forEach((post) => {
        if (post.app) {
          appsSet.set(post.app.id, post.app)
        }

        // Add apps from comments and replies
        post.comments?.forEach((comment) => {
          if (comment.app) {
            appsSet.set(comment.app.id, comment.app)
          }
        })
      })
    }

    // Add app from single post view
    if (tribePost?.app) {
      appsSet.set(tribePost.app.id, tribePost.app)
    }

    if (tribePost?.comments) {
      tribePost.comments.forEach((comment) => {
        if (comment.app) {
          appsSet.set(comment.app.id, comment.app)
        }
      })
    }

    // Merge all unique apps
    mergeApps(Array.from(appsSet.values()))
  }, [tribePosts, tribePost, mergeApps])

  const value: TribeContextType = {
    tribes,
    tribePosts,
    tribePost,
    search,
    until,
    characterProfileIds,
    isLoadingPosts,
    isLoadingTribes,
    isLoadingPost,
    tribePostError,
    tribeSlug,
    currentTribe,
    setTribes,
    setTribePosts,
    setTribePost,
    sortBy,
    setSortBy,
    setSearch,
    postId,
    setUntil,
    setCharacterProfileIds,
    toggleLike,
    isTogglingLike,
    refetchPosts: async () => {
      setShouldLoadPosts(true)
      return refetchPosts()
    },
    refetchTribes: async () => {
      return refetchTribes()
    },
  }

  return <TribeContext.Provider value={value}>{children}</TribeContext.Provider>
}

export function useTribe() {
  const context = useContext(TribeContext)
  if (context === undefined) {
    throw new Error("useTribe must be used within a TribeProvider")
  }
  return context
}
