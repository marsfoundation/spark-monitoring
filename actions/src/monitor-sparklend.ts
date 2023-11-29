import {
	ActionFn,
	Context,
	Event,
	TransactionEvent,
} from '@tenderly/actions';

const axios = require('axios');

import PoolAbi from '../jsons/pool-abi.json';

import { abi as healthCheckerAbi } from '../jsons/SparkLendHealthChecker.json';

// import { deployedBytecode as HealthCheckerBytecode } from '../jsons/SparkLendHealthChecker.json';

const ethers = require('ethers');

export const getUserInfoSparkLend: ActionFn = async (context: Context, event: Event) => {
	let txEvent = event as TransactionEvent;

	// 1. Define contracts

	const POOL_ADDRESS = "0xC13e21B648A5Ee794902342038FF3aDAB66BE987";
	const HEALTH_CHECKER = "0xfda082e00EF89185d9DB7E5DcD8c5505070F5A3B";

	const pool = new ethers.Contract(POOL_ADDRESS, PoolAbi);

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
		// return userHealth.belowLiquidationThreshold;
		return true;  // Return true for testing purposes
	});

	if (usersBelowLT.length === 0) {
		console.log("No users below liquidation threshold");
		return;
	}

	// 6. Generate messages for each user below liquidation threshold

	const usersBelowLTMessages = usersBelowLT.map(userHealth => {
		return formatUserHealthAlertMessage(userHealth, txEvent);
	})

	// 7. Send messages to Slack

	const slackWebhookUrl = await context.secrets.get('SLACK_WEBHOOK_URL');

	const slackResponses = await Promise.all(usersBelowLTMessages.map(async (message) => {
		await axios.post(slackWebhookUrl, { text: message });
	}))

	for (const slackResponse of slackResponses) {
		console.log(slackResponse);
	}

	// 8. Send messages to PagerDuty

	const testPagerDuty = await context.secrets.get('TEST_PAGERDUTY');

	if (testPagerDuty === 'false') {
		console.log("Test PagerDuty is false, not sending PagerDuty alerts");
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

	const pagerDutyResponses = await Promise.all(usersBelowLTMessages.map(async (message) => {
		data.payload.summary = message;
		await axios.post('https://events.pagerduty.com/v2/enqueue', data, { headers });
	}));

	for (const pagerDutyResponse of pagerDutyResponses) {
		console.log(pagerDutyResponse);
	}
}

export const getAllReservesAssetLiabilitySparkLend: ActionFn = async (context: Context, event: Event) => {
	let txEvent = event as TransactionEvent;

	// 1. Define contracts

	const HEALTH_CHECKER = "0xfda082e00EF89185d9DB7E5DcD8c5505070F5A3B";
	const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";

	const url = await context.secrets.get('ETH_RPC_URL');

	const provider = new ethers.providers.JsonRpcProvider(url);

	const healthChecker = new ethers.Contract(HEALTH_CHECKER, healthCheckerAbi, provider);

	const getAllReservesAssetLiabilityResponse = await healthChecker.getAllReservesAssetLiability();

	var messages = [];

	for (const reserveInfo of getAllReservesAssetLiabilityResponse) {
		if (reserveInfo.reserve === DAI) {

		}

		const diff = BigInt(reserveInfo.assets) - BigInt(reserveInfo.liabilities);

		// Check that the absolute value of the difference is less than 1000
		// if (diff < 1000n && diff > -1000n) {
		if (diff > 100000000000000000000000000000000000n ) {
			return;
		}

		messages.push(formatAssetLiabilityAlertMessage({...reserveInfo, diff}, txEvent));
	}

	const slackWebhookUrl = await context.secrets.get('SLACK_WEBHOOK_URL');

	const slackResponses = await Promise.all(messages.map(async (message) => {
		await axios.post(slackWebhookUrl, { text: message });
	}))

	for (const slackResponse of slackResponses) {
		console.log(slackResponse);
	}

	const testPagerDuty = await context.secrets.get('TEST_PAGERDUTY');

	if (testPagerDuty === 'false') {
		console.log("Test PagerDuty is false, not sending PagerDuty alerts");
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

const formatAssetLiabilityAlertMessage = (reserveInfo: any, txEvent: any) => {
	return `
\`\`\`
🚨🚨🚨 ASSET/LIABILITY ALERT 🚨🚨🚨
Reserve ${reserveInfo.reserve} has a difference between assets and liabilities of ${BigInt(reserveInfo.diff).toString()}.

Discovered at block ${txEvent.blockNumber}.

Assets:      ${BigInt(reserveInfo.assets).toString()}
Liabilities: ${BigInt(reserveInfo.liabilities).toString()}
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

Total Collateral (USD 8 dec): ${BigInt(userHealth.totalCollateralBase).toString()}
Total Debt (USD 8 dec):       ${BigInt(userHealth.totalDebtBase).toString()}
LT (BPS):                     ${BigInt(userHealth.currentLiquidationThreshold).toString()}
LTV (BPS):                    ${BigInt(userHealth.ltv).toString()}
Health Factor:                ${BigInt(userHealth.healthFactor).toString()}
\`\`\`
	`
}
