import React, { useState, useEffect } from "react"
import styles from "./CollaborationStatus.module.scss"
import clsx from "clsx"
import type { thread, collaboration, user } from "./types"
import { useAppContext } from "./context/AppContext"
import { Check, CircleCheck, CircleX, Trash2, UsersRound, X } from "./icons"
import toast from "react-hot-toast"
import Loading from "./Loading"
import ConfirmButton from "./ConfirmButton"
import { useAuth, useNavigationContext } from "./context/providers"
import { useData } from "./context/providers/DataProvider"
import { useTheme } from "./platform"

export default function CollaborationStatus({
  thread,
  className,
  isIcon,
  onSave,
  style,
  dataTestId,
}: {
  thread: thread
  className?: string
  isIcon?: boolean
  onSave?: (status: "active" | "pending" | "revoked" | "rejected") => void
  dataTestId?: string
  style?: React.CSSProperties
}) {
  const { t } = useAppContext()
  const { user, token } = useAuth()
  const { isMobileDevice } = useTheme()
  const [isLoading, setIsLoading] = React.useState(false)
  const [status, setStatus] = useState<
    "active" | "pending" | "revoked" | "rejected"
  >("pending")

  const collaboration = thread.collaborations?.find(
    (collaboration) => collaboration.user.id === user?.id,
  )

  const { actions } = useData()

  useEffect(() => {
    if (collaboration) {
      collaboration.collaboration.status &&
        setStatus(collaboration.collaboration.status)
    }
  }, [collaboration?.collaboration.status])

  if (!collaboration) return null

  const collaborationId = collaboration.collaboration.id
  const iconSize = isIcon ? 15 : 16
  const fontSize = iconSize - 3

  const handleStatusChange = async (
    status: "active" | "pending" | "revoked" | "rejected",
  ) => {
    if (!token) return
    setStatus(status)
    setIsLoading(true)
    try {
      const data = await actions.updateCollaboration({
        id: collaborationId,
        status,
      })

      if (data.error) {
        toast.error(data.error)
        return
      }
      toast.success(t("Updated"))
      onSave?.(status)
    } catch (error) {
      toast.error(t("Failed to update collaboration"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      style={{ gap: isIcon ? 5 : 10, ...style }}
      className={clsx(styles.collaborationStatus, className)}
    >
      {!isIcon && <UsersRound color="var(--accent-1)" size={16} />}

      {collaboration?.collaboration.status === "pending" ? (
        <>
          <ConfirmButton
            data-testid={`${dataTestId}-reject-collaboration`}
            style={{ fontSize }}
            title={isMobileDevice ? t("Reject") : undefined}
            confirmTitle={isMobileDevice ? t("Are you sure?") : undefined}
            className="link"
            processing={isLoading && status === "rejected"}
            onConfirm={() => handleStatusChange("rejected")}
          >
            {isLoading && status === "rejected" ? (
              <Loading width={iconSize} height={iconSize} />
            ) : (
              <CircleX color="var(--accent-0)" size={iconSize} />
            )}
          </ConfirmButton>
          <button
            title={isMobileDevice ? t("Accept") : undefined}
            data-testid={`${dataTestId}-accept-collaboration`}
            style={{ fontSize }}
            className="link"
            disabled={isLoading}
            onClick={() => handleStatusChange("active")}
          >
            {isLoading && status === "active" ? (
              <Loading width={iconSize} height={iconSize} />
            ) : (
              <CircleCheck color="var(--accent-4)" size={iconSize} />
            )}
          </button>
        </>
      ) : (
        <ConfirmButton
          disabled={isLoading}
          title={isMobileDevice ? t("Leave") : undefined}
          style={{ fontSize }}
          className="link"
          processing={isLoading && status === "revoked"}
          onConfirm={() => handleStatusChange("revoked")}
        >
          <>
            {isLoading && status === "revoked" ? (
              <Loading width={iconSize} height={iconSize} />
            ) : (
              <CircleX color="var(--accent-0)" size={iconSize} />
            )}
            <span>{t("Leave")}</span>
          </>
        </ConfirmButton>
      )}
    </div>
  )
}
