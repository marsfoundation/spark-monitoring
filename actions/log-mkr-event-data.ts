import {
	ActionFn,
	Context,
	Event,
	TransactionEvent,
} from '@tenderly/actions';

const ethers = require('ethers');

// DefaultTransactionEvent {
// 	network: '1',
// 	blockHash: '0x64d4702e7dfab031c64d8e90f01dcc5c084542ad2473ce07b3f85570be7bef1a',
// 	blockNumber: 18628280,
// 	from: '0xdfd5293d8e347dfe59e90efd55b2956a1343963d',
// 	hash: '0x9ede1cfb0ca50c40d5269be5ff25ebc22fa9464556291eec130f97ad7908d5ac',
// 	to: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
// 	logs: [
// 	  {
// 		address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
// 		data: '0x00000000000000000000000000000000000000000000000070282093afea3c00',
// 		topics: [Array]
// 	  }
// 	],
// 	input: '0xa9059cbb000000000000000000000000f778aaf587aadad9e9015c36955d14f6eb96873400000000000000000000000000000000000000000000000070282093afea3c00',
// 	value: '0x',
// 	nonce: '0x741532',
// 	gas: '0x32918',
// 	gasUsed: '0xd44e',
// 	cumulativeGasUsed: '0x40ffd2',
// 	gasPrice: '0x0e5620dd3b',
// 	gasTipCap: '0x77359400',
// 	gasFeeCap: '0x17bfac7c00',
// 	transactionHash: '0x9ede1cfb0ca50c40d5269be5ff25ebc22fa9464556291eec130f97ad7908d5ac'
//   }


// DefaultContext {
// 	gateways: DefaultGateways {
// 	  gatewaysService: GatewaysService { gatewayConfigs: [Array] }
// 	},
// 	secrets: DefaultSecrets { secrets: undefined },
// 	storage: DefaultStorage {
// 	  storageService: StorageService {
// 		baseUrl: 'https://storage.tenderly.co/api',
// 		storageId: '86528fd3-5219-4a2b-aa94-5ac1c1338cfd',
// 		token: '451abf6b-6bc1-4976-8162-1f8fc4b3aded'
// 	  }
// 	}
//   }


// DefaultTransactionEvent {
// 	network: '1',
// 	blockHash: '0x64d4702e7dfab031c64d8e90f01dcc5c084542ad2473ce07b3f85570be7bef1a',
// 	blockNumber: 18628280,
// 	from: '0xdfd5293d8e347dfe59e90efd55b2956a1343963d',
// 	hash: '0x9ede1cfb0ca50c40d5269be5ff25ebc22fa9464556291eec130f97ad7908d5ac',
// 	to: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
// 	logs: [
// 	  {
// 		address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
// 		data: '0x00000000000000000000000000000000000000000000000070282093afea3c00',
// 		topics: [Array]
// 	  }
// 	],
// 	input: '0xa9059cbb000000000000000000000000f778aaf587aadad9e9015c36955d14f6eb96873400000000000000000000000000000000000000000000000070282093afea3c00',
// 	value: '0x',
// 	nonce: '0x741532',
// 	gas: '0x32918',
// 	gasUsed: '0xd44e',
// 	cumulativeGasUsed: '0x40ffd2',
// 	gasPrice: '0x0e5620dd3b',
// 	gasTipCap: '0x77359400',
// 	gasFeeCap: '0x17bfac7c00',
// 	transactionHash: '0x9ede1cfb0ca50c40d5269be5ff25ebc22fa9464556291eec130f97ad7908d5ac'
//   }

export const logEvent: ActionFn = async (context: Context, event: Event) => {
	let txEvent = event as TransactionEvent;
	console.log(txEvent);
	console.log(context);
	console.log(event);

	console.log({from: txEvent.from});

	const abi = ["event Transfer(address indexed from, address indexed to, uint256 value)"];

	const mkr = new ethers.Contract('0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', abi);

	const filteredLogs = txEvent.logs.filter(log =>
		mkr.interface.parseLog(log).name === 'Transfer'
	);

	filteredLogs.forEach(log => {
		console.log(mkr.interface.parseLog(log).args); // Contains the decoded data for Transfer event
	});
}

