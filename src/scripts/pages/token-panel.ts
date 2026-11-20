import dayjs from 'dayjs'
import { api } from '../lib/api'
import toasts from '../components/toaster'
import utils from '../lib/utils'

export interface IGroup {
  id: string
  name: string
  coins: string[]
}

export interface ICoinMarket {
  id: string
  symbol: string
  name: string
  image?: string
  current_price: number
  market_cap_rank?: number | null
  ath?: number | null
  high_24h?: number | null
  low_24h?: number | null
  price_change_percentage_24h?: number | null
  last_updated?: string
  market_cap?: number | null
}

export interface ISearchCoin {
  id: string
  name: string
  symbol: string
  thumb: string
  market_cap_rank?: number | null
}

export interface IFuturesItem {
  symbol: string
  change: number
  price: number
}

const API_BASE_URL = 'https://tpp.testbug.cc'
const groupsUrl = `${API_BASE_URL}/api/groups`
const cgBaseUrl = 'https://api.coingecko.com/api/v3'
const binanceBaseUrl = 'https://fapi.binance.com/fapi/v1'

export const groupApi = {
  getAll(): Promise<IGroup[]> {
    return api.get(groupsUrl).json<IGroup[]>()
  },
  update(groups: IGroup[]): Promise<unknown> {
    return api.put(groupsUrl, { json: groups })
  }
}

export const coingeckoApi = {
  async search(query: string): Promise<ISearchCoin[]> {
    const data = await api
      .get(`${cgBaseUrl}/search?query=${encodeURIComponent(query)}`)
      .json<{ coins: ISearchCoin[] }>()
    return (data.coins || []).slice(0, 8)
  },
  getMarkets(ids: string[]): Promise<ICoinMarket[]> {
    if (!ids.length) return Promise.resolve([])
    return api
      .get(
        `${cgBaseUrl}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&price_change_percentage=24h`
      )
      .json<ICoinMarket[]>()
  }
}

export const binanceApi = {
  async getFuturesSummary(): Promise<{
    gainers: IFuturesItem[]
    losers: IFuturesItem[]
    updatedAt?: number
  }> {
    const data = await api.get(`${binanceBaseUrl}/ticker/24hr`).json<
      Array<{
        symbol: string
        priceChangePercent: string
        lastPrice: string
        quoteVolume?: string
      }>
    >()

    const usdt = data
      .filter((t) => t.symbol && t.symbol.endsWith('USDT'))
      .map((t) => ({
        symbol: t.symbol,
        change: parseFloat(t.priceChangePercent),
        price: parseFloat(t.lastPrice),
        quoteVolume: parseFloat(t.quoteVolume || '0')
      }))
      .filter(
        (t) =>
          !isNaN(t.change) &&
          !isNaN(t.price) &&
          t.price > 0 &&
          (isNaN(t.quoteVolume) || t.quoteVolume > 10000)
      )

    usdt.sort((a, b) => b.change - a.change)

    return {
      gainers: usdt.slice(0, 10).map(({ symbol, change, price }) => ({ symbol, change, price })),
      losers: usdt
        .slice(-10)
        .reverse()
        .map(({ symbol, change, price }) => ({ symbol, change, price })),
      updatedAt: Date.now()
    }
  }
}

