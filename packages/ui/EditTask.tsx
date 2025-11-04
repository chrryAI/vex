"use client"

import React, { useEffect, useState } from "react"
import styles from "./EditTask.module.scss"
import clsx from "clsx"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import z from "zod"
import {
  API_URL,
  apiFetch,
  FRONTEND_URL,
  pageSizes,
  replaceLinks,
} from "./utils"
import Loading from "./Loading"
import { Task } from "./FocusButton"
import ConfirmButton from "./ConfirmButton"
import {
  Trash2,
  ClockIcon,
  Clock,
  MousePointerClick,
  Pencil,
  LoaderCircle,
  ArrowLeft,
  Sparkles,
} from "lucide-react"
import sanitizeHtml from "sanitize-html"
import { newTaskLog, taskLog } from "./types"
import { emojiMap, Mood } from "./Moodify"
import { PiHandTap } from "react-icons/pi"
import useSWR from "swr"
import MoodSelector from "./MoodSelector"
import { useTranslation } from "react-i18next"
import { toast, useNavigation } from "./platform"
import { useAuth } from "./context/providers"

const EditTaskSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  id: z.string(),
})

const NewTaskLogSchema = z.object({
  content: z.string().min(1, { message: "Message is required" }),
  mood: z
    .enum(["happy", "sad", "angry", "astonished", "inlove", "thinking"])
    .optional(),
})

const EditTaskLogSchema = z.object({
  id: z.string().min(1, { message: "Id is required" }),
  content: z.string().min(1, { message: "Message is required" }),
  mood: z
    .enum(["happy", "sad", "angry", "astonished", "inlove", "thinking"])
    .optional(),
})

