import {
	ActionFn,
	Context,
	Event,
	TransactionEvent,
} from '@tenderly/actions';

import {
	poolAbi,
	oracleAbi,
	erc20Abi,
} from './abis';

import { formatBigInt } from './utils';

const axios = require('axios');
const ethers = require('ethers');

export const getSparklendInteraction: ActionFn = async (context: Context, event: Event) => {
	let txEvent = event as TransactionEvent;

	const rpcUrl = await context.secrets.get('ETH_RPC_URL');
	const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

	const POOL_ADDRESS = "0xC13e21B648A5Ee794902342038FF3aDAB66BE987";
	const pool = new ethers.Contract(POOL_ADDRESS, poolAbi);

	const ORACLE_ADDRESS = "0x8105f69D9C41644c6A0803fDA7D03Aa70996cFD9";
	const oracle = new ethers.Contract(ORACLE_ADDRESS, oracleAbi, provider);

	const filteredParsedPoolLogs = txEvent.logs
		.filter(log => log.address.toLowerCase() == POOL_ADDRESS.toLowerCase())
		.map(log => pool.interface.parseLog(log))
		.filter(log => log.name == 'Supply' || log.name == 'Borrow' || log.name == 'Withdraw' || log.name == 'Repay')

	const usedAssets = [...new Set(filteredParsedPoolLogs.map(log=> log.args.reserve))]

	const prices = await Promise.all(usedAssets.map(async asset => await oracle.getAssetPrice(asset)))
	const priceSheet = usedAssets.reduce(( sheet, asset, index ) => ( sheet[asset] = prices[index] , sheet), {})

	const decimals = await Promise.all(usedAssets.map(async asset => await new ethers.Contract(asset, erc20Abi, provider).decimals()))
	const decimalsSheet = usedAssets.reduce(( sheet, asset, index ) => ( sheet[asset] = decimals[index] , sheet), {})

	const symbols = await Promise.all(usedAssets.map(async asset => await new ethers.Contract(asset, erc20Abi, provider).symbol()))
	const symbolsSheet = usedAssets.reduce(( sheet, asset, index ) => ( sheet[asset] = symbols[index] , sheet), {})

	const formattedActions = filteredParsedPoolLogs
		.map(log => ({
			value: BigInt(log.args.amount) // value in USD cents
				* BigInt(priceSheet[log.args.reserve])
				/ BigInt(10 ** decimalsSheet[log.args.reserve])
				/ BigInt(10 ** 6), // dividing by 10 ** 6, not 10 ** 8 because we want the result in USD cents
			message: formatProtocolInteractionAlertMessage(
				log,
				txEvent,
				decimalsSheet,
				priceSheet,
				symbolsSheet,
			)
		}))


	console.log(formattedActions.map(action => action.message))

	const filteredActions = formattedActions
		.filter(action => action.value > BigInt(100000000)) // value bigger than $1.000.000 in cents

	console.log(filteredActions.map(action => action.message))

	const slackWebhookUrl = await context.secrets.get('SPARKLEND_ALERTS_SLACK_WEBHOOK_URL');

	const slackResponses = await Promise.all(filteredActions.map(async (action) => {
		await axios.post(slackWebhookUrl, { text: action.message });
	}))

	for (const slackResponse of slackResponses) {
		console.log(slackResponse);
	}
}

const formatProtocolInteractionAlertMessage = (log: any, txEvent: TransactionEvent, decimalsSheet: any, priceSheet: any, symbolsSheet: any) => {
	return `
\`\`\`
${log.name.toUpperCase()}

Account ${txEvent.from} performed a ${log.name.toLowerCase()} interaction.

Transaction hash: ${txEvent.hash}
(https://etherscan.io/tx/${txEvent.hash})

TRANSACTION DETAILS:
Asset:  ${symbolsSheet[log.args.reserve]} (${log.args.reserve})
Amount: ${formatBigInt(BigInt(log.args.amount), decimalsSheet[log.args.reserve])} ${symbolsSheet[log.args.reserve]}
Value:  $${formatBigInt(BigInt(log.args.amount)
	* BigInt(priceSheet[log.args.reserve])
	/ BigInt(10 ** decimalsSheet[log.args.reserve])
	/ BigInt(10 ** 6), 2)}
\`\`\`
	`
}
