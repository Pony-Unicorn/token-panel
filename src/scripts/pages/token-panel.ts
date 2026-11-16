import dayjs from 'dayjs'
import { api } from '../lib/api'

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

const getCgBase = (direct: boolean) =>
  direct ? 'https://api.coingecko.com/api/v3' : `${API_BASE_URL}/api/v3`

export const groupApi = {
  getAll(): Promise<IGroup[]> {
    return api.get(groupsUrl).json<IGroup[]>()
  },
  update(groups: IGroup[]): Promise<unknown> {
    return api.put(groupsUrl, { json: groups })
  }
}

export const coingeckoApi = {
  async search(query: string, direct: boolean): Promise<ISearchCoin[]> {
    const data = await api
      .get(`${getCgBase(direct)}/search?query=${encodeURIComponent(query)}`)
      .json<{ coins: ISearchCoin[] }>()
    return (data.coins || []).slice(0, 8)
  },
  getMarkets(ids: string[], direct: boolean): Promise<ICoinMarket[]> {
    if (!ids.length) return Promise.resolve([])
    return api
      .get(
        `${getCgBase(direct)}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&price_change_percentage=24h`
      )
      .json<ICoinMarket[]>()
  }
}

let _futureTradingSymbols: Set<string> | null = null

export const binanceApi = {
  async loadTradingSymbols(): Promise<void> {
    const data = await api
      .get('https://fapi.binance.com/fapi/v1/exchangeInfo')
      .json<{ symbols: Array<{ status: string; symbol: string }> }>()
    _futureTradingSymbols = new Set(
      data.symbols
        .filter((s) => s.status === 'TRADING' && s.symbol.endsWith('USDT'))
        .map((s) => s.symbol)
    )
  },
  async loadTradingSymbolsWithRetry(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      try {
        await this.loadTradingSymbols()
        return
      } catch {
        if (i < 2) await new Promise((r) => setTimeout(r, 3000))
      }
    }
    throw new Error('合约列表加载失败')
  },
  async getFutures24hTicker(): Promise<{ gainers: IFuturesItem[]; losers: IFuturesItem[] }> {
    const data = await api
      .get('https://fapi.binance.com/fapi/v1/ticker/24hr')
      .json<Array<{ symbol: string; priceChangePercent: string; lastPrice: string }>>()
    const usdt = data
      .filter((t) =>
        _futureTradingSymbols ? _futureTradingSymbols.has(t.symbol) : t.symbol.endsWith('USDT')
      )
      .map((t) => ({
        symbol: t.symbol,
        change: parseFloat(t.priceChangePercent),
        price: parseFloat(t.lastPrice)
      }))
    usdt.sort((a, b) => b.change - a.change)
    return {
      gainers: usdt.slice(0, 10),
      losers: usdt.slice(-10).reverse()
    }
  }
}

const showToast = (
  msg: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'success'
): void => {
  const toasts = (
    window as unknown as {
      Alpine?: { store: (name: string) => Record<string, (m: string) => void> }
    }
  ).Alpine?.store('toasts')
  if (toasts && typeof toasts[type] === 'function') {
    toasts[type](msg)
  }
}

