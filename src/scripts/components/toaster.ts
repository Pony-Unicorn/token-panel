export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface IToast {
  id: number
  type: ToastType
  message: string
  shown: boolean
  timeoutId?: ReturnType<typeof setTimeout>
}

let toastId = 0
const ANIMATION_DURATION = 200 // 淡出动画持续时间 (ms)

const defaultDurations: Record<ToastType, number> = {
  success: 2500,
  info: 3000,
  warning: 4000,
  error: 5000
}

const toastManager = {
  queue: [] as IToast[],
  maxToasts: 3,

  get count() {
    return this.queue.length
  },

  show(message: string, type: ToastType, duration: number): number | undefined {
    if (!message?.trim()) return

    const id = toastId++

    const toast: IToast = {
      id,
      type,
      message,
      shown: true,
      timeoutId: undefined
    }

    if (duration > 0) {
      toast.timeoutId = setTimeout(() => {
        this.clear(id)
      }, duration)
    }

    this.queue.unshift(toast)

    // 控制最大数量，超出部分清理定时器并移除
    while (this.queue.length > this.maxToasts) {
      const oldest = this.queue.pop()
      if (oldest?.timeoutId) {
        clearTimeout(oldest.timeoutId)
      }
    }

    return id
  },

  success(msg: string, duration: number = defaultDurations.success) {
    return this.show(msg, 'success', duration)
  },
  error(msg: string, duration: number = defaultDurations.error) {
    return this.show(msg, 'error', duration)
  },
  warning(msg: string, duration: number = defaultDurations.warning) {
    return this.show(msg, 'warning', duration)
  },
  info(msg: string, duration: number = defaultDurations.info) {
    return this.show(msg, 'info', duration)
  },

  clear(id: number) {
    const toast = this.queue.find((t) => t.id === id)
    if (!toast) return

    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId)
      toast.timeoutId = undefined
    }

    // 触发淡出动画
    toast.shown = false

    // 等待动画结束后彻底从队列移除
    setTimeout(() => {
      const idx = this.queue.findIndex((t) => t.id === id)
      if (idx > -1) {
        this.queue.splice(idx, 1)
      }
    }, ANIMATION_DURATION)
  },

  clearAll() {
    this.queue.forEach((toast) => {
      if (toast.timeoutId) {
        clearTimeout(toast.timeoutId)
      }
    })
    this.queue = []
  }
}

export default toastManager
