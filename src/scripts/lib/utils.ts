import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

// 自动装载通用插件
dayjs.extend(utc)

/**
 * 常用工具函数集合
 */
export const utils = {
  /**
   * Day.js 实例引用（已挂载 UTC 等插件）
   */
  dayjs,

  /**
   * 异步延时等待
   * @param ms 毫秒数
   */
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  },

  /**
   * 安全复制文本到剪贴板
   * @param text 复制目标文本
   */
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
      return false
    } catch {
      return false
    }
  }
}

export { dayjs }
export default utils
