import { Context } from '@tenderly/actions'
import { JsonRpcProvider } from 'ethers'

export const createMainnetProvider = async (context: Context) => {
	const rpcUrl = await context.secrets.get('ETH_RPC_URL')
	return new JsonRpcProvider(rpcUrl)
}
