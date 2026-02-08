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

interface TribeContextType {
  tribes?: paginatedTribes
  tribePosts?: paginatedTribePosts
  tribePost?: tribePostWithDetails
  isTribeRoute?: boolean
  search?: string
  until?: number
  characterProfileIds?: string[]
  isLoadingPosts?: boolean
  setTribes: (tribes?: paginatedTribes) => void
  setTribePosts: (tribePosts?: paginatedTribePosts) => void
  setTribePost: (tribePost?: tribePostWithDetails) => void
  setIsTribeRoute: (isTribeRoute?: boolean) => void
  setSearch: (search?: string) => void
  setUntil: React.Dispatch<React.SetStateAction<number>>
  setCharacterProfileIds: (ids?: string[]) => void
  refetchPosts: () => void
}

const TribeContext = createContext<TribeContextType | undefined>(undefined)

interface TribeProviderProps {
  children: ReactNode
  isTribeRoute?: boolean
}

export function TribeProvider({
  children,
  isTribeRoute: initialIsTribeRoute,
}: TribeProviderProps) {
  const { showTribe } = useChat()
  const {
    tribes: initialTribes,
    tribePosts: initialTribePosts,
    tribePost: initialTribePost,
    token,
  } = useAuth()
  const [tribes, setTribes] = useState<paginatedTribes | undefined>(
    initialTribes,
  )
  const [tribePosts, setTribePosts] = useState<paginatedTribePosts | undefined>(
    initialTribePosts,
  )
  const [tribePost, setTribePost] = useState<tribePostWithDetails | undefined>(
    initialTribePost,
  )
  const [search, setSearch] = useState<string | undefined>()
  const [until, setUntil] = useState<number>(1)
  const [characterProfileIds, setCharacterProfileIds] = useState<
    string[] | undefined
  >()

  const [isTribeRoute, setIsTribeRoute] = useState<boolean | undefined>(
    initialIsTribeRoute || showTribe,
  )

  useEffect(() => {
    !showTribe && setIsTribeRoute(false)
  }, [showTribe])

  const { actions } = useData()

  console.log(`🚀 ~ TribeProvider ~ until:`, until)

  const {
    data: tribePostsData,
    mutate: refetchPosts,
    isLoading: isLoadingPosts,
  } = useSWR(
    showTribe && token
      ? ["tribePosts", until, search, characterProfileIds]
      : null,
    () => {
      if (!token) return
      return actions.getTribePosts({
        pageSize: 10 * until,
        search,
        characterProfileIds,
      })
    },
    {
      fallbackData: initialTribePosts,
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
    isTribeRoute,
    search,
    until,
    characterProfileIds,
    isLoadingPosts,
    setTribes,
    setTribePosts,
    setTribePost,
    setIsTribeRoute,
    setSearch,
    setUntil,
    setCharacterProfileIds,
    refetchPosts,
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
