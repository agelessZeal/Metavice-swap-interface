/* eslint-disable no-param-reassign */
import { useEffect, useState } from 'react'
import { request, gql } from 'graphql-request'
// import { INFO_CLIENT } from 'config/constants/endpoints'
// import { getDeltaTimestamps } from 'views/Info/utils/infoQueryHelpers'
// import { useBlocksFromTimestamps } from 'views/Info/hooks/useBlocksFromTimestamps'
// import { PoolData } from 'state/info/types'
// import { getChangeForPeriod, getLpFeesAndApr, getPercentChange } from 'views/Info/utils/infoDataHelpers'

import { getUnixTime, subDays, subWeeks, startOfMinute } from 'date-fns'

export const MINIMUM_SEARCH_CHARACTERS = 2

export const WEEKS_IN_YEAR = 52.1429

export const TOTAL_FEE = 0.0025
export const LP_HOLDERS_FEE = 0.0017
export const TREASURY_FEE = 0.0003
export const BUYBACK_FEE = 0.0005

export const PCS_V2_START = 1619136000 // April 23, 2021, 12:00:00 AM
export const ONE_DAY_UNIX = 86400 // 24h * 60m * 60s
export const ONE_HOUR_SECONDS = 3600

export const ITEMS_PER_INFO_TABLE_PAGE = 10

/**
 * Get increase/decrease of value compared to the previous value (e.g. 24h volume compared to 24h volume the day before )
 * @param valueNow - more recent value
 * @param valueBefore - value to compare with
 */
export const getAmountChange = (valueNow?: number, valueBefore?: number) => {
  if (valueNow && valueBefore) {
    return valueNow - valueBefore
  }
  if (valueNow) {
    return valueNow
  }
  return 0
}

/**
 * Get increase/decrease of value compared to the previous value as a percentage
 * @param valueNow - more recent value
 * @param valueBefore - value to compare with
 */
export const getPercentChange = (valueNow?: number, valueBefore?: number): number => {
  if (valueNow && valueBefore) {
    return ((valueNow - valueBefore) / valueBefore) * 100
  }
  return 0
}

/**
 * Given current value and value 1 and 2 periods (e.g. 1day + 2days, 1week - 2weeks) returns the amount change for latest period
 * and percentage change compared to the previous period.
 * @param valueNow - current value
 * @param valueOnePeriodAgo - value 1 period ago (e.g. 1 day or 1 week ago), period unit must be same as valueTwoPeriodsAgo
 * @param valueTwoPeriodsAgo - value 2 periods ago (e.g. 2 days or 2 weeks ago), period unit must be same as valueOnePeriodAgo
 * @returns amount change for the latest period and percetage change compared to previous period
 */
export const getChangeForPeriod = (
  valueNow?: number,
  valueOnePeriodAgo?: number,
  valueTwoPeriodsAgo?: number
): [number, number] => {
  const currentPeriodAmount = getAmountChange(valueNow, valueOnePeriodAgo)
  const previousPeriodAmount = getAmountChange(valueOnePeriodAgo, valueTwoPeriodsAgo)
  const percentageChange = getPercentChange(currentPeriodAmount, previousPeriodAmount)
  return [currentPeriodAmount, percentageChange]
}

export const getLpFeesAndApr = (volumeUSD: number, volumeUSDWeek: number, liquidityUSD: number) => {
  const totalFees24h = volumeUSD * TOTAL_FEE
  const totalFees7d = volumeUSDWeek * TOTAL_FEE
  const lpFees24h = volumeUSD * LP_HOLDERS_FEE
  const lpFees7d = volumeUSDWeek * LP_HOLDERS_FEE

  const lpApr7d = liquidityUSD > 0 ? (volumeUSDWeek * LP_HOLDERS_FEE * WEEKS_IN_YEAR * 100) / liquidityUSD : 0
  return {
    totalFees24h,
    totalFees7d,
    lpFees24h,
    lpFees7d,
    lpApr7d: lpApr7d !== Infinity ? lpApr7d : 0,
  }
}

export const BLOCKS_CLIENT = 'https://api.thegraph.com/subgraphs/name/pancakeswap/blocks'

export interface Block {
  number: number
  timestamp: string
}

export const getDeltaTimestamps = (): [number, number, number, number] => {
  const utcCurrentTime = getUnixTime(new Date()) * 1000
  const t24h = getUnixTime(startOfMinute(subDays(utcCurrentTime, 1)))
  const t48h = getUnixTime(startOfMinute(subDays(utcCurrentTime, 2)))
  const t7d = getUnixTime(startOfMinute(subWeeks(utcCurrentTime, 1)))
  const t14d = getUnixTime(startOfMinute(subWeeks(utcCurrentTime, 2)))
  return [t24h, t48h, t7d, t14d]
}

