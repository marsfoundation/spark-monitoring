import {
	ActionFn,
	Context,
	Event,
	TransactionEvent,
} from '@tenderly/actions';

import { createTenderlyFork } from './fork';

const ethers = require('ethers');

export const logEvent: ActionFn = async (context: Context, event: Event) => {
	let txEvent = event as TransactionEvent;

	console.log({from: txEvent.from});

	const abi = ["event Transfer(address indexed from, address indexed to, uint256 value)"];

	const mkr = new ethers.Contract('0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', abi);

	const filteredLogs = txEvent.logs.filter(log =>
		mkr.interface.parseLog(log).name === 'Transfer'
	);

	filteredLogs.forEach(log => {
		console.log(mkr.interface.parseLog(log).args); // Contains the decoded data for Transfer event
	});

	const token = await context.secrets.get('TENDERLY_ACCESS_KEY');

	await createTenderlyFork(token, { network_id: '1' })
}
