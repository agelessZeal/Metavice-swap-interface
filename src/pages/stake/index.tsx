import { Chef, PairType } from '../../features/farm/enum'
import { useActiveWeb3React, useFuse } from '../../hooks'
import {
  useAlcxPrice,
  useAvaxPrice,
  useAverageBlockTime,
  useCvxPrice,
  useEthPrice,
  useFarmPairAddresses,
  useFarms,
  useKashiPairs,
  useMasterChefV1SushiPerBlock,
  useMasterChefV1TotalAllocPoint,
  useMiniChefPairAddresses,
  useMaticPrice,
  useMphPrice,
  useOnePrice,
  usePicklePrice,
  useRulerPrice,
  useStakePrice,
  useSushiPairs,
  useSushiPrice,
  useTruPrice,
  useYggPrice,
  useMiniChefFarms,
  usePancakePairs,
} from '../../services/graph'

import { BigNumber } from '@ethersproject/bignumber'
import { ChainId } from '@sushiswap/sdk'
import Container from '../../components/Container'
import FarmList from '../../features/farm/FarmList'
import Head from 'next/head'
import Menu from '../../features/farm/FarmMenu'
import React from 'react'
import Search from '../../components/Search'
import { classNames } from '../../functions'
import dynamic from 'next/dynamic'
import { getAddress } from 'ethers/lib/utils'
import { usePositions } from '../../features/farm/hooks'
import { useRouter } from 'next/router'
import useFarmRewards from '../../hooks/useFarmRewards'

import usePoolDatas from '../../services/graph/fetchers/poolData'

import NetworkGuard from '../../guards/Network'
import { useCurrency } from '../../hooks/Tokens'
import useFetchedTokenDatas from '../../services/graph/fetchers/tokenData'