export function tokenPanel() {
  return {
    groups: [] as IGroup[],
    prices: {} as Record<string, ICoinMarket>,
    priceFlash: {} as Record<string, 'up' | 'down'>,
    lastUpdated: null as Date | null,
    isEditMode: false,
    useDirectApi:
      typeof window !== 'undefined' ? localStorage.getItem('cgDirectApi') === 'true' : false,
    isLoading: false,
    loadError: '',
    priceError: '',
    isSaving: false,

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
      if (typeof window !== 'undefined') {
        this.useDirectApi = localStorage.getItem('cgDirectApi') === 'true'
      }
      await Promise.all([
        this.loadData(),
        binanceApi.loadTradingSymbolsWithRetry().catch((e: Error) => {
          this.futuresError = e?.message || '合约列表加载失败'
        })
      ])
      await this.refreshFutures()

      this._priceInterval = setInterval(() => this.refreshPrices(), 30 * 1000)
      this._futuresInterval = setInterval(() => this.refreshFutures(), 5 * 60 * 1000)
    },

    destroy() {
      if (this._priceInterval) clearInterval(this._priceInterval)
      if (this._futuresInterval) clearInterval(this._futuresInterval)
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
          const data = await coingeckoApi.getMarkets(ids, this.useDirectApi)
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
        const data = await coingeckoApi.getMarkets(ids, this.useDirectApi)
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
        const { gainers, losers } = await binanceApi.getFutures24hTicker()
        this.futuresGainers = gainers
        this.futuresLosers = losers
        this.futuresUpdatedAt = new Date()
      } catch (e: any) {
        this.futuresError = e?.message || '合约数据加载失败'
      } finally {
        this.futuresLoading = false
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
        showToast('保存失败，请重试', 'error')
      } finally {
        this.isSaving = false
      }
      return success
    },

    // --- Mode ---
    toggleEditMode() {
      this.isEditMode = !this.isEditMode
    },

    toggleApiMode() {
      this.useDirectApi = !this.useDirectApi
      if (typeof window !== 'undefined') {
        localStorage.setItem('cgDirectApi', String(this.useDirectApi))
      }
      this.refreshPrices()
    },

    // --- Group actions ---
    openNewGroup() {
      this.groupModal = { isEdit: false, id: null, name: '' }
      const modal = (this as any).$refs?.groupModal as HTMLDialogElement | undefined
      modal?.showModal()
    },

    openEditGroup(group: IGroup) {
      this.groupModal = { isEdit: true, id: group.id, name: group.name }
      const modal = (this as any).$refs?.groupModal as HTMLDialogElement | undefined
      modal?.showModal()
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
        const modal = (this as any).$refs?.groupModal as HTMLDialogElement | undefined
        modal?.close()
      }
    },

    openDeleteGroup(id: string) {
      this.confirmDeleteModal = { groupId: id }
      const modal = (this as any).$refs?.confirmModal as HTMLDialogElement | undefined
      modal?.showModal()
    },

    async confirmDelete() {
      if (!this.confirmDeleteModal.groupId) return
      const targetId = this.confirmDeleteModal.groupId
      const newGroups = this.groups.filter((g) => g.id !== targetId)
      const modal = (this as any).$refs?.confirmModal as HTMLDialogElement | undefined
      modal?.close()
      if (await this.saveGroups(newGroups)) {
        this.groups = newGroups
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
      const modal = (this as any).$refs?.coinModal as HTMLDialogElement | undefined
      modal?.showModal()
    },

    async searchCoins() {
      const q = this.coinModal.query.trim()
      if (!q) return
      this.coinModal.isSearching = true
      this.coinModal.searchError = ''
      this.coinModal.results = []
      try {
        this.coinModal.results = await coingeckoApi.search(q, this.useDirectApi)
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
        showToast('该代币已在看板中', 'warning')
        return
      }
      g.coins.push(coinId)
      const modal = (this as any).$refs?.coinModal as HTMLDialogElement | undefined
      modal?.close()
      await this.saveGroups()
      await this.refreshPrices()
    },

    async removeCoin(groupId: string, symbol: string) {
      const g = this.groups.find((group) => group.id === groupId)
      if (!g) return
      g.coins = g.coins.filter((c) => c !== symbol)
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
        return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 })
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

    formatMarketCap(cap: number | undefined | null): string {
      if (!cap) return '—'
      if (cap >= 1e12) return (cap / 1e12).toFixed(2) + 'T'
      if (cap >= 1e9) return (cap / 1e9).toFixed(2) + 'B'
      if (cap >= 1e6) return (cap / 1e6).toFixed(2) + 'M'
      return cap.toLocaleString('en-US')
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
