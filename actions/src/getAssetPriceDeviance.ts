import {
	ActionFn,
	Context,
	Event,
} from '@tenderly/actions'

import {
	Contract,
} from 'ethers'

import {
	oracleAbi,
	poolAbi,
} from './abis'

import {
    createMainnetProvider,
} from './utils'

const SPARKLEND_POOL = "0xC13e21B648A5Ee794902342038FF3aDAB66BE987" as const
const SPARKLEND_ORACLE = "0x8105f69D9C41644c6A0803fDA7D03Aa70996cFD9"

export const getAssetPriceDeviance: ActionFn = async (context: Context, _: Event) => {
    const provider = await createMainnetProvider(context)

	const sparkPool = new Contract(SPARKLEND_POOL, poolAbi, provider)
	const oracle = new Contract(SPARKLEND_ORACLE, oracleAbi, provider)

	const sparkAssets = await sparkPool.getReservesList() as string[]

    const oraclePrices = await Promise.all(sparkAssets.map(async asset => await oracle.getAssetPrice(asset)))

    console.log(sparkAssets)
    console.log(oraclePrices)
}
