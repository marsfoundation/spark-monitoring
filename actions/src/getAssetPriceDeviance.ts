import axios from 'axios'

import {
	ActionFn,
    BlockEvent,
	Context,
	Event,
} from '@tenderly/actions'

import {
	Contract,
} from 'ethers'

import {
    erc20Abi,
    oracleAbi,
    poolAbi,
} from './abis'

import {
    createMainnetProvider, invertRecord,
    getDevianceInBasisPoints,
    sendMessagesToSlack,
    formatBigInt,
} from './utils'

const SPARKLEND_POOL = '0xC13e21B648A5Ee794902342038FF3aDAB66BE987' as const
const SPARKLEND_ORACLE = '0x8105f69D9C41644c6A0803fDA7D03Aa70996cFD9' as const

export const getAssetPriceDeviance: ActionFn = async (context: Context, event: Event) => {
    const blockEvent = event as BlockEvent
    const provider = await createMainnetProvider(context)

	const sparkPool = new Contract(SPARKLEND_POOL, poolAbi, provider)
	const oracle = new Contract(SPARKLEND_ORACLE, oracleAbi, provider)

	const sparkAssets = await sparkPool.getReservesList() as string[]
    const sparkAssetSymbols = (await Promise.all(sparkAssets.map(async asset => await new Contract(asset, erc20Abi, provider).symbol()))) as string[]

    const oraclePrices = (await Promise.all(sparkAssets.map(async (asset, index) => {return {[`${sparkAssetSymbols[index]}`]: await oracle.getAssetPrice(asset)}})))
        .reduce((acc, curr) => { return { ...acc, ...curr }}, {})
    console.log({oraclePrices})

    // const coinmarketcapApiKey = await context.secrets.get('COINMARKETCAP_API_KEY')
    // const coinmarketcapCallResult = await axios.get(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${sparkAssetSymbols.join(',')}`, {
    //     headers: {
    //         'X-CMC_PRO_API_KEY': coinmarketcapApiKey,
    //     },
    // })
    // const coinmarketcapPrices = sparkAssetSymbols.map(symbol => BigInt(Math.floor(coinmarketcapCallResult.data.data[symbol][0].quote.USD.price * 1_00000000)))
    // console.log({coinmarketcapPrices})

    const coingeckoCoinIds: Record<string, string> = {
        'GNO': 'gnosis',
        'sDAI': 'savings-dai',
        'rETH': 'rocket-pool-eth',
        'USDC': 'usd-coin',
        'wstETH': 'wrapped-steth',
        'WBTC': 'wrapped-bitcoin',
        'USDT': 'tether',
        'DAI': 'dai',
        'WETH': 'weth',
    }
    const coingeckoCallResult = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${sparkAssetSymbols.map(symbol => coingeckoCoinIds[symbol] || symbol).join(',')}&vs_currencies=USD`) as any
    const coingeckoPrices = Object.keys(coingeckoCallResult.data)
        .map(key => {return {[invertRecord(coingeckoCoinIds)[key]]: BigInt(Math.floor(coingeckoCallResult.data[key].usd * 1_00000000))}})
        .reduce((acc, curr) => { return { ...acc, ...curr }}, {})
    console.log({coingeckoPrices})

    const offChainPrices = coingeckoPrices

    let slackMessages = [] as string[]
    sparkAssetSymbols.forEach(assetSymbol => {
        const devianceInBasisPoints = getDevianceInBasisPoints(oraclePrices[assetSymbol], offChainPrices[assetSymbol])

        const deviancePercentage = Number(devianceInBasisPoints)/100
        if (oraclePrices[assetSymbol] < offChainPrices[assetSymbol]) {
            console.log(`Off-chain price of ${assetSymbol} is higher (${offChainPrices[assetSymbol].toString()}) (oracle: ${oraclePrices[assetSymbol].toString()}) (deviance: ${deviancePercentage}%)`)
        } else if (oraclePrices[assetSymbol] > offChainPrices[assetSymbol]) {
            console.log(`   Oracle price of ${assetSymbol} is higher (${oraclePrices[assetSymbol].toString()}) (off-chain: ${offChainPrices[assetSymbol].toString()}) (deviance: ${deviancePercentage}%)`)
        } else {
            console.log(`Prices of ${assetSymbol} are equal (${oraclePrices[assetSymbol].toString()})`)
        }

        if (devianceInBasisPoints >= 10) {  // modify this to test alerts triggers
            slackMessages.push(
                formatHighDevianceMessage(
                    assetSymbol,
                    devianceInBasisPoints,
                    oraclePrices[assetSymbol],
                    offChainPrices[assetSymbol],
                    blockEvent.blockNumber,
                )
            )

        }
    })
    console.log(slackMessages)
    await sendMessagesToSlack(slackMessages, context, 'SLACK_WEBHOOK_URL')
}

const formatHighDevianceMessage = (
    assetSymbol: string,
    devianceInBasisPoints: bigint,
    oraclePrice: bigint,
    offChainPrice: bigint,
    blockNumber: number,
): string => {
    return `
\`\`\`
🚨 ${assetSymbol} ORACLE DEVIANCE 🚨
Off-Chain:    ${formatBigInt(offChainPrice, 8)}
Oracle:       ${formatBigInt(oraclePrice, 8)}
Deviance:     ${Number(devianceInBasisPoints)/100}% (${devianceInBasisPoints} bps)
Block Number: ${blockNumber}\`\`\``
}