/**
 * Helper function to get large amount GrqphQL subqueries
 * @param queryConstructor constructor function that combines subqueries
 * @param subqueries individual queries
 * @param endpoint GraphQL endpoint
 * @param skipCount how many subqueries to fire at a time
 * @returns
 */
export const multiQuery = async (
  queryConstructor: (subqueries: string[]) => string,
  subqueries: string[],
  endpoint: string,
  skipCount = 1000
) => {
  let fetchedData = {}
  let allFound = false
  let skip = 0
  try {
    while (!allFound) {
      let end = subqueries.length
      if (skip + skipCount < subqueries.length) {
        end = skip + skipCount
      }
      const subqueriesSlice = subqueries.slice(skip, end)
      // eslint-disable-next-line no-await-in-loop
      const result = await request(endpoint, queryConstructor(subqueriesSlice))
      fetchedData = {
        ...fetchedData,
        ...result,
      }
      allFound = Object.keys(result).length < skipCount || skip + skipCount > subqueries.length
      skip += skipCount
    }
    return fetchedData
  } catch (error) {
    console.error('Failed to fetch info data', error)
    return null
  }
}

const getBlockSubqueries = (timestamps: number[]) =>
  timestamps.map((timestamp) => {
    return `t${timestamp}:blocks(first: 1, orderBy: timestamp, orderDirection: desc, where: { timestamp_gt: ${timestamp}, timestamp_lt: ${
      timestamp + 600
    } }) {
      number
    }`
  })

const blocksQueryConstructor = (subqueries: string[]) => {
  return gql`query blocks {
    ${subqueries}
  }`
}

export const getBlocksFromTimestamps = async (
  timestamps: number[],
  sortDirection: 'asc' | 'desc' = 'desc',
  skipCount = 500
): Promise<Block[]> => {
  if (timestamps?.length === 0) {
    return []
  }

  const fetchedData: any = await multiQuery(
    blocksQueryConstructor,
    getBlockSubqueries(timestamps),
    BLOCKS_CLIENT,
    skipCount
  )

  const sortingFunction =
    sortDirection === 'desc' ? (a: Block, b: Block) => b.number - a.number : (a: Block, b: Block) => a.number - b.number

  const blocks: Block[] = []
  if (fetchedData) {
    // eslint-disable-next-line no-restricted-syntax
    for (const key of Object.keys(fetchedData)) {
      if (fetchedData[key].length > 0) {
        blocks.push({
          timestamp: key.split('t')[1],
          number: parseInt(fetchedData[key][0].number, 10),
        })
      }
    }
    // graphql-request does not guarantee same ordering of batched requests subqueries, hence manual sorting
    blocks.sort(sortingFunction)
  }
  return blocks
}

export const useBlocksFromTimestamps = (
  timestamps: number[],
  sortDirection: 'asc' | 'desc' = 'desc',
  skipCount = 1000
): {
  blocks?: Block[]
  error: boolean
} => {
  const [blocks, setBlocks] = useState<Block[]>()
  const [error, setError] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const result = await getBlocksFromTimestamps(timestamps, sortDirection, skipCount)
      if (result.length === 0) {
        setError(true)
      } else {
        setBlocks(result)
      }
    }
    if (!blocks && !error) {
      fetchData()
    }
  }) // TODO: dep array?

  return {
    blocks,
    error,
  }
}

export const INFO_CLIENT = 'https://bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2'

const getPriceSubqueries = (tokenAddress: string, blocks: any) =>
  blocks.map(
    (block: any) => `
      t${block.timestamp}:token(id:"${tokenAddress}", block: { number: ${block.number} }) { 
        derivedBNB
      }
      b${block.timestamp}: bundle(id:"1", block: { number: ${block.number} }) { 
        bnbPrice
      }
    `
  )

/**
 * Price data for token and bnb based on block number
 */
const priceQueryConstructor = (subqueries: string[]) => {
  return gql`
    query tokenPriceData {
      ${subqueries}
    }
  `
}
export interface PriceChartEntry {
  time: number
  open: number
  close: number
  high: number
  low: number
}