function Stake(): JSX.Element {
  // const { chainId } = useActiveWeb3React()
  // const router = useRouter()

  // const type = router.query.filter == null ? 'all' : (router.query.filter as string)

  const pairAddresses = useMiniChefPairAddresses()

  // console.log('testSwapPairs ', testSwapPairs)
  const pancakePairs = usePancakePairs({
    where: {
      id_in: pairAddresses,
    },
  })

  const { error: poolDataError, data: poolDatas } = usePoolDatas(pairAddresses)

  const { error: tokenDataError, data: tokenDatas } = useFetchedTokenDatas(pairAddresses)

  const pfarms = useMiniChefFarms()

  // const positions = usePositions()

  const averageBlockTime = useAverageBlockTime()

  // const masterChefV1TotalAllocPoint = useMasterChefV1TotalAllocPoint()

  // const masterChefV1SushiPerBlock = useMasterChefV1SushiPerBlock()

  // TODO: Obviously need to sort this out but this is fine for time being,
  // prices are only loaded when needed for a specific network
  // const [sushiPrice, ethPrice, maticPrice, stakePrice, onePrice] = [
  //   useAvaxPrice(),
  //   useEthPrice(),
  //   useMaticPrice(),
  //   useStakePrice(),
  //   useOnePrice(),
  // ]

  const testFarm = {
    accSushiPerShare: '',
    allocPoint: 100,
    balance: 150000000000,
    chef: 2,
    id: 0,
    lastRewardTime: 1631786674,
    miniChef: {
      id: '0x9996f3Ca9ee326008a3D3f41e7B0feec09B8d1d6',
      metavicePerSecond: 130000000000000,
      totalAllocPoint: 100,
    },
    owner: {
      id: '0x9996f3Ca9ee326008a3D3f41e7B0feec09B8d1d6',
      metavicePerSecond: 130000000000000,
      totalAllocPoint: 100,
    },
    pair: '0x3ee2200efb3400fabb9aacf31297cbdd1d435d47',
    slpBalance: 0,
    userCount: 0,
    rewarder: {
      id: '0xa51735D315293B994AdeB49e6b68910D9e073336',
      rewardPerSecond: 130000000000000,
      rewardToken: '0x3F1d29b611c649eEC1e62bE2237891DD88E1aFe0',
    },
  }

  const farms = pfarms

  const blocksPerDay = 86400 / Number(averageBlockTime)

  const map = (pool) => {
    // TODO: Account for fees generated in case of swap pairs, and use standard compounding
    // algorithm with the same intervals acrosss chains to account for consistency.
    // For lending pairs, what should the equivilent for fees generated? Interest gained?
    // How can we include this?

    // TODO: Deal with inconsistencies between properties on subgraph
    pool.owner = pool?.owner || pool?.masterChef || pool?.miniChef
    pool.balance = pool?.balance || pool?.slpBalance

    const swapPair = pancakePairs?.find((pair) => pair.id === pool.pair)

    const fullPair = !poolDataError && poolDatas ? poolDatas[pool.pair] : undefined
    // const kashiPair = kashiPairs?.find((pair) => pair.id === pool.pair)

    const type = swapPair || fullPair ? PairType.SWAP : PairType.SINGLE

    // const type = PairType.SINGLE

    let metavicePair = {
      decimals: 18,
      type,
      id: '0x3F1d29b611c649eEC1e62bE2237891DD88E1aFe0',
      token0: {
        id: '0x3F1d29b611c649eEC1e62bE2237891DD88E1aFe0',
        name: 'Metavice',
        symbol: 'SERVE',
        totalSupply: '16840',
      },
      priceUSD: 0.1,
    }

    if (!fullPair && !swapPair && pool?.pair) {
      // const token1 = useCurrency(pool?.pair)
      if (pool.pair !== '0x3f1d29b611c649eec1e62be2237891dd88e1afe0') {
        if (tokenDatas && !tokenDataError) {
          console.log('tokenDatas:', tokenDatas)
          const tokenData = tokenDatas[pool.pair]
          metavicePair = {
            decimals: 18,
            type,
            id: pool?.pair,
            token0: {
              id: pool?.pair,
              name: tokenData.name,
              symbol: tokenData.symbol,
              totalSupply: '16840',
            },
            ...tokenData,
          }
        }
      }
    }

    const pair = fullPair ? fullPair : swapPair ? swapPair : metavicePair

    const blocksPerHour = 3600 / averageBlockTime

    function getRewards() {
      if (pool.chef === Chef.MINICHEF) {
        const metavicePerSecond =
          ((pool.allocPoint / pool.miniChef.totalAllocPoint) * pool.miniChef.metavicePerSecond) / 1e18
        const sushiPerBlock = metavicePerSecond * averageBlockTime
        const sushiPerDay = sushiPerBlock * blocksPerDay
        const rewardPerSecond =
          ((pool.allocPoint / pool.miniChef.totalAllocPoint) * pool.rewarder.rewardPerSecond) / 1e18
        const rewardPerBlock = rewardPerSecond * averageBlockTime
        const rewardPerDay = rewardPerBlock * blocksPerDay

        console.log('rewardPerSecond:', rewardPerSecond)

        const reward = {
          [ChainId.RINKEBY]: {
            token: 'SERVE',
            icon: '/serve.png',
            rewardPrice: 0.1,
            rewardPerBlock,
            rewardPerDay,
          },
        }

        return [
          {
            token: 'SERVE',
            icon: '/serve.png',
            rewardPrice: 0.1,
            rewardPerBlock: sushiPerBlock + rewardPerBlock,
            rewardPerDay: sushiPerDay + rewardPerDay,
          },
        ]
      }
      return []
    }

    const rewards = getRewards()

    console.log('rewards:', rewards)

    const balance = Number(pool.balance / 1e18)

    const tvl =
      type === PairType.SINGLE
        ? balance * pair.priceUSD
        : (balance / Number(pair.totalSupply)) * Number(pair.reserveUSD)

    console.log('rewards balance:', balance, tvl, pool)

    const roiPerBlock =
      rewards.reduce((previousValue, currentValue) => {
        return previousValue + currentValue.rewardPerBlock * currentValue.rewardPrice
      }, 0) / tvl

    const roiPerHour = roiPerBlock * blocksPerHour

    const roiPerDay = roiPerHour * 24

    const roiPerMonth = roiPerDay * 30

    const roiPerYear = roiPerMonth * 12

    // const position = positions.find((position) => position.id === pool.id && position.chef === pool.chef)

    return {
      ...pool,
      pair: {
        ...pair,
        decimals: 18,
        type,
      },
      balance,
      roiPerBlock,
      roiPerHour,
      roiPerDay,
      roiPerMonth,
      roiPerYear,
      rewards,
      tvl,
    }
  }

  const FILTER = {
    all: (farm) => farm.allocPoint !== 0,
    '2x': (farm) => (farm.chef === Chef.MASTERCHEF_V2 || farm.chef === Chef.MINICHEF) && farm.allocPoint !== 0,
  }

  const data = farms.map(map).filter((farm) => {
    return farm.pair.type === PairType.SINGLE
  })
  // .filter((farm) => {
  //   return type in FILTER ? FILTER[type](farm) : true
  // })

  const options = {
    keys: ['pair.id', 'pair.token0.symbol', 'pair.token1.symbol'],
    threshold: 0.4,
  }

  const { result, term, search } = useFuse({
    data,
    options,
  })

  return (
    <Container id="farm-page" className="grid h-full grid-cols-4 py-4 mx-auto md:py-8 lg:py-12 gap-9" maxWidth="7xl">
      <Head>
        <title>Stake | Metavice</title>
        <meta key="description" name="description" content="Stake Metavice" />
      </Head>
      {/* <div className={classNames('sticky top-0 hidden lg:block md:col-span-1')} style={{ maxHeight: '40rem' }}>
        <Menu positionsLength={positions.length} />
      </div> */}
      <div className={classNames('space-y-6 col-span-4 lg:col-span-4 mx-2')}>
        {/* <Search
          search={search}
          term={term}
          inputProps={{
            className:
              'relative w-full bg-transparent border border-transparent focus:border-gradient-r-blue-pink-dark-900 rounded placeholder-secondary focus:placeholder-primary font-bold text-base px-6 py-3.5',
          }}
        /> */}

        {/* <div className="flex items-center text-lg font-bold text-high-emphesis whitespace-nowrap">
            Ready to Stake{' '}
            <div className="w-full h-0 ml-4 font-bold bg-transparent border border-b-0 border-transparent rounded text-high-emphesis md:border-gradient-r-blue-pink-dark-800 opacity-20"></div>
          </div>
          <FarmList farms={filtered} term={term} /> */}

        <div className="flex items-center text-3xl font-bold text-high-emphesis whitespace-nowrap">
          Farms{' '}
          <div className="w-full h-0 ml-4 font-bold bg-transparent border border-b-0 border-transparent rounded text-high-emphesis md:border-gradient-r-blue-pink-dark-800 opacity-20"></div>
        </div>

        <FarmList farms={result} term={term} />
      </div>
    </Container>
  )
}

Stake.Guard = NetworkGuard([ChainId.BSC])

export default Stake
