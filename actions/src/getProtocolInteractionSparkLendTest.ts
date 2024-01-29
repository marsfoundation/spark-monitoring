import {
	ActionFn,
	Context,
	Event,
	TransactionEvent,
} from '@tenderly/actions'

import {
	Contract, LogDescription,
} from 'ethers'

import {
	poolAbi,
	oracleAbi,
} from './abis'

import {
	AssetsData,
	calculateDollarValueInCents,
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


const POOL_ADDRESS = "0xC13e21B648A5Ee794902342038FF3aDAB66BE987"
const ORACLE_ADDRESS = "0x8105f69D9C41644c6A0803fDA7D03Aa70996cFD9"

export const getProtocolInteractionSparkLendTest: ActionFn = async (context: Context, event: Event) => {
	let txEvent = event as TransactionEvent

	if (await transactionAlreadyProcessed('getProtocolInteractionSparklend', context, txEvent)) return

	const provider = await createMainnetProvider(context)

	const pool = new Contract(POOL_ADDRESS, poolAbi, provider)
	const oracle = new Contract(ORACLE_ADDRESS, oracleAbi, provider)

	const preFilteredLogs = txEvent.logs
		.filter(log => log.address.toLowerCase() == POOL_ADDRESS.toLowerCase())
		.map(log => pool.interface.parseLog(log))
		.filter(log => log?.name == 'Supply' || log?.name == 'Borrow' || log?.name == 'Withdraw' || log?.name == 'Repay')

	const allAssetsData = await fetchAllAssetsData(txEvent.from, pool, oracle, provider)

	const slackMessages = preFilteredLogs
		.filter(log => log && calculateDollarValueInCents(allAssetsData, log.args.amount, log.args.reserve) > BigInt(100000000)) // value bigger than $1.000.000 in cents
		.map(log => log && formatProtocolInteractionAlertMessage(log, txEvent, allAssetsData)) as string[]

	await sendMessagesToSlack(slackMessages, context, 'TEST_SLACK_WEBHOOK_URL')
}

const formatProtocolInteractionAlertMessage = (
	log: LogDescription,
	txEvent: TransactionEvent,
	allAssetsData: AssetsData,
) => {
	return `\`\`\`
${log.name.toUpperCase()}: ${formatAssetAmount(allAssetsData, log.args.reserve, log.args.amount)}
USER:${' '.repeat(log.name.length - 3)}${shortenAddress(txEvent.from)}
POOL:${' '.repeat(log.name.length - 3)}${createPoolStateOutline(allAssetsData[log.args.reserve])}

${createPositionOutlineForUser(allAssetsData)}

${createEtherscanTxLink(txEvent.hash)}\`\`\``
}