const fetchTokenPriceData = async (
  address: string,
  interval: number,
  startTimestamp: number
): Promise<{
  data?: PriceChartEntry[]
  error: boolean
}> => {
  // Construct timestamps to query against
  const endTimestamp = getUnixTime(new Date())
  const timestamps = []
  let time = startTimestamp
  while (time <= endTimestamp) {
    timestamps.push(time)
    time += interval
  }
  try {
    const blocks = await getBlocksFromTimestamps(timestamps, 'asc', 500)
    if (!blocks || blocks.length === 0) {
      console.error('Error fetching blocks for timestamps', timestamps)
      return {
        error: false,
      }
    }

    const prices: any | undefined = await multiQuery(
      priceQueryConstructor,
      getPriceSubqueries(address, blocks),
      INFO_CLIENT,
      200
    )

    if (!prices) {
      console.error('Price data failed to load')
      return {
        error: false,
      }
    }

    // format token BNB price results
    const tokenPrices: {
      timestamp: string
      derivedBNB: number
      priceUSD: number
    }[] = []

    // Get Token prices in BNB
    Object.keys(prices).forEach((priceKey) => {
      const timestamp = priceKey.split('t')[1]
      // if its BNB price e.g. `b123` split('t')[1] will be undefined and skip BNB price entry
      if (timestamp) {
        tokenPrices.push({
          timestamp,
          derivedBNB: prices[priceKey]?.derivedBNB ? parseFloat(prices[priceKey].derivedBNB) : 0,
          priceUSD: 0,
        })
      }
    })

    // Go through BNB USD prices and calculate Token price based on it
    Object.keys(prices).forEach((priceKey) => {
      const timestamp = priceKey.split('b')[1]
      // if its Token price e.g. `t123` split('b')[1] will be undefined and skip Token price entry
      if (timestamp) {
        const tokenPriceIndex = tokenPrices.findIndex((tokenPrice) => tokenPrice.timestamp === timestamp)
        if (tokenPriceIndex >= 0) {
          const { derivedBNB } = tokenPrices[tokenPriceIndex]
          tokenPrices[tokenPriceIndex].priceUSD = parseFloat(prices[priceKey]?.bnbPrice ?? 0) * derivedBNB
        }
      }
    })

    // graphql-request does not guarantee same ordering of batched requests subqueries, hence sorting by timestamp from oldest to newest
    tokenPrices.sort((a, b) => parseInt(a.timestamp, 10) - parseInt(b.timestamp, 10))

    const formattedHistory = []

    // for each timestamp, construct the open and close price
    for (let i = 0; i < tokenPrices.length - 1; i++) {
      formattedHistory.push({
        time: parseFloat(tokenPrices[i].timestamp),
        open: tokenPrices[i].priceUSD,
        close: tokenPrices[i + 1].priceUSD,
        high: tokenPrices[i + 1].priceUSD,
        low: tokenPrices[i].priceUSD,
      })
    }

    return { data: formattedHistory, error: false }
  } catch (error) {
    console.error(`Failed to fetch price data for token ${address}`, error)
    return {
      error: true,
    }
  }
}

export const useTokenPriceData = (address: string, interval: number): PriceChartEntry[] | undefined => {
  const [error, setError] = useState(false)

  const [priceData, setPriceData] = useState(null)

  // construct timestamps and check if we need to fetch more data
  const utcCurrentTime = getUnixTime(new Date()) * 1000

  useEffect(() => {
    const fetch = async () => {
      const { data, error: fetchingError } = await fetchTokenPriceData(address, interval, utcCurrentTime)
      if (data) {
        setPriceData(data)
      }
      if (fetchingError) {
        setError(true)
      }
    }
    if (!error) {
      fetch()
    }
  }, [address, error, interval])

  return priceData
}

export type TokenData = {
  exists: boolean

  name: string
  symbol: string
  address: string

  volumeUSD: number
  volumeUSDChange: number
  volumeUSDWeek: number
  txCount: number

  liquidityToken: number
  liquidityUSD: number
  liquidityUSDChange: number

  priceUSD: number
  priceUSDChange: number
  priceUSDChangeWeek: number
}
export interface BnbPrices {
  current: number
  oneDay: number
  twoDay: number
  week: number
}

const BNB_PRICES = gql`
  query prices($block24: Int!, $block48: Int!, $blockWeek: Int!) {
    current: bundle(id: "1") {
      bnbPrice
    }
    oneDay: bundle(id: "1", block: { number: $block24 }) {
      bnbPrice
    }
    twoDay: bundle(id: "1", block: { number: $block48 }) {
      bnbPrice
    }
    oneWeek: bundle(id: "1", block: { number: $blockWeek }) {
      bnbPrice
    }
  }
`

