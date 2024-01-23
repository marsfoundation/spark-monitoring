import {
	ActionFn,
	Context,
	Event,
} from '@tenderly/actions'

import axios from 'axios'

import {
	Contract,
} from 'ethers'

import {
    erc20Abi,
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

    const sparkAssetSymbols = (await Promise.all(sparkAssets.map(async asset => await new Contract(asset, erc20Abi, provider).symbol())))
        .map(symbol => symbol.toUpperCase())

    const coinmarketcapApiKey = await context.secrets.get('COINMARKETCAP_API_KEY')
    const coinmarketcapCallResult = await axios.get(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${sparkAssetSymbols.join(',')}`, {
        headers: {
            'X-CMC_PRO_API_KEY': coinmarketcapApiKey,
        },
    })

    // const coinmarketcapPrices = sparkAssetSymbols.map(symbol => coinmarketcapCallResult.data.data[symbol])


    const offChainPrices = sparkAssetSymbols.map(symbol => BigInt(Math.floor(coinmarketcapCallResult.data.data[symbol][0].quote.USD.price * 1_00000000)))

    oraclePrices.forEach((oraclePrice, index) => {
        if(oraclePrice == offChainPrices[index]) {
            console.log(`Prices of ${sparkAssetSymbols[index]} are equal (${oraclePrice.toString()})`)
        }
        if(oraclePrice > offChainPrices[index]) {
            console.log(`Oracle price of ${sparkAssetSymbols[index]} is higher (${oraclePrice.toString()} (off-chain: ${offChainPrices[index].toString()}))`)
        }
        if(oraclePrice < offChainPrices[index]) {
            console.log(`Off-chain price of ${sparkAssetSymbols[index]} is higher (${offChainPrices[index].toString()}) (oracle: ${oraclePrice.toString()})`)
        }
    })
}
