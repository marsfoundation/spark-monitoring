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
	createMainnetProvider,
	formatBigInt,
	getDevianceInBasisPoints,
	invertRecord,
	sendMessagesToSlack,
} from './utils'

const SPARKLEND_POOL = '0xC13e21B648A5Ee794902342038FF3aDAB66BE987' as const
const SPARKLEND_ORACLE = '0x8105f69D9C41644c6A0803fDA7D03Aa70996cFD9' as const
const COOLDOWN_PERIOD = 500 as const

export const getAssetPriceDeviance: ActionFn = async (context: Context, event: Event) => {
	const blockEvent = event as BlockEvent
	const provider = await createMainnetProvider(context)

	const sparkPool = new Contract(SPARKLEND_POOL, poolAbi, provider)
	const oracle = new Contract(SPARKLEND_ORACLE, oracleAbi, provider)

	const sparkAssets = await sparkPool.getReservesList() as string[]
	const sparkAssetSymbols = (await Promise.all(sparkAssets.map(async asset => await new Contract(asset, erc20Abi, provider).symbol()))) as string[]

	const oraclePrices = (await Promise.all(sparkAssets.map(async (asset, index) => {return {[`${sparkAssetSymbols[index]}`]: await oracle.getAssetPrice(asset)}})))
	.reduce((acc, curr) => { return { ...acc, ...curr }}, {})


	const coingeckoCoinIds: Record<string, string> = {
		'GNO': 'gnosis',
		'sDAI': 'savings-dai',
		'rETH': 'rocket-pool-eth',
		'USDC': 'usd-coin',
		'wstETH': 'wrapped-steth',
		'WBTC': 'wrapped-bitcoin',
		'BTC': 'bitcoin',
		'USDT': 'tether',
		'DAI': 'dai',
		'WETH': 'weth',
	}
	const nonSparkAssetsToTrack = ['BTC']
	const coingeckoCallResult = await axios
		.get(`https://api.coingecko.com/api/v3/simple/price?ids=${[...sparkAssetSymbols, ...nonSparkAssetsToTrack].map(symbol => coingeckoCoinIds[symbol] || symbol).join(',')}&vs_currencies=USD`) as any
	const coingeckoPrices = Object.keys(coingeckoCallResult.data)
		.map(key => {return {[invertRecord(coingeckoCoinIds)[key]]: BigInt(Math.floor(coingeckoCallResult.data[key].usd * 1_00000000))}})
		.reduce((acc, curr) => { return { ...acc, ...curr }}, {})

	//  Here we determine what are our official off-chain prices - for now just coingecko
	const offChainPrices = coingeckoPrices

	let slackMessages = [] as string[]

	// Check for an oracle vs off-chain price deviation
	for(const assetSymbol of sparkAssetSymbols){
		const devianceInBasisPoints = getDevianceInBasisPoints(oraclePrices[assetSymbol], offChainPrices[assetSymbol])

		const deviancePercentage = Number(devianceInBasisPoints)/100
		if (oraclePrices[assetSymbol] < offChainPrices[assetSymbol]) {
			console.log(`Off-chain price of ${assetSymbol} is higher (${offChainPrices[assetSymbol].toString()}) (oracle: ${oraclePrices[assetSymbol].toString()}) (deviance: ${deviancePercentage}%)`)
		} else if (oraclePrices[assetSymbol] > offChainPrices[assetSymbol]) {
			console.log(`   Oracle price of ${assetSymbol} is higher (${oraclePrices[assetSymbol].toString()}) (off-chain: ${offChainPrices[assetSymbol].toString()}) (deviance: ${deviancePercentage}%)`)
		} else {
			console.log(`Prices of ${assetSymbol} are equal (${oraclePrices[assetSymbol].toString()})`)
		}

		const blockOfLastAlertForAsset = await context.storage.getNumber(`getAssetPriceDeviance-oracle-vs-off-chain-${assetSymbol}`)
		const oracleDevianceThreshold = assetSymbol == 'GNO' ? 1500 : 750  // modify this to test alerts triggers

		if (
			devianceInBasisPoints >= oracleDevianceThreshold
			&& blockEvent.blockNumber >= COOLDOWN_PERIOD + blockOfLastAlertForAsset
		) {
			await context.storage.putNumber(`getAssetPriceDeviance-oracle-vs-off-chain-${assetSymbol}`, blockEvent.blockNumber)
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
	}

	// Custom WBTC vs BTC check
	const wbtcDevianceInBasisPoints = getDevianceInBasisPoints(offChainPrices['WBTC'], offChainPrices['BTC'])
	const wbtcBtcDevianceThreshold = 200
	const lastWbtcAlert = await context.storage.getNumber(`getAssetPriceDeviance-custom-WBTC-BTC`)
	if (
		wbtcDevianceInBasisPoints >= wbtcBtcDevianceThreshold
		&& blockEvent.blockNumber >= COOLDOWN_PERIOD + lastWbtcAlert
	) {
		await context.storage.putNumber(`getAssetPriceDeviance-custom-WBTC-BTC`, blockEvent.blockNumber)
		slackMessages.push(`\`\`\`
🚨⚖️ WBTC/BTC PRICE DEVIANCE 🚨⚖️
WBTC:         ${formatBigInt(offChainPrices['WBTC'], 8)}
BTC:          ${formatBigInt(offChainPrices['BTC'], 8)}
Deviance:     ${Number(wbtcDevianceInBasisPoints)/100}% (${wbtcDevianceInBasisPoints} bps)
Block Number: ${blockEvent.blockNumber}
              (off-chain source)\`\`\``)
	}

	// Custom checks for derivative assets vs their underlying assets
	// - Oracle wstETH vs oracle ETH multiplied by Lido ratio
	// - Oracle rETH vs oracle ETH multiplied by Rocket ratio
	// - Oracle sDAI vs oracle DAI multiplied by pot dsr ratio

	console.log({slackMessages})
	await sendMessagesToSlack(slackMessages, context, 'ALERTS_IMPORTANT_SLACK_WEBHOOK_URL')
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
🚨🔮 ${assetSymbol} ORACLE DEVIANCE 🚨🔮
Off-Chain:    ${formatBigInt(offChainPrice, 8)}
Oracle:       ${formatBigInt(oraclePrice, 8)}
Deviance:     ${Number(devianceInBasisPoints)/100}% (${devianceInBasisPoints} bps)
Block Number: ${blockNumber}\`\`\``
}
