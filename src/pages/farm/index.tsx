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

import NetworkGuard from '../../guards/Network'

function Farm(): JSX.Element {
  const { chainId } = useActiveWeb3React()
  const router = useRouter()

  const type = router.query.filter == null ? 'all' : (router.query.filter as string)

  // const pairAddresses = useFarmPairAddresses()

  // const swapPairs = useSushiPairs({
  //   where: {
  //     id_in: pairAddresses,
  //   },
  // })

  // const kashiPairs = useKashiPairs({
  //   where: {
  //     id_in: pairAddresses,
  //   },
  // })

  // const pfarms = useFarms()

  const positions = usePositions()

  const averageBlockTime = useAverageBlockTime()

  // const masterChefV1TotalAllocPoint = useMasterChefV1TotalAllocPoint()

  // const masterChefV1SushiPerBlock = useMasterChefV1SushiPerBlock()

  // TODO: Obviously need to sort this out but this is fine for time being,
  // prices are only loaded when needed for a specific network
  const [sushiPrice, ethPrice, maticPrice, stakePrice, onePrice] = [
    useAvaxPrice(),
    useEthPrice(),
    useMaticPrice(),
    useStakePrice(),
    useOnePrice(),
  ]

  const testFarm = {
    accSushiPerShare: '',
    allocPoint: '100',
    balance: '316227765016',
    chef: 2,
    id: '0',
    lastRewardTime: '1631266290',
    miniChef: {
      id: '0x962b210b559d7062b59e170f4377C20c7da4FaD8',
      sushiPerSecond: '1300000000000000',
      totalAllocPoint: '100',
    },
    owner: {
      id: '0x962b210b559d7062b59e170f4377C20c7da4FaD8',
      sushiPerSecond: '1300000000000000',
      totalAllocPoint: '100',
    },
    pair: '0x942f5bb4AC39Ae5Ff0ef0e4aA8D1CA998C52a5b6',
    slpBalance: '8194046008108',
    userCount: '0',
    rewarder: {
      id: '0x201c900BBfEC89D9d9297c1dF8F187f07F99f8d7',
      rewardPerSecond: '1300000000000000',
      rewardToken: '0x2f5231532190942Afa974632ED4586c5593d7Baa',
    },
  }

  const farms = [testFarm]

  const blocksPerDay = 86400 / Number(averageBlockTime)

  const map = (pool) => {
    // TODO: Account for fees generated in case of swap pairs, and use standard compounding
    // algorithm with the same intervals acrosss chains to account for consistency.
    // For lending pairs, what should the equivilent for fees generated? Interest gained?
    // How can we include this?

    // TODO: Deal with inconsistencies between properties on subgraph
    pool.owner = pool?.owner || pool?.masterChef || pool?.miniChef
    pool.balance = pool?.balance || pool?.slpBalance

    // const swapPair = swapPairs?.find((pair) => pair.id === pool.pair)
    // const kashiPair = kashiPairs?.find((pair) => pair.id === pool.pair)

    // const type = swapPair ? PairType.SWAP : PairType.KASHI

    const type = PairType.SWAP

    const pair = {
      decimals: 18,
      id: '0x942f5bb4AC39Ae5Ff0ef0e4aA8D1CA998C52a5b6',
      reserve0: '1928359.887405995540289756',
      reserve1: '1920966.04641',
      reserveETH: '1183.351142427706157233201110976883',
      reserveUSD: '4',
      timestamp: '1621898381',
      token0: {
        derivedETH: '0.0003068283960261003490764609134664169',
        id: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        name: 'Wrapped AVAX',
        symbol: 'WAVAX',
        totalSupply: '16840',
      },
      token0Price: '1.003849022219738620606344213098808',
      token1: {
        derivedETH: '0.0.034',
        id: '0xc7198437980c041c805A1EDcbA50c1Ce5db95118',
        name: 'Tether USD',
        symbol: 'USDT',
        totalSupply: '16840',
      },

      token1Price: '0.9961657359477946627790088931105365',
      totalSupply: '0.000000316227765016',
      trackedReserveETH: '1183.351142427706157233201110976883',
      txCount: '81365',
      type: 0,
      untrackedVolumeUSD: '46853896.79482616671033425777223395',
      volumeUSD: '46844749.23711596607606598865310647',
    }
    // swapPair || kashiPair

    const blocksPerHour = 3600 / averageBlockTime

    function getRewards() {
      if (pool.chef === Chef.MINICHEF) {
        const sushiPerSecond = ((pool.allocPoint / pool.miniChef.totalAllocPoint) * pool.miniChef.sushiPerSecond) / 1e18
        const sushiPerBlock = sushiPerSecond * averageBlockTime
        const sushiPerDay = sushiPerBlock * blocksPerDay
        const rewardPerSecond =
          ((pool.allocPoint / pool.miniChef.totalAllocPoint) * pool.rewarder.rewardPerSecond) / 1e18
        const rewardPerBlock = rewardPerSecond * averageBlockTime
        const rewardPerDay = rewardPerBlock * blocksPerDay

        const reward = {
          [ChainId.AVALANCHE]: {
            token: 'SMT',
            icon: '/Metavice.png',
            rewardPrice: 0.001,
          },
        }

        return [
          {
            token: 'SMT',
            icon: '/Metavice.png',
            rewardPrice: 0.00001,
            rewardPerBlock: sushiPerBlock,
            rewardPerDay: sushiPerDay,
          },
          {
            token: 'SMT',
            icon: '/Metavice.png',
            rewardPrice: 0.00001,
            rewardPerBlock: rewardPerBlock,
            rewardPerDay: rewardPerDay,
          },
        ]
      }
      return []
    }

    const rewards = getRewards()

    const balance = Number(pool.balance / 1e18) // swapPair ? Number(pool.balance / 1e18) : pool.balance / 10 ** kashiPair.token0.decimals

    const tvl = (balance / Number(pair.totalSupply)) * Number(pair.reserveUSD)

    const roiPerBlock =
      rewards.reduce((previousValue, currentValue) => {
        return previousValue + currentValue.rewardPerBlock * currentValue.rewardPrice
      }, 0) / tvl

    const roiPerHour = roiPerBlock * blocksPerHour

    const roiPerDay = roiPerHour * 24

    const roiPerMonth = roiPerDay * 30

    const roiPerYear = roiPerMonth * 12

    const position = positions.find((position) => position.id === pool.id && position.chef === pool.chef)

    return {
      ...pool,
      ...position,
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
    all: (farm) => farm.allocPoint !== '0',
    '2x': (farm) => (farm.chef === Chef.MASTERCHEF_V2 || farm.chef === Chef.MINICHEF) && farm.allocPoint !== '0',
  }

  const data = farms.map(map).filter((farm) => {
    return type in FILTER ? FILTER[type](farm) : true
  })

  const options = {
    keys: ['pair.id', 'pair.token0.symbol', 'pair.token1.symbol'],
    threshold: 0.4,
  }

  // console.log({ data })

  const { result, term, search } = useFuse({
    data,
    options,
  })

  return (
    <Container id="farm-page" className="grid h-full grid-cols-4 py-4 mx-auto md:py-8 lg:py-12 gap-9" maxWidth="7xl">
      <Head>
        <title>Farm | Metavice</title>
        <meta key="description" name="description" content="Farm SUSHI" />
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

        <div className="flex items-center text-lg font-bold text-high-emphesis whitespace-nowrap">
          Farms{' '}
          <div className="w-full h-0 ml-4 font-bold bg-transparent border border-b-0 border-transparent rounded text-high-emphesis md:border-gradient-r-blue-pink-dark-800 opacity-20"></div>
        </div>

        <FarmList farms={result} term={term} />
      </div>
    </Container>
  )
}

Farm.Guard = NetworkGuard([ChainId.AVALANCHE])

export default Farm
