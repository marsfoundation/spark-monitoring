import {
	ActionFn,
	Context,
	Event,
	TransactionEvent,
} from '@tenderly/actions';

import { simulateTransactionBundle } from './apis';

import PoolAbi from '../jsons/pool-abi.json';

import { deployedBytecode as HealthCheckerBytecode } from '../jsons/SparkLendHealthChecker.json';

const ethers = require('ethers');

export const action1: ActionFn = async (context: Context, event: Event) => {
	let txEvent = event as TransactionEvent;

	const POOL_ADDRESS = "0xC13e21B648A5Ee794902342038FF3aDAB66BE987";

	const pool = new ethers.Contract(POOL_ADDRESS, PoolAbi);

	const filteredLogs = txEvent.logs.filter(log => {
		if (log.address !== POOL_ADDRESS) return;

		try {
			return pool.interface.parseLog(log);
		} catch (e) {
			// console.log(e);
		}
	});

	let users: Array<string> = [];

	filteredLogs.forEach(log => {
		const parsedLog = pool.interface.parseLog(log).args;
		if (parsedLog.user) {
			users.push(parsedLog.user); // Correct property name here
		}
	});

	users.push(txEvent.from);

	// Remove duplicates
	users = [...new Set(users)];

	const token = await context.secrets.get('TENDERLY_ACCESS_KEY');

	await simulateTransactionBundle(token, [
		{
			// Standard EVM Transaction object
			from: '0xdc6bdc37b2714ee601734cf55a05625c9e512461',
			to: '0x6b175474e89094c44da98b954eedeac495271d0f',
			input:
			  '0x095ea7b3000000000000000000000000f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1000000000000000000000000000000000000000000000000000000000000012b',
		},
	],
		{
			"0xe2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2": {
				code: HealthCheckerBytecode.object,
			}
		}
	);
}