interface PricesResponse {
  current: {
    bnbPrice: string
  }
  oneDay: {
    bnbPrice: string
  }
  twoDay: {
    bnbPrice: string
  }
  oneWeek: {
    bnbPrice: string
  }
}

const fetchBnbPrices = async (
  block24: number,
  block48: number,
  blockWeek: number
): Promise<{ bnbPrices: BnbPrices | undefined; error: boolean }> => {
  try {
    const data = await request<PricesResponse>(INFO_CLIENT, BNB_PRICES, {
      block24,
      block48,
      blockWeek,
    })
    return {
      error: false,
      bnbPrices: {
        current: parseFloat(data.current?.bnbPrice ?? '0'),
        oneDay: parseFloat(data.oneDay?.bnbPrice ?? '0'),
        twoDay: parseFloat(data.twoDay?.bnbPrice ?? '0'),
        week: parseFloat(data.oneWeek?.bnbPrice ?? '0'),
      },
    }
  } catch (error) {
    console.error('Failed to fetch BNB prices', error)
    return {
      error: true,
      bnbPrices: undefined,
    }
  }
}

export const useBnbPrices = (): BnbPrices | undefined => {
  const [prices, setPrices] = useState<BnbPrices | undefined>()
  const [error, setError] = useState(false)

  const [t24, t48, tWeek] = getDeltaTimestamps()
  const { blocks, error: blockError } = useBlocksFromTimestamps([t24, t48, tWeek])

  useEffect(() => {
    const fetch = async () => {
      const [block24, block48, blockWeek] = blocks
      const { bnbPrices, error: fetchError } = await fetchBnbPrices(block24.number, block48.number, blockWeek.number)
      if (fetchError) {
        setError(true)
      } else {
        setPrices(bnbPrices)
      }
    }
    if (!prices && !error && blocks && !blockError) {
      fetch()
    }
  }, [error, prices, blocks, blockError])

  return prices
}

interface TokenFields {
  id: string
  symbol: string
  name: string
  derivedBNB: string // Price in BNB per token
  derivedUSD: string // Price in USD per token
  tradeVolumeUSD: string
  totalTransactions: string
  totalLiquidity: string
}

interface FormattedTokenFields
  extends Omit<TokenFields, 'derivedBNB' | 'derivedUSD' | 'tradeVolumeUSD' | 'totalTransactions' | 'totalLiquidity'> {
  derivedBNB: number
  derivedUSD: number
  tradeVolumeUSD: number
  totalTransactions: number
  totalLiquidity: number
}

interface TokenQueryResponse {
  now: TokenFields[]
  oneDayAgo: TokenFields[]
  twoDaysAgo: TokenFields[]
  oneWeekAgo: TokenFields[]
  twoWeeksAgo: TokenFields[]
}

/**
 * Main token data to display on Token page
 */
const TOKEN_AT_BLOCK = (block: number | undefined, tokens: string[]) => {
  const addressesString = `["${tokens.join('","')}"]`
  const blockString = block ? `block: {number: ${block}}` : ``
  return `tokens(
      where: {id_in: ${addressesString}}
      ${blockString}
      orderBy: tradeVolumeUSD
      orderDirection: desc
    ) {
      id
      symbol
      name
      derivedBNB
      derivedUSD
      tradeVolumeUSD
      totalTransactions
      totalLiquidity
    }
  `
}

const fetchTokenData = async (
  block24h: number,
  block48h: number,
  block7d: number,
  block14d: number,
  tokenAddresses: string[]
) => {
  try {
    const query = gql`
      query tokens {
        now: ${TOKEN_AT_BLOCK(null, tokenAddresses)}
        oneDayAgo: ${TOKEN_AT_BLOCK(block24h, tokenAddresses)}
        twoDaysAgo: ${TOKEN_AT_BLOCK(block48h, tokenAddresses)}
        oneWeekAgo: ${TOKEN_AT_BLOCK(block7d, tokenAddresses)}
        twoWeeksAgo: ${TOKEN_AT_BLOCK(block14d, tokenAddresses)}
      }
    `
    const data = await request<TokenQueryResponse>(INFO_CLIENT, query)
    return { data, error: false }
  } catch (error) {
    console.error('Failed to fetch token data', error)
    return { erro: true }
  }
}