export function tokenPanel() {
  return {
    groups: [] as IGroup[],
    prices: {} as Record<string, ICoinMarket>,
    priceFlash: {} as Record<string, 'up' | 'down'>,
    lastUpdated: null as Date | null,
    isEditMode: false,
    isLoading: false,
    loadError: '',
    priceError: '',
    isSaving: false,
    isRefreshing: false,

    groupModal: { isEdit: false, id: null as string | null, name: '' },
    coinModal: {
      groupId: null as string | null,
      query: '',
      results: [] as ISearchCoin[],
      isSearching: false,
      searchError: ''
    },
    confirmDeleteModal: { groupId: null as string | null },
    futuresGainers: [] as IFuturesItem[],
    futuresLosers: [] as IFuturesItem[],
    futuresLoading: false,
    futuresError: '',
    futuresUpdatedAt: null as Date | null,

    _priceInterval: null as ReturnType<typeof setInterval> | null,
    _futuresInterval: null as ReturnType<typeof setInterval> | null,

    async init() {
      await Promise.all([this.loadData(), this.refreshFutures()])
      this.startIntervals()
      ;(this as any).$cleanup?.(() => this.destroy())
    },

    startIntervals() {
      this.stopIntervals()
      this._priceInterval = setInterval(() => this.refreshPrices(), 30 * 1000)
      this._futuresInterval = setInterval(() => this.refreshFutures(), 5 * 60 * 1000)
    },

    stopIntervals() {
      if (this._priceInterval) {
        clearInterval(this._priceInterval)
        this._priceInterval = null
      }
      if (this._futuresInterval) {
        clearInterval(this._futuresInterval)
        this._futuresInterval = null
      }
    },

    destroy() {
      this.stopIntervals()
    },

    async loadData() {
      this.isLoading = true
      this.loadError = ''
      try {
        this.groups = await groupApi.getAll()
      } catch (e: any) {
        this.loadError = e?.message || '加载失败，请稍后重试'
        this.isLoading = false
        return
      }

      try {
        const ids = [...new Set(this.groups.flatMap((g) => g.coins))]
        if (ids.length) {
          const data = await coingeckoApi.getMarkets(ids)
          this.prices = Object.fromEntries(data.map((c) => [c.id, c]))
          this.lastUpdated = data[0]?.last_updated ? new Date(data[0].last_updated) : new Date()
        }
        this.priceError = ''
      } catch (e: any) {
        this.priceError = e?.message || '价格加载失败'
      } finally {
        this.isLoading = false
      }
    },

    async refreshPrices() {
      const ids = [...new Set(this.groups.flatMap((g) => g.coins))]
      if (!ids.length) return
      try {
        const oldPrices = this.prices
        const data = await coingeckoApi.getMarkets(ids)
        const newPrices = Object.fromEntries(data.map((c) => [c.id, c]))

        const flashes: Record<string, 'up' | 'down'> = {}
        for (const id of Object.keys(newPrices)) {
          const oldRate = oldPrices[id]?.current_price
          const newRate = newPrices[id]?.current_price
          if (oldRate != null && newRate != null && oldRate !== newRate) {
            flashes[id] = newRate > oldRate ? 'up' : 'down'
          }
        }

        this.prices = newPrices
        this.lastUpdated = data[0]?.last_updated ? new Date(data[0].last_updated) : new Date()
        this.priceError = ''

        if (Object.keys(flashes).length > 0) {
          this.priceFlash = flashes
          setTimeout(() => {
            this.priceFlash = {}
          }, 2000)
        }
      } catch (e: any) {
        this.priceError = e?.message || '价格更新失败'
      }
    },

    async refreshFutures() {
      this.futuresLoading = true
      this.futuresError = ''
      try {
        const { gainers, losers, updatedAt } = await binanceApi.getFuturesSummary()
        this.futuresGainers = gainers
        this.futuresLosers = losers
        this.futuresUpdatedAt = updatedAt ? new Date(updatedAt) : new Date()
      } catch (e: any) {
        this.futuresError = e?.message || '合约数据加载失败'
      } finally {
        this.futuresLoading = false
      }
    },

    async refreshAll() {
      if (this.isRefreshing) return
      this.isRefreshing = true
      try {
        await Promise.all([this.refreshPrices(), this.refreshFutures(), utils.sleep(400)])
        this.startIntervals()
      } finally {
        this.isRefreshing = false
      }
    },

    async saveGroups(groups?: IGroup[]): Promise<boolean> {
      const targetGroups = groups ?? this.groups
      this.isSaving = true
      let success = false
      try {
        await groupApi.update(targetGroups)
        success = true
      } catch {
        toasts.error('保存失败，请重试')
      } finally {
        this.isSaving = false
      }
      return success
    },

    // --- Mode ---
    toggleEditMode() {
      this.isEditMode = !this.isEditMode
    },

    // --- Modal helpers ---
    openModal(name: 'groupModal' | 'coinModal' | 'confirmModal') {
      const modal = (this as any).$refs?.[name] as HTMLDialogElement | undefined
      modal?.showModal()
    },

    closeModal(name: 'groupModal' | 'coinModal' | 'confirmModal') {
      const modal = (this as any).$refs?.[name] as HTMLDialogElement | undefined
      modal?.close()
    },

    // --- Group actions ---
    openNewGroup() {
      this.groupModal = { isEdit: false, id: null, name: '' }
      this.openModal('groupModal')
    },

    openEditGroup(group: IGroup) {
      this.groupModal = { isEdit: true, id: group.id, name: group.name }
      this.openModal('groupModal')
    },

    async confirmGroup() {
      const name = this.groupModal.name.trim()
      if (!name) return
      let newGroups: IGroup[]
      if (this.groupModal.isEdit) {
        newGroups = this.groups.map((g) => (g.id === this.groupModal.id ? { ...g, name } : g))
      } else {
        newGroups = [...this.groups, { id: crypto.randomUUID(), name, coins: [] }]
      }
      if (await this.saveGroups(newGroups)) {
        this.groups = newGroups
        this.closeModal('groupModal')
      }
    },

    openDeleteGroup(id: string) {
      this.confirmDeleteModal = { groupId: id }
      this.openModal('confirmModal')
    },

    async confirmDelete() {
      if (!this.confirmDeleteModal.groupId) return
      const targetId = this.confirmDeleteModal.groupId
      const newGroups = this.groups.filter((g) => g.id !== targetId)
      if (await this.saveGroups(newGroups)) {
        this.groups = newGroups
        this.closeModal('confirmModal')
      }
    },

    // --- Coin actions ---
    openAddCoin(groupId: string) {
      this.coinModal = {
        groupId,
        query: '',
        results: [],
        isSearching: false,
        searchError: ''
      }
      this.openModal('coinModal')
    },

    async searchCoins() {
      const q = this.coinModal.query.trim()
      if (!q || this.coinModal.isSearching) return
      this.coinModal.isSearching = true
      this.coinModal.searchError = ''
      this.coinModal.results = []
      try {
        this.coinModal.results = await coingeckoApi.search(q)
      } catch (e: any) {
        this.coinModal.searchError = e?.message || '搜索失败'
      } finally {
        this.coinModal.isSearching = false
      }
    },

    async selectCoin(coinId: string) {
      const g = this.groups.find((group) => group.id === this.coinModal.groupId)
      if (!g) return
      if (g.coins.includes(coinId)) {
        toasts.warning('该代币已在看板中')
        return
      }
      g.coins.push(coinId)
      this.closeModal('coinModal')
      await this.saveGroups()
      await this.refreshPrices()
    },

    async removeCoin(groupId: string, coinId: string) {
      const g = this.groups.find((group) => group.id === groupId)
      if (!g) return
      g.coins = g.coins.filter((c) => c !== coinId)
      await this.saveGroups()
    },

    // --- Helpers ---
    sortedCoins(coins: string[]): string[] {
      return [...coins].sort((a, b) => {
        const ra = this.prices[a]?.market_cap_rank ?? Infinity
        const rb = this.prices[b]?.market_cap_rank ?? Infinity
        return ra - rb
      })
    },

    // --- Formatting ---
    formatPrice(price: number | undefined | null): string {
      if (price == null) return '—'
      if (price >= 1) {
        return (
          '$' +
          price.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
        )
      }
      return '$' + price.toPrecision(4)
    },

    formatDelta(pct: number | undefined | null): string {
      if (pct == null) return '—'
      return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%'
    },

    deltaClass(pct: number | undefined | null): string {
      if (pct == null) return 'text-base-content/40'
      return pct >= 0 ? 'text-success' : 'text-error'
    },

    formatAthDd(p: ICoinMarket | undefined): string {
      if (!p?.current_price || !p?.ath) return '—'
      const dd = (p.current_price / p.ath - 1) * 100
      return dd.toFixed(1) + '%'
    },

    athDdClass(p: ICoinMarket | undefined): string {
      if (!p?.current_price || !p?.ath) return 'text-base-content/40'
      return p.current_price >= p.ath ? 'text-success' : 'text-error/70'
    },

    formatTime(date: Date | string | null): string {
      if (!date) return ''
      return dayjs(date).format('HH:mm:ss')
    },

    get lastUpdatedText(): string {
      if (!this.lastUpdated) return ''
      return '更新于 ' + dayjs(this.lastUpdated).format('HH:mm:ss')
    }
  }
}

export default tokenPanel
