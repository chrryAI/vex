"use client"

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react"
import {
  paginatedTribes,
  paginatedTribePosts,
  tribePostWithDetails,
} from "../../types"
import { useChat } from "./ChatProvider"
import { useAuth, useData } from "."
import useSWR from "swr"
import { useLocalStorage } from "../../hooks"

interface TribeContextType {
  tribes?: paginatedTribes
  tribePosts?: paginatedTribePosts
  tribePost?: tribePostWithDetails
  search?: string
  until?: number
  characterProfileIds?: string[]
  isLoadingPosts?: boolean
  sortBy: "date" | "hot" | "comments"
  setSortBy: (val: "date" | "hot" | "comments") => void
  setTribes: (tribes?: paginatedTribes) => void
  setTribePosts: (tribePosts?: paginatedTribePosts) => void
  setTribePost: (tribePost?: tribePostWithDetails) => void
  setSearch: (search?: string) => void
  setUntil: (val: number) => void
  setCharacterProfileIds: (ids?: string[]) => void
  refetchPosts: () => void
  refetchTribes: () => void
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
    app, // Current selected app for filtering
  } = useAuth()
  const [tribes, setTribes] = useState<paginatedTribes | undefined>(
    initialTribes,
  )

  const [sortBy, setSortByInternal] = useLocalStorage<
    "date" | "hot" | "comments"
  >("sortBy", "hot")

  const setSortBy = (val: "date" | "hot" | "comments") => {
    setShouldLoadPosts(true)
    setSortByInternal(val)
  }

  const [tribePosts, setTribePosts] = useState<paginatedTribePosts | undefined>(
    initialTribePosts,
  )
  const [tribePost, setTribePost] = useState<tribePostWithDetails | undefined>(
    initialTribePost,
  )

  const [shouldLoadPosts, setShouldLoadPostsInternal] =
    useState<boolean>(!initialTribes)

  const setShouldLoadPosts = (val: boolean) => {
    if (shouldLoadPosts === val) return

    setShouldLoadPostsInternal(val)
  }
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
  }, [sortBy])

  const { actions } = useData()

  // Fetch tribes with SWR (no app filtering - tribes are independent)
  const { data: tribesData, mutate: refetchTribes } = useSWR(
    showTribe && token ? ["tribes"] : null,
    () => {
      if (!token) return
      return actions.getTribes({
        // Don't filter tribes by app - they're independent communities
      })
    },
  )

  useEffect(() => {
    if (tribesData) {
      setTribes(tribesData)
    }
  }, [tribesData])

  const {
    data: tribePostsData,
    mutate: refetchPosts,
    isLoading: isLoadingPosts,
  } = useSWR(
    (search ? search.length > 2 : true) && showTribe && token
      ? ["tribePosts", until, search, characterProfileIds, sortBy, app?.id]
      : null,
    () => {
      if (!token) return
      return actions.getTribePosts({
        pageSize: 10 * until,
        search,
        characterProfileIds,
        sortBy,
        appId: !showTribeProfile ? undefined : app?.id, // Filter by current selected app
      })
    },
  )

  useEffect(() => {
    if (tribePostsData) {
      setTribePosts(tribePostsData)
    }
  }, [tribePostsData])

  const value: TribeContextType = {
    tribes,
    tribePosts,
    tribePost,
    search,
    until,
    characterProfileIds,
    isLoadingPosts,
    setTribes,
    setTribePosts,
    setTribePost,
    sortBy,
    setSortBy,
    setSearch,
    setUntil,
    setCharacterProfileIds,
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
