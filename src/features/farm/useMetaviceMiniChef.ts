import { useActiveWeb3React, useMetaviceMiniChefContract, useSushiContract } from '../../hooks'

import { BigNumber } from '@ethersproject/bignumber'
import { Chef } from './enum'
import { Zero } from '@ethersproject/constants'
import { useCallback } from 'react'
import { useChefContract } from './hooks'

export default function useMetaviceMiniChef() {
  const { account } = useActiveWeb3React()

  const contract = useMetaviceMiniChefContract()

  // Deposit
  const deposit = useCallback(
    async (pid: number, amount: BigNumber) => {
      try {
        let tx = await contract?.deposit(pid, amount, account)
        return tx
      } catch (e) {
        console.error(e)
        return e
      }
    },
    [account, contract]
  )

  // Withdraw
  const withdraw = useCallback(
    async (pid: number, amount: BigNumber) => {
      try {
        let tx = await contract?.withdraw(pid, amount, account)
        return tx
      } catch (e) {
        console.error(e)
        return e
      }
    },
    [account, contract]
  )

  const harvest = useCallback(
    async (pid: number) => {
      try {
        let tx = await contract?.harvest(pid, account)
        return tx
      } catch (e) {
        console.error(e)
        return e
      }
    },
    [account, contract]
  )

  return { deposit, withdraw, harvest }
}
