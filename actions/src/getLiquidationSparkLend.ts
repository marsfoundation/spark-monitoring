import {
	ActionFn,
	Context,
	Event,
	TransactionEvent,
} from '@tenderly/actions'

import {
	Contract,
	LogDescription,
} from 'ethers'

import {
	oracleAbi,
	poolAbi,
} from './abis'

import {
	AssetsData,
	createEtherscanTxLink,
	createMainnetProvider,
	createPoolStateOutline,
	createPositionOutlineForUser,
	fetchAllAssetsData,
	formatAssetAmount,
	sendMessagesToSlack,
	shortenAddress,
	transactionAlreadyProcessed,
} from './utils'

import {
	HIGH_GAS_TRANSACTION_THRESHOLD
} from './getHighGasTransaction'


const SPARKLEND_POOL = '0xC13e21B648A5Ee794902342038FF3aDAB66BE987'
const SPARKLEND_ORACLE = "0x8105f69D9C41644c6A0803fDA7D03Aa70996cFD9"

export const getLiquidationSparkLend: ActionFn = async (context: Context, event: Event) => {
	const txEvent = event as TransactionEvent

	if (await transactionAlreadyProcessed('getLiquidationSparkLend', context, txEvent)) return

	const provider = await createMainnetProvider(context)

	const pool = new Contract(SPARKLEND_POOL, poolAbi, provider)
	const oracle = new Contract(SPARKLEND_ORACLE, oracleAbi, provider)

	const liquidationLogs = txEvent.logs
		.filter(log => log.address.toLowerCase() == SPARKLEND_POOL.toLowerCase())
		.map(log => pool.interface.parseLog(log))
		.filter(log => log?.name == 'LiquidationCall')

	const slackMessages = await Promise.all(
		liquidationLogs.map(async (log) => {
			const allAssetsData = await fetchAllAssetsData(log && log.args[2], pool, oracle, provider)
			return log && formatLiquidationMessage(allAssetsData, log, txEvent)
		})
	) as string[]

	await sendMessagesToSlack(slackMessages, context, 'SPARKLEND_ALERTS_SLACK_WEBHOOK_URL')

}

const formatLiquidationMessage = (allAssetsData: AssetsData, log: LogDescription, txEvent: TransactionEvent) => {
	console.log(log.args)
	return `\`\`\`
❌ LIQUIDATED:   ${formatAssetAmount(allAssetsData[log.args[0]], log.args[4])}
📝 DEBT COVERED: ${formatAssetAmount(allAssetsData[log.args[1]], log.args[3])}
👨‍💼 USER:         ${shortenAddress(log.args[2])}
🥷 LIQUIDATOR:   ${shortenAddress(log.args[5])}
🏦 POOL:         ${createPoolStateOutline(allAssetsData[log.args[0]])}

${createPositionOutlineForUser(allAssetsData)}

${BigInt(txEvent.gasUsed) >= HIGH_GAS_TRANSACTION_THRESHOLD ? '⛽️🔥 HIGH GAS TRANSACTION ⛽️🔥\n' : ''}${createEtherscanTxLink(txEvent.hash)}\`\`\``
}
