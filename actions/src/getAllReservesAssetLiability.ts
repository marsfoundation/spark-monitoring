import {
	Context,
	Event,
	TransactionEvent,
} from '@tenderly/actions'

import {
	oracleAbi,
	sparklendHealthCheckerAbi,
} from './abis'

import {
	formatBigInt,
	sendMessagesToPagerDuty,
	sendMessagesToSlack,
} from './utils'

const ethers = require('ethers')

const SPARKLEND_ORACLE = "0x8105f69D9C41644c6A0803fDA7D03Aa70996cFD9"
const SPARKLEND_HEALTH_CHECKER = "0xfda082e00EF89185d9DB7E5DcD8c5505070F5A3B"

const AAVE_ORACLE = "0x54586bE62E3c3580375aE3723C145253060Ca0C2"
const AAVE_HEALTH_CHECKER = "0xB75927FbB797d4f568FF782d2B21911015dd52f3"

const getAllReservesAssetLiability = (
	oracleAddress: string,
	healthCheckerAddress: string,
	slackWebhookUrl: string,
	maxDiff: number,
	usePagerDuty: boolean,
) => async (context: Context, event: Event) => {
	let txEvent = event as TransactionEvent

	const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f"
	const GHO = "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f"

	const url = await context.secrets.get('ETH_RPC_URL')

	const provider = new ethers.JsonRpcProvider(url)

	const healthChecker = new ethers.Contract(healthCheckerAddress, sparklendHealthCheckerAbi, provider)
	const oracle = new ethers.Contract(oracleAddress, oracleAbi, provider)

	const getAllReservesAssetLiabilityResponse = (await healthChecker.getAllReservesAssetLiability())
		.map((reserveInfo: any) => ({reserve: reserveInfo.reserve, assets: reserveInfo.assets, liabilities: reserveInfo.liabilities}))

	let messages = []

	for (const reserveInfo of getAllReservesAssetLiabilityResponse) {
		if (reserveInfo.reserve.toLowerCase() === GHO.toLowerCase()) {
			continue  // We want to completely ignore GHO
		}

		const diff = BigInt(reserveInfo.assets) - BigInt(reserveInfo.liabilities)
		const price = await oracle.getAssetPrice(reserveInfo.reserve)
		const usdDiff = diff * BigInt(price) / BigInt(10 ** 18)

		let MAX_DIFF = maxDiff * 10 ** 8  // 1k USD diff to trigger alert

		if (reserveInfo.reserve.toLowerCase() === DAI.toLowerCase()) {
			MAX_DIFF = 300_000 * 10 ** 8
		}

		// Check that the absolute value of the difference is less than the max diff
		if (usdDiff < MAX_DIFF && usdDiff > -MAX_DIFF) {
			continue  // COMMENT OUT FOR TESTING
		}

		messages.push(await formatAssetLiabilityAlertMessage({...reserveInfo, diff, usdDiff, price}, txEvent, provider))
	}

	if (messages.length === 0) return

	await sendMessagesToSlack(messages, context, slackWebhookUrl)

	if (usePagerDuty) {
		await sendMessagesToPagerDuty(messages, context)
	}
}

const formatAssetLiabilityAlertMessage = async (reserveInfo: any, txEvent: any, provider: any) => {

	const tokenAbi = ["function symbol() view returns (string)"]

	const token = new ethers.Contract(reserveInfo.reserve, tokenAbi, provider)

	const tokenSymbol = await token.symbol()

	// 8 decimal representation
	const usdAssets = BigInt(reserveInfo.assets) * BigInt(reserveInfo.price) / BigInt(10 ** 18)
	const usdLiabilities = BigInt(reserveInfo.liabilities) * BigInt(reserveInfo.price) / BigInt(10 ** 18)

	return `
\`\`\`
🚨🚨🚨 ASSET/LIABILITY ALERT 🚨🚨🚨

${tokenSymbol} reserve (${reserveInfo.reserve}) has a difference between assets and liabilities of ${formatBigInt(BigInt(reserveInfo.diff).toString(), 18)}.

Discovered at block ${txEvent.blockNumber}.

RAW DATA:

Assets:      ${BigInt(reserveInfo.assets).toString()}
Liabilities: ${BigInt(reserveInfo.liabilities).toString()}
Diff:        ${BigInt(reserveInfo.diff).toString()}

FORMATTED DATA:

Assets:      ${formatBigInt(BigInt(reserveInfo.assets), 18)}
Liabilities: ${formatBigInt(BigInt(reserveInfo.liabilities), 18)}
Diff:        ${formatBigInt(BigInt(reserveInfo.diff), 18)}

USD FORMATTED DATA:

Assets:      ${formatBigInt(BigInt(usdAssets), 8)}
Liabilities: ${formatBigInt(BigInt(usdLiabilities), 8)}
Diff:        ${formatBigInt(BigInt(reserveInfo.usdDiff), 8)}

NOTE: USD diff derived from raw values, not from USD assets/liabilities.\`\`\``
}

export const getAllReservesAssetLiabilitySparkLend = getAllReservesAssetLiability(
	SPARKLEND_ORACLE,
	SPARKLEND_HEALTH_CHECKER,
	'ALERTS_IMPORTANT_SLACK_WEBHOOK_URL',
	1_000,
	true,
)

export const getAllReservesAssetLiabilityAave = getAllReservesAssetLiability(
	AAVE_ORACLE,
	AAVE_HEALTH_CHECKER,
	'AAVE_ALERTS_SLACK_WEBHOOK_URL',
	10_000,
	false,
)
