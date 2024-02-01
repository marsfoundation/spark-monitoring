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
	potAbi,
} from './abis'

import {
	createMainnetProvider,
	formatBasisPoints,
	formatBigInt,
	getDevianceInBasisPoints,
	invertRecord,
	sendMessagesToSlack,
} from './utils'

const SPARKLEND_POOL = '0xC13e21B648A5Ee794902342038FF3aDAB66BE987' as const
const SPARKLEND_ORACLE = '0x8105f69D9C41644c6A0803fDA7D03Aa70996cFD9' as const
const MAKER_POT = '0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7' as const

const DEFAULT_ORACLE_DEVIANCE_THRESHOLD = 750 as const
const GNO_ORACLE_DEVIANCE_THRESHOLD = 1500 as const
const DERIVATIVE_DEVIANCE_THRESHOLD = 0 as const
const WBTC_BTC_DEVIANCE_THRESHOLD = 0 as const

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
		.map(key => {return {[invertRecord(coingeckoCoinIds)[key]]: BigInt(Math.floor(coingeckoCallResult.data[key].usd * 1_0000_0000))}})
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
		const oracleDevianceThreshold = assetSymbol == 'GNO' ? GNO_ORACLE_DEVIANCE_THRESHOLD : DEFAULT_ORACLE_DEVIANCE_THRESHOLD  // modify this to test alerts triggers

		if (
			devianceInBasisPoints >= oracleDevianceThreshold
			&& blockEvent.blockNumber >= COOLDOWN_PERIOD + blockOfLastAlertForAsset
		) {
			await context.storage.putNumber(`getAssetPriceDeviance-oracle-vs-off-chain-${assetSymbol}`, blockEvent.blockNumber)
			slackMessages.push(
				formatOracleDevianceMessage(
					assetSymbol,
					devianceInBasisPoints,
					oraclePrices[assetSymbol],
					offChainPrices[assetSymbol],
					blockEvent.blockNumber,
				)
			)
		}
	}

	// Custom sDAI vs DAI check
	const pot = new Contract(MAKER_POT, potAbi, provider)
	const sdaiDaiExchangeRatio = await pot.chi()
	const sdaiMessage = await createDerivativeAssetDevianceMessage(
		context,
		sdaiDaiExchangeRatio,
		'sDAI',
		oraclePrices['sDAI'],
		oraclePrices['DAI'],
		blockEvent.blockNumber
	)
	if (sdaiMessage) slackMessages.push(sdaiMessage)

	// Custom wstETH vs ETH check
	const wstethEthExchangeRatio = 1050000000000000000000000000n // TODO: get from Lido
	const wstethMessage = await createDerivativeAssetDevianceMessage(
		context,
		wstethEthExchangeRatio,
		'wstETH',
		oraclePrices['wstETH'],
		oraclePrices['WETH'],
		blockEvent.blockNumber
	)
	if (wstethMessage) slackMessages.push(wstethMessage)


	// Custom rETH vs ETH check
	const rethEthExchangeRatio = 1050000000000000000000000000n // TODO: get from Rocket
	const rethMessage = await createDerivativeAssetDevianceMessage(
		context,
		rethEthExchangeRatio,
		'rETH',
		oraclePrices['rETH'],
		oraclePrices['WETH'],
		blockEvent.blockNumber
	)
	if (rethMessage) slackMessages.push(rethMessage)

	// Custom WBTC vs BTC check
	const wbtcDevianceInBasisPoints = getDevianceInBasisPoints(offChainPrices['WBTC'], offChainPrices['BTC'])
	const lastWbtcAlert = await context.storage.getNumber(`getAssetPriceDeviance-pegged-WBTC-BTC`)
	if (
		wbtcDevianceInBasisPoints >= WBTC_BTC_DEVIANCE_THRESHOLD
		&& blockEvent.blockNumber >= COOLDOWN_PERIOD + lastWbtcAlert
	) {
		await context.storage.putNumber(`getAssetPriceDeviance-pegged-WBTC-BTC`, blockEvent.blockNumber)
		slackMessages.push(
`\`\`\`
🚨🌽 WBTC/BTC OFF-CHAIN PRICE DEVIANCE 🚨🌽
WBTC:         ${formatBigInt(offChainPrices['WBTC'], 8)}
BTC:          ${formatBigInt(offChainPrices['BTC'], 8)}
Deviance:     ${formatBasisPoints(wbtcDevianceInBasisPoints)}
Block Number: ${blockEvent.blockNumber}\`\`\``
		)
	}

	console.log({slackMessages})
	await sendMessagesToSlack(slackMessages, context, 'TEST_SLACK_WEBHOOK_URL')
}

const formatOracleDevianceMessage = (
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
Deviance:     ${formatBasisPoints(devianceInBasisPoints)}
Block Number: ${blockNumber}\`\`\``
}
const createDerivativeAssetDevianceMessage = async (
	context: Context,
	exchangeRatioInRay: bigint,
	derivativeAssetSymbol: string,
	derivativeAssetPrice: bigint,
	underlyingAssetPrice: bigint,
	blockNumber: number,
): Promise<string | null> => {
	const derivativeAssetPrimaryValue = underlyingAssetPrice * exchangeRatioInRay / BigInt(10 ** 27)
	const devianceInBasisPoints = getDevianceInBasisPoints(derivativeAssetPrice, derivativeAssetPrimaryValue)
	const lastAlert = await context.storage.getNumber(`getAssetPriceDeviance-derivative-${derivativeAssetSymbol}`)
	if (
		devianceInBasisPoints >= DERIVATIVE_DEVIANCE_THRESHOLD
		&& blockNumber >= COOLDOWN_PERIOD + lastAlert
	) {
		await context.storage.putNumber(`getAssetPriceDeviance-derivative-${derivativeAssetSymbol}`, blockNumber)
		return `\`\`\`
🚨📊 ${derivativeAssetSymbol} PRIMARY/MARKET PRICE DEVIANCE 🚨📊
Primary Value: ${formatBigInt(derivativeAssetPrimaryValue, 8)}
Market Price:  ${formatBigInt(derivativeAssetPrice, 8)}
Deviance:      ${formatBasisPoints(devianceInBasisPoints)}
Block Number:  ${blockNumber}\`\`\``
	}
	return null
}