// Transforms tokens into "0xADDRESS: { ...TokenFields }" format and cast strigns to numbers
const parseTokenData = (tokens?: TokenFields[]) => {
  if (!tokens) {
    return {}
  }
  return tokens.reduce((accum: { [address: string]: FormattedTokenFields }, tokenData) => {
    const { derivedBNB, derivedUSD, tradeVolumeUSD, totalTransactions, totalLiquidity } = tokenData
    accum[tokenData.id] = {
      ...tokenData,
      derivedBNB: parseFloat(derivedBNB),
      derivedUSD: parseFloat(derivedUSD),
      tradeVolumeUSD: parseFloat(tradeVolumeUSD),
      totalTransactions: parseFloat(totalTransactions),
      totalLiquidity: parseFloat(totalLiquidity),
    }
    return accum
  }, {})
}

interface TokenDatas {
  error: boolean
  data?: {
    [address: string]: TokenData
  }
}

/**
 * Fetch top addresses by volume
 */
const useFetchedTokenDatas = (tokenAddresses: string[]): TokenDatas => {
  const [fetchState, setFetchState] = useState<TokenDatas>({ error: false })
  const [t24h, t48h, t7d, t14d] = getDeltaTimestamps()
  const { blocks, error: blockError } = useBlocksFromTimestamps([t24h, t48h, t7d, t14d])
  const [block24h, block48h, block7d, block14d] = blocks ?? []
  const bnbPrices = useBnbPrices()

  useEffect(() => {
    const fetch = async () => {
      const { error, data } = await fetchTokenData(
        block24h.number,
        block48h.number,
        block7d.number,
        block14d.number,
        tokenAddresses
      )
      if (error) {
        setFetchState({ error: true })
      } else {
        const parsed = parseTokenData(data?.now)
        const parsed24 = parseTokenData(data?.oneDayAgo)
        const parsed48 = parseTokenData(data?.twoDaysAgo)
        const parsed7d = parseTokenData(data?.oneWeekAgo)
        const parsed14d = parseTokenData(data?.twoWeeksAgo)

        // Calculate data and format
        const formatted = tokenAddresses.reduce((accum: { [address: string]: TokenData }, address) => {
          const current: FormattedTokenFields | undefined = parsed[address]
          const oneDay: FormattedTokenFields | undefined = parsed24[address]
          const twoDays: FormattedTokenFields | undefined = parsed48[address]
          const week: FormattedTokenFields | undefined = parsed7d[address]
          const twoWeeks: FormattedTokenFields | undefined = parsed14d[address]

          const [volumeUSD, volumeUSDChange] = getChangeForPeriod(
            current?.tradeVolumeUSD,
            oneDay?.tradeVolumeUSD,
            twoDays?.tradeVolumeUSD
          )
          const [volumeUSDWeek] = getChangeForPeriod(
            current?.tradeVolumeUSD,
            week?.tradeVolumeUSD,
            twoWeeks?.tradeVolumeUSD
          )
          const liquidityUSD = current ? current.totalLiquidity * current.derivedUSD : 0
          const liquidityUSDOneDayAgo = oneDay ? oneDay.totalLiquidity * oneDay.derivedUSD : 0
          const liquidityUSDChange = getPercentChange(liquidityUSD, liquidityUSDOneDayAgo)
          const liquidityToken = current ? current.totalLiquidity : 0
          // Prices of tokens for now, 24h ago and 7d ago
          const priceUSD = current ? current.derivedBNB * bnbPrices.current : 0
          const priceUSDOneDay = oneDay ? oneDay.derivedBNB * bnbPrices.oneDay : 0
          const priceUSDWeek = week ? week.derivedBNB * bnbPrices.week : 0
          const priceUSDChange = getPercentChange(priceUSD, priceUSDOneDay)
          const priceUSDChangeWeek = getPercentChange(priceUSD, priceUSDWeek)
          const txCount = getAmountChange(current?.totalTransactions, oneDay?.totalTransactions)

          accum[address] = {
            exists: !!current,
            address,
            name: current ? current.name : '',
            symbol: current ? current.symbol : '',
            volumeUSD,
            volumeUSDChange,
            volumeUSDWeek,
            txCount,
            liquidityUSD,
            liquidityUSDChange,
            liquidityToken,
            priceUSD,
            priceUSDChange,
            priceUSDChangeWeek,
          }

          return accum
        }, {})
        setFetchState({ data: formatted, error: false })
      }
    }
    const allBlocksAvailable = block24h?.number && block48h?.number && block7d?.number && block14d?.number
    if (tokenAddresses.length > 0 && allBlocksAvailable && !blockError && bnbPrices) {
      fetch()
    }
  }, [tokenAddresses, block24h, block48h, block7d, block14d, blockError, bnbPrices])

  return fetchState
}

export default useFetchedTokenDatas