const EditTask = ({
  editingTask,
  onCancel,
  onDelete,
  onEdit,
  fetchTasks,
}: {
  editingTask: Task
  onCancel?: () => void
  onDelete?: () => void
  onEdit?: () => void
  fetchTasks: () => Promise<void>
}) => {
  const { t, i18n } = useTranslation()
  const { push, addParams } = useNavigation()
  const { token, timeAgo, guest, language, track: trackEvent } = useAuth()
  const [mood, setMood] = useState<Mood | undefined>(undefined)

  const {
    handleSubmit: handleEditTaskSubmit,
    formState: { errors: editTaskErrors, isSubmitting: isEditing },
    reset: resetEditTask,
    register: registerEditTask,
  } = useForm<z.infer<typeof EditTaskSchema>>({
    mode: "onChange",
    resolver: zodResolver(EditTaskSchema),
    defaultValues: {
      title: editingTask?.title || "",
      id: editingTask?.id || "",
    },
  })

  const {
    setValue: setValueAddTaskLog,
    handleSubmit: handleAddTaskLogSubmit,
    formState: { errors: addTaskLogErrors, isSubmitting: isSubmittingAddLog },
    reset: resetAddTaskLog,
    register: registerAddTaskLog,
  } = useForm<z.infer<typeof NewTaskLogSchema>>({
    mode: "onChange",
    resolver: zodResolver(NewTaskLogSchema),
    defaultValues: {
      content: "",
    },
  })

  useEffect(() => {
    trackEvent({ name: "edit_task" })
    addParams({ editTask: editingTask.id })
  }, [])

  const handleMoodClick = (selectedMood: Mood) => {
    setMood(selectedMood)
    setValueAddTaskLog("mood", selectedMood)
  }

  const [editingTaskLog, setEditingTaskLog] = useState<taskLog | null>(null)
  const [isDeletingTaskLog, setIsDeletingTaskLog] = useState(false)
  const [isEditingTaskLog, setIsEditingTaskLog] = useState(false)
  const [isAddingTaskLog, setIsAddingTaskLog] = useState(false)
  const [until, setUntil] = useState<number>(1)

  const [taskLogs, setTaskLogs] = useState<{
    taskLogs: taskLog[]
    totalCount: number
    hasNextPage: boolean
    nextPage: number | null
  }>({
    taskLogs: [],
    totalCount: 0,
    hasNextPage: false,
    nextPage: null,
  })

  const {
    data: taskLogsData,
    isLoading: isLoadingTaskLogs,
    mutate: refetchTaskLogs,
  } = useSWR(
    token ? ["taskLogs", editingTask.id, until, token] : null,
    async () => {
      const url = `${API_URL}/tasks/${editingTask.id}/taskLogs?pageSize=${until * pageSizes.taskLogs}`

      const response = await apiFetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      return response.json()
    },
  )

  useEffect(() => {
    if (taskLogsData) {
      setTaskLogs(taskLogsData)
    }
  }, [taskLogsData])

  const {
    watch: watchEditTaskLog,
    handleSubmit: handleEditTaskLogSubmit,
    setValue: setValueEditTaskLog,
    formState: { errors: editTaskLogErrors, isSubmitting: isSubmittingEditLog },
    register: registerEditTaskLog,
  } = useForm<z.infer<typeof EditTaskLogSchema>>({
    mode: "onChange",
    resolver: zodResolver(EditTaskLogSchema),
    defaultValues: {
      content: editingTaskLog?.content || "",
      mood: editingTaskLog?.mood || undefined,
    },
  })

  useEffect(() => {
    ;(
      document.querySelector(
        '#editTaskForm input[name="title"]',
      ) as HTMLInputElement
    )?.focus()
    resetEditTask({
      title: editingTask.title,
      id: editingTask.id,
    })
  }, [resetEditTask])

  const onEditTask = handleEditTaskSubmit(async (data) => {
    if (!editingTask) return
    setIsEditingTaskLog(true)

    const now = new Date()
    const updatedTask: Task = {
      ...editingTask,
      title: sanitizeHtml(data.title),
      modifiedOn: now,
    }

    toast.success("Task updated")

    trackEvent({ name: "task_edit" })

    try {
      await apiFetch(`${API_URL}/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedTask),
      })

      await fetchTasks()

      onEdit?.()
    } catch (error) {
      console.error("Error editing task:", error)
    } finally {
      setIsEditingTaskLog(false)
    }
  })

  const onNewTaskLog = handleAddTaskLogSubmit(async (data) => {
    if (!editingTask) return

    setIsAddingTaskLog(true)
    setMood(undefined)

    const newTaskLog: newTaskLog = {
      content: sanitizeHtml(data.content),
      mood: data.mood || null,
      taskId: editingTask.id,
    }

    trackEvent({ name: "task_log_add" })

    try {
      await apiFetch(`${API_URL}/taskLogs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTaskLog),
      })

      resetAddTaskLog()
      refetchTaskLogs()
    } catch (error) {
      toast.error("Error adding task log")
      console.error("Error adding task log:", error)
    } finally {
      setIsAddingTaskLog(false)
    }
  })

  useEffect(() => {
    if (!editingTaskLog) return
    setValueEditTaskLog("content", editingTaskLog.content)
    setValueEditTaskLog("mood", editingTaskLog.mood || undefined)
  }, [editingTaskLog])

  const onEditTaskLog = handleEditTaskLogSubmit(async (data) => {
    if (!editingTaskLog) return

    setIsEditingTaskLog(true)

    const updatedTaskLog: taskLog = {
      ...editingTaskLog,
      id: editingTaskLog.id,
      content: sanitizeHtml(data.content),
      mood: data.mood || null,
      taskId: editingTaskLog.taskId,
    }

    trackEvent({ name: "task_log_edit" })

    try {
      await apiFetch(`${API_URL}/taskLogs/${editingTaskLog.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedTaskLog),
      })

      toast.success("Log updated")
      await refetchTaskLogs()
      setEditingTaskLog(null)
    } catch (error) {
      console.error("Error editing task log:", error)
    } finally {
      setIsEditingTaskLog(false)
    }
  })

  const [isDeletingTask, setIsDeletingTask] = React.useState(false)

  return (
    <div className={styles.editTask}>
      <form id="editTaskForm" onSubmit={onEditTask}>
        <h2 className={styles.editTaskTitle}>
          <Pencil size={18} /> {t("Edit Task")}
        </h2>
        <input
          data-testid="edit-task-input"
          className={clsx(
            styles.editTaskInput,
            editTaskErrors.title && styles.inputError,
          )}
          {...registerEditTask("title")}
          placeholder={t("Task title")}
          type="text"
        />
        {editTaskErrors.title && (
          <div data-testid="edit-task-error" className={styles.fieldError}>
            {editTaskErrors.title.message}
          </div>
        )}
        <input
          type="hidden"
          {...registerEditTask("id")}
          value={editingTask.id}
        />

        <div className={styles.editTaskButtons}>
          <button data-testid="edit-task-save-button" type="submit">
            {isEditing ? (
              <Loading width={18} height={18} color="#fff" />
            ) : (
              t("Save")
            )}
          </button>

          <div className={styles.cancelAndDeleteEditTaskButtons}>
            <button
              data-testid="edit-task-cancel-button"
              type="button"
              className={"transparent"}
              onClick={() => {
                // onCancel?.()
                push("/focus")
              }}
            >
              <ArrowLeft width={16} height={16} /> {t("Back")}
            </button>

            <ConfirmButton
              data-testid="edit-task-delete-button"
              className={"transparent"}
              onConfirm={async () => {
                setIsDeletingTask(true)

                trackEvent({ name: "task_delete" })

                await apiFetch(`${API_URL}/tasks/${editingTask.id}`, {
                  method: "DELETE",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                }).catch((error) => {
                  toast.error("Failed to delete task")
                })

                await fetchTasks()

                toast.success("Task deleted")
                setIsDeletingTask(false)

                onDelete?.()
              }}
              confirm={
                <>
                  {isDeletingTask ? (
                    <Loading width={18} height={18} color="#fff" />
                  ) : (
                    <Trash2 width={18} height={18} />
                  )}{" "}
                  {t("Are you sure?")}
                </>
              }
            >
              <Trash2 width={14} height={14} />
              {t("Delete")}
            </ConfirmButton>
          </div>
        </div>
      </form>
      <div>
        <form
          className={styles.taskLogForm}
          id="addTaskLogForm"
          onSubmit={onNewTaskLog}
        >
          {guest ? (
            <div
              data-testid="task-log-form-guest-message"
              className={styles.taskLogFormGuestMessage}
            >
              🧠{" "}
              {t(
                "Want to see how your tasks affect your mood over time? Sign up to unlock mood charts and smart insights",
              )}
            </div>
          ) : !isLoadingTaskLogs && taskLogs?.totalCount === 0 ? (
            <div
              data-testid="task-log-form-empty-message"
              className={styles.taskLogFormMemberMessage}
            >
              ✍️{" "}
              {t("Start by adding your first log to see your progress here!")}
            </div>
          ) : undefined}
          <textarea
            data-testid="add-task-log-textarea"
            className={styles.taskLogFormTextarea}
            {...registerAddTaskLog("content")}
            placeholder="Log your thoughts..."
          />
          {addTaskLogErrors.content && (
            <div data-testid="add-task-log-error" className={styles.fieldError}>
              {addTaskLogErrors.content.message}
            </div>
          )}
          <div className={styles.taskLogFormActions}>
            <div className={styles.moodContainer}>
              <MoodSelector
                mood={mood}
                onMoodChange={(mood) => mood && handleMoodClick(mood)}
                className={styles.moodSelector}
              />
            </div>
            <button
              data-testid="add-task-log-submit-button"
              disabled={isSubmittingAddLog}
              className={clsx("inverted", styles.submitButton)}
              type="submit"
            >
              {isSubmittingAddLog ? <Loading width={18} height={18} /> : "Log"}
            </button>
          </div>
        </form>

        {!taskLogs.taskLogs?.length && isLoadingTaskLogs ? (
          <div className={styles.loadingTaskLogs}>
            <Loading />
          </div>
        ) : (
          <>
            <div className={styles.taskLogs}>
              {taskLogs.taskLogs?.map((log) => (
                <div
                  data-testid="task-log"
                  data-content={log.content}
                  data-mood={log.mood}
                  key={log.id}
                  className={styles.taskLog}
                >
                  {editingTaskLog?.id !== log.id ? (
                    <div>
                      <div className={styles.taskLogTitle}>
                        {log.mood && <span>{emojiMap[log.mood]}</span>}
                        <button
                          data-testid="edit-task-log-edit-button"
                          className={clsx(
                            "link",
                            styles.editLogMoodButton,
                            !log.mood && styles.single,
                          )}
                          onClick={() => setEditingTaskLog(log)}
                        >
                          {t("Edit")}
                        </button>
                        <span className={styles.taskLogTitleTime}>
                          {timeAgo(log.createdOn, language)}
                        </span>
                      </div>
                      <div
                        dangerouslySetInnerHTML={{
                          __html: replaceLinks({
                            text: log.content,
                            pageUrl: FRONTEND_URL,
                          }),
                        }}
                      />
                    </div>
                  ) : (
                    <form
                      className={styles.editTaskLogForm}
                      id="editTaskLogForm"
                      onSubmit={onEditTaskLog}
                    >
                      <input
                        type="hidden"
                        {...registerEditTaskLog("id")}
                        value={editingTaskLog?.id}
                      />
                      <ConfirmButton
                        data-testid="edit-task-log-delete-button"
                        className={clsx(styles.deleteLogButton, "link")}
                        confirm={
                          <>
                            {isDeletingTaskLog ? (
                              <Loading width={18} height={18} color="#fff" />
                            ) : (
                              <>
                                <Trash2 width={14} height={14} />
                                {t("Are you sure?")}
                              </>
                            )}
                          </>
                        }
                        onConfirm={async () => {
                          trackEvent({ name: "task_log_delete" })
                          try {
                            setIsDeletingTaskLog(true)
                            await apiFetch(
                              `${API_URL}/taskLogs/${editingTaskLog.id}`,
                              {
                                method: "DELETE",
                                headers: {
                                  Authorization: `Bearer ${token}`,
                                  "Content-Type": "application/json",
                                },
                              },
                            )
                            setEditingTaskLog(null)

                            toast.success("Log deleted")

                            setTaskLogs((prevTaskLogs) => ({
                              ...prevTaskLogs,
                              taskLogs: prevTaskLogs.taskLogs?.filter(
                                (log) => log.id !== editingTaskLog.id,
                              ),
                            }))
                          } catch (error) {
                            toast.error("Error deleting log")
                            console.error("Error deleting log:", error)
                          } finally {
                            setIsDeletingTaskLog(false)
                          }
                        }}
                      >
                        <Trash2 width={14} height={14} /> {t("Delete")}
                      </ConfirmButton>

                      <textarea
                        data-testid="edit-task-log-textarea"
                        className={styles.editTaskLogFormTextarea}
                        {...registerEditTaskLog("content")}
                        placeholder="Log your thoughts..."
                      />
                      {editTaskLogErrors.content && (
                        <div
                          data-testid="edit-task-log-error"
                          className={styles.fieldError}
                        >
                          {editTaskLogErrors.content.message}
                        </div>
                      )}
                      <div className={styles.editTaskLogFormActions}>
                        <div className={styles.moodContainer}>
                          {!watchEditTaskLog("mood") ? (
                            <div className={styles.emojiContainer}>
                              <MoodSelector
                                mood={watchEditTaskLog("mood")}
                                onMoodChange={(mood) =>
                                  setValueEditTaskLog("mood", mood)
                                }
                                className={styles.moodSelector}
                              />
                            </div>
                          ) : (
                            <>
                              <button
                                data-testid="edit-task-log-edit-emoji-button"
                                type="button"
                                className={clsx("link", styles.editEmoji)}
                                onClick={() => {
                                  setValueEditTaskLog("mood", undefined)
                                }}
                              >
                                {emojiMap[watchEditTaskLog("mood") as Mood]}
                              </button>{" "}
                              <button
                                data-testid="edit-task-log-edit-button"
                                type="button"
                                className={clsx(
                                  "link",
                                  styles.editButton,
                                  styles.single,
                                )}
                                onClick={() => {
                                  setValueEditTaskLog("mood", undefined)
                                }}
                              >
                                {t("Edit")}
                              </button>
                            </>
                          )}
                        </div>
                        <button
                          data-testid="edit-task-log-cancel-button"
                          type="button"
                          className={clsx("transparent", styles.cancelButton)}
                          onClick={() => setEditingTaskLog(null)}
                        >
                          {t("Cancel")}
                        </button>
                        <button
                          data-testid="edit-task-log-submit-button"
                          disabled={isSubmittingEditLog}
                          className={clsx("inverted", styles.submitButton)}
                          type="submit"
                        >
                          {isSubmittingEditLog ? (
                            <Loading width={18} height={18} />
                          ) : (
                            t("Update")
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>
            {taskLogs.nextPage && (
              <div className={styles.loadMoreContainer}>
                <button
                  className={clsx(styles.submitButton)}
                  type="button"
                  onClick={() => {
                    setUntil((prevUntil) => prevUntil + 1)
                  }}
                >
                  {isLoadingTaskLogs ? (
                    <Loading width={16} height={16} color="#fff" />
                  ) : (
                    <>
                      <LoaderCircle width={16} height={16} color="#fff" />
                      {t("Load more")}
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default EditTask
