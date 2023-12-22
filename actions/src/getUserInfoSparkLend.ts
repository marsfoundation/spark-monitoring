import {
	ActionFn,
	Context,
	Event,
	TransactionEvent,
} from '@tenderly/actions'

import {
	poolAbi,
	sparklendHealthCheckerAbi,
} from './abis'

import {
    formatBigInt,
	sendMessagesToPagerDuty,
    sendMessagesToSlack,
} from './utils'

const ethers = require('ethers')

export const getUserInfoSparklend: ActionFn = async (context: Context, event: Event) => {
	let txEvent = event as TransactionEvent

	// 1. Define contracts

	const POOL_ADDRESS = "0xC13e21B648A5Ee794902342038FF3aDAB66BE987"
	const HEALTH_CHECKER = "0xfda082e00EF89185d9DB7E5DcD8c5505070F5A3B"

	const pool = new ethers.Contract(POOL_ADDRESS, poolAbi)

	// 2. Filter events logs to get all pool logs

	const filteredLogs = txEvent.logs.filter(log => {
		if (log.address !== POOL_ADDRESS) return

		try {
			return pool.interface.parseLog(log)
		} catch (e) {
			// console.log(e)
		}
	})

	// 3. Get all `user` properties from logs, from all events that users adjust positions

	let users: Array<string> = []

	filteredLogs.forEach(log => {
		const parsedLog = pool.interface.parseLog(log).args
		if (parsedLog.user) {
			users.push(parsedLog.user)
		}
	})

	users.push(txEvent.from)
	users = [...new Set(users)]  // Remove duplicates

	// 4. Get health of all users

	const url = await context.secrets.get('ETH_RPC_URL')

	const provider = new ethers.providers.JsonRpcProvider(url)

	const healthChecker = new ethers.Contract(HEALTH_CHECKER, sparklendHealthCheckerAbi, provider)

	const userHealths = await Promise.all(users.map(async (user) => {
		return {
			user,
			...await healthChecker.getUserHealth(user)
		}
	}))

	console.log({users})
	console.log({userHealths})

	// 5. Filter userHealths to only users below liquidation threshold, exit if none

	const usersBelowLT = userHealths.filter(userHealth => {
		// return userHealth.healthFactor < 2e18  // TESTING
		return userHealth.belowLiquidationThreshold
		// return true  // UNCOMMENT AND REPLACE FOR TESTING
	})

	if (usersBelowLT.length === 0) {
		console.log("No users below liquidation threshold")
		return
	}

	// 6. Generate messages for each user below liquidation threshold and send to Slack and PagerDuty

	const messages = usersBelowLT.map(userHealth => {
		return formatUserHealthAlertMessage(userHealth, txEvent)
	})

	if (messages.length === 0) return

	await sendMessagesToSlack(messages, context, 'SLACK_WEBHOOK_URL')

	await sendMessagesToPagerDuty(messages, context)
}

const formatUserHealthAlertMessage = (userHealth: any, txEvent: TransactionEvent) => {
	return `
\`\`\`
🚨🚨🚨 USER BELOW LIQUIDATION THRESHOLD ALERT 🚨🚨🚨

Account ${userHealth.user} is BELOW liquidation threshold after protocol interaction.
This indicates possible malicious activity.

Transaction hash: ${txEvent.hash}

RAW DATA:

Total Collateral: ${BigInt(userHealth.totalCollateralBase).toString()}
Total Debt:       ${BigInt(userHealth.totalDebtBase).toString()}
LT:               ${BigInt(userHealth.currentLiquidationThreshold).toString()}
LTV:              ${BigInt(userHealth.ltv).toString()}
Health Factor:    ${BigInt(userHealth.healthFactor).toString()}

FORMATTED DATA:

Total Collateral: ${formatBigInt(BigInt(userHealth.totalCollateralBase), 8)}
Total Debt:       ${formatBigInt(BigInt(userHealth.totalDebtBase), 8)}
LT:               ${formatBigInt(BigInt(userHealth.currentLiquidationThreshold), 2)}%
LTV:              ${formatBigInt(BigInt(userHealth.ltv), 2)}%
Health Factor:    ${formatBigInt(BigInt(userHealth.healthFactor), 18)}
\`\`\`
	`
}
