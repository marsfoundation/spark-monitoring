import {
	ActionFn,
	Context,
	Event,
	TransactionEvent,
} from '@tenderly/actions';

const axios = require('axios');

import poolAbi from '../jsons/pool-abi.json';
import oracleAbi from '../jsons/oracle-abi.json';
import erc20Abi from '../jsons/erc20-abi.json';

import { abi as healthCheckerAbi } from '../jsons/SparkLendHealthChecker.json';

const ethers = require('ethers');

export const getUserInfoSparkLend: ActionFn = async (context: Context, event: Event) => {
	let txEvent = event as TransactionEvent;

	// 1. Define contracts

	const POOL_ADDRESS = "0xC13e21B648A5Ee794902342038FF3aDAB66BE987";
	const HEALTH_CHECKER = "0xfda082e00EF89185d9DB7E5DcD8c5505070F5A3B";

	const pool = new ethers.Contract(POOL_ADDRESS, poolAbi);

	// 2. Filter events logs to get all pool logs

	const filteredLogs = txEvent.logs.filter(log => {
		if (log.address !== POOL_ADDRESS) return;

		try {
			return pool.interface.parseLog(log);
		} catch (e) {
			// console.log(e);
		}
	});

	// 3. Get all `user` properties from logs, from all events that users adjust positions

	let users: Array<string> = [];

	filteredLogs.forEach(log => {
		const parsedLog = pool.interface.parseLog(log).args;
		if (parsedLog.user) {
			users.push(parsedLog.user);
		}
	});

	users.push(txEvent.from);
	users = [...new Set(users)];  // Remove duplicates

	// 4. Get health of all users

	const url = await context.secrets.get('ETH_RPC_URL');

	const provider = new ethers.providers.JsonRpcProvider(url);

	const healthChecker = new ethers.Contract(HEALTH_CHECKER, healthCheckerAbi, provider);

	const userHealths = await Promise.all(users.map(async (user) => {
		return {
			user,
			...await healthChecker.getUserHealth(user)
		}
	}));

	console.log({users})
	console.log({userHealths})

	// 5. Filter userHealths to only users below liquidation threshold, exit if none

	const usersBelowLT = userHealths.filter(userHealth => {
		// return userHealth.healthFactor < 2e18;  // TESTING
		return userHealth.belowLiquidationThreshold;
		// return true;  // UNCOMMENT AND REPLACE FOR TESTING
	});

	if (usersBelowLT.length === 0) {
		console.log("No users below liquidation threshold");
		return;
	}

	// 6. Generate messages for each user below liquidation threshold and send to Slack and PagerDuty

	const messages = usersBelowLT.map(userHealth => {
		return formatUserHealthAlertMessage(userHealth, txEvent);
	})

	if (messages.length === 0) return;

	await sendMessagesToSlack(messages, context);

	await sendMessagesToPagerDuty(messages, context);
}

export const getAllReservesAssetLiabilitySparkLend: ActionFn = async (context: Context, event: Event) => {
	let txEvent = event as TransactionEvent;

	const HEALTH_CHECKER = "0xfda082e00EF89185d9DB7E5DcD8c5505070F5A3B";
	const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
	const ORACLE = "0x8105f69D9C41644c6A0803fDA7D03Aa70996cFD9";

	const url = await context.secrets.get('ETH_RPC_URL');

	const provider = new ethers.providers.JsonRpcProvider(url);

	const healthChecker = new ethers.Contract(HEALTH_CHECKER, healthCheckerAbi, provider);
	const oracle = new ethers.Contract(ORACLE, oracleAbi, provider);

	const getAllReservesAssetLiabilityResponse = await healthChecker.getAllReservesAssetLiability();

	var messages = [];

	for (const reserveInfo of getAllReservesAssetLiabilityResponse) {
		const diff = BigInt(reserveInfo.assets) - BigInt(reserveInfo.liabilities);
		const price = await oracle.getAssetPrice(reserveInfo.reserve);
		const usdDiff = diff * BigInt(price) / BigInt(10 ** 18);

		var MAX_DIFF = 1_000 * 10 ** 8;  // 1k USD diff to trigger alert

		if (reserveInfo.reserve.toLowerCase() === DAI.toLowerCase()) {
			MAX_DIFF = 300_000 * 10 ** 8;
		}

		// Check that the absolute value of the difference is less than the max diff
		if (usdDiff < MAX_DIFF && usdDiff > -MAX_DIFF) {
			continue;  // COMMENT OUT FOR TESTING
		}

		messages.push(await formatAssetLiabilityAlertMessage({...reserveInfo, diff, usdDiff, price}, txEvent, provider));
	}

	if (messages.length === 0) return;

	await sendMessagesToSlack(messages, context);

	await sendMessagesToPagerDuty(messages, context);
}

export const getProtocolInteraction: ActionFn = async (context: Context, event: Event) => {
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

	const valueFilteredLogs = filteredParsedPoolLogs
		.filter(log =>
			BigInt(log.args.amount)
				* BigInt(priceSheet[log.args.reserve])
				/ BigInt(10**decimalsSheet[log.args.reserve])
				/ BigInt(10**8)
			> BigInt(10000/*00*/)
		)

		console.log({valueFilteredLogs})

	// for each item from valueFilteredLogs send a Slack message
}

const sendMessagesToSlack = async (messages: Array<string>, context: Context) => {
	const slackWebhookUrl = await context.secrets.get('SLACK_WEBHOOK_URL');

	const slackResponses = await Promise.all(messages.map(async (message) => {
		await axios.post(slackWebhookUrl, { text: message });
	}))

	for (const slackResponse of slackResponses) {
		console.log(slackResponse);
	}
}

const sendMessagesToPagerDuty = async (messages: Array<string>, context: Context) => {
	const deactivatePagerDuty = await context.secrets.get('DEACTIVATE_PAGERDUTY');

	if (deactivatePagerDuty === 'true') {
		console.log("PagerDuty deactivated");
		return;
	}

	const pagerDutyRoutingKey = await context.secrets.get('PAGERDUTY_ROUTING_KEY');

	const headers = {
	  'Content-Type': 'application/json',
	};

	const data = {
	  payload: {
		summary: "",
		severity: 'critical',
		source: 'Alert source',
	  },
	  routing_key: pagerDutyRoutingKey,
	  event_action: 'trigger',
	};

	const pagerDutyResponses = await Promise.all(messages.map(async (message) => {
		data.payload.summary = message;
		await axios.post('https://events.pagerduty.com/v2/enqueue', data, { headers });
	}));

	for (const pagerDutyResponse of pagerDutyResponses) {
		console.log(pagerDutyResponse);
	}
}

const formatAssetLiabilityAlertMessage = async (reserveInfo: any, txEvent: any, provider: any) => {
	const tokenAbi = ["function symbol() view returns (string)"];

	const token = new ethers.Contract(reserveInfo.reserve, tokenAbi, provider);

	const tokenSymbol = await token.symbol();

	// 8 decimal representation
	const usdAssets = BigInt(reserveInfo.assets) * BigInt(reserveInfo.price) / BigInt(10 ** 18);
	const usdLiabilities = BigInt(reserveInfo.liabilities) * BigInt(reserveInfo.price) / BigInt(10 ** 18);

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

function formatBigInt(value: any, decimals: any) {
    const integerPart = BigInt(value) / BigInt(10 ** decimals);
    const fractionalPart = BigInt(value) % BigInt(10 ** decimals);
    const fractionalString = fractionalPart.toString().padStart(decimals, '0');
    return `${integerPart}.${fractionalString}`;
}
