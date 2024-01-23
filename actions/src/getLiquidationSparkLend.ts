import {
    ActionFn,
    Context,
    Event,
    TransactionEvent,
} from '@tenderly/actions'

import {
    Contract
} from 'ethers'

import {
    poolAbi,
} from './abis'

import {
    createMainnetProvider,
} from './utils'

const SPARKLEND_POOL = '0xC13e21B648A5Ee794902342038FF3aDAB66BE987'

export const getLiquidationSparkLend: ActionFn = async (context: Context, event: Event) => {
	const txEvent = event as TransactionEvent

    const provider = await createMainnetProvider(context)

    const pool = new Contract(SPARKLEND_POOL, poolAbi, provider)

    const filteredParsedLiquidationLogs = txEvent.logs
        .filter(log => log.address.toLowerCase() == SPARKLEND_POOL.toLowerCase())
        .map(log => pool.interface.parseLog(log))
        .filter(log => log?.name == 'LiquidationCall')

    console.log({filteredParsedLiquidationLogs})
}
