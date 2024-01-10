import {
	ActionFn,
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

export const getAllReservesAssetLiabilitySparkLend: ActionFn = async (context: Context, event: Event) => {
	let txEvent = event as TransactionEvent

	const HEALTH_CHECKER = "0xfda082e00EF89185d9DB7E5DcD8c5505070F5A3B"
	const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f"
	const ORACLE = "0x8105f69D9C41644c6A0803fDA7D03Aa70996cFD9"

	const url = await context.secrets.get('ETH_RPC_URL')

	const provider = new ethers.JsonRpcProvider(url)

	const healthChecker = new ethers.Contract(HEALTH_CHECKER, sparklendHealthCheckerAbi, provider)
	const oracle = new ethers.Contract(ORACLE, oracleAbi, provider)

	const getAllReservesAssetLiabilityResponse = await healthChecker.getAllReservesAssetLiability()

	let messages = []

	for (const reserveInfo of getAllReservesAssetLiabilityResponse) {
		const diff = BigInt(reserveInfo.assets) - BigInt(reserveInfo.liabilities)
		const price = await oracle.getAssetPrice(reserveInfo.reserve)
		const usdDiff = diff * BigInt(price) / BigInt(10 ** 18)

		let MAX_DIFF = 1_000 * 10 ** 8  // 1k USD diff to trigger alert

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

	await sendMessagesToSlack(messages, context, 'SLACK_WEBHOOK_URL')

	await sendMessagesToPagerDuty(messages, context)
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

NOTE: USD diff derived from raw values, not from USD assets/liabilities.

\`\`\`
	`
}
