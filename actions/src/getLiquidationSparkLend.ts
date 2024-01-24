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
    oracleAbi,
    poolAbi,
} from './abis'

import {
    createMainnetProvider,
    createPositionOutlineForUser,
    fetchAllAssetsData,
} from './utils'

const SPARKLEND_POOL = '0xC13e21B648A5Ee794902342038FF3aDAB66BE987'
const SPARKLEND_ORACLE = "0x8105f69D9C41644c6A0803fDA7D03Aa70996cFD9"

export const getLiquidationSparkLend: ActionFn = async (context: Context, event: Event) => {
	const txEvent = event as TransactionEvent

    const provider = await createMainnetProvider(context)

    const pool = new Contract(SPARKLEND_POOL, poolAbi, provider)
	const oracle = new Contract(SPARKLEND_ORACLE, oracleAbi, provider)

    const liquidationLogs = txEvent.logs
        .filter(log => log.address.toLowerCase() == SPARKLEND_POOL.toLowerCase())
        .map(log => pool.interface.parseLog(log))
        .filter(log => log?.name == 'LiquidationCall')

    await Promise.all(
        liquidationLogs.map(async (log) => {
            const allAssetData = await fetchAllAssetsData(log && log.args[5], pool, oracle, provider)
            console.log(createPositionOutlineForUser(allAssetData))
        })
    )

}
