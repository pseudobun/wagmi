import type {
  Account,
  Address,
  Chain,
  SendTransactionErrorType as viem_SendTransactionErrorType,
  SendTransactionParameters as viem_SendTransactionParameters,
  SendTransactionReturnType as viem_SendTransactionReturnType,
  TransactionRequest,
} from 'viem'
import {
  estimateGas as viem_estimateGas,
  sendTransaction as viem_sendTransaction,
} from 'viem/actions'

import { type Config } from '../createConfig.js'
import type { BaseErrorType, ErrorType } from '../errors/base.js'
import type { SelectChains } from '../types/chain.js'
import type {
  ChainIdParameter,
  ConnectorParameter,
} from '../types/properties.js'
import { type Evaluate } from '../types/utils.js'
import { getAction } from '../utils/getAction.js'
import {
  type GetConnectorClientErrorType,
  getConnectorClient,
} from './getConnectorClient.js'

export type SendTransactionParameters<
  config extends Config = Config,
  chainId extends config['chains'][number]['id'] = config['chains'][number]['id'],
  ///
  chains extends readonly Chain[] = SelectChains<config, chainId>,
> = {
  [key in keyof chains]: Evaluate<
    Omit<
      viem_SendTransactionParameters<chains[key], Account, chains[key]>,
      'chain' | 'gas'
    > &
      ChainIdParameter<config, chainId> &
      ConnectorParameter & {
        to: Address
      }
  >
}[number] & {
  /** Gas provided for transaction execution, or `null` to skip the prelude gas estimation. */
  gas?: TransactionRequest['gas'] | null
}

export type SendTransactionReturnType = viem_SendTransactionReturnType

export type SendTransactionErrorType =
  // getConnectorClient()
  | GetConnectorClientErrorType
  // base
  | BaseErrorType
  | ErrorType
  // viem
  | viem_SendTransactionErrorType

/** https://wagmi.sh/core/api/actions/sendTransaction */
export async function sendTransaction<
  config extends Config,
  chainId extends config['chains'][number]['id'],
>(
  config: config,
  parameters: SendTransactionParameters<config, chainId>,
): Promise<SendTransactionReturnType> {
  const { account, chainId, connector, gas: gas_, ...rest } = parameters

  const client = await getConnectorClient(config, {
    account,
    chainId,
    connector,
  })

  const gas = await (async () => {
    // Skip gas estimation if `null` is provided.
    if (gas_ === null) return undefined

    // Run gas estimation if no value is provided.
    if (gas_ === undefined) {
      const action = getAction(client, viem_estimateGas, 'estimateGas')
      return action({
        ...(rest as any),
        chain: chainId ? { id: chainId } : null,
      })
    }

    // Use provided gas value.
    return gas_
  })()

  const action = getAction(client, viem_sendTransaction, 'sendTransaction')
  const hash = await action({
    ...(rest as any),
    gas,
    chain: chainId ? { id: chainId } : null,
  })

  return hash
}
