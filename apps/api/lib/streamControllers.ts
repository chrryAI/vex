export interface StreamController {
  close: () => void
  desiredSize: number | null
  enqueue: (chunk: any) => void
  error: (e?: any) => void
}

export const streamControllers = new Map<string, StreamController>()
