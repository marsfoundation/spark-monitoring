import {
	ActionFn,
	Context,
	Event,
	TransactionEvent,
} from '@tenderly/actions';

// import { createTenderlyFork } from './fork';

import PoolAbi from './abis/pool-abi.json';

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

	console.log({users});
}

// pool.interface.parseLog(log).name == "MintUnbacked" ||
// pool.interface.parseLog(log).name == "BackUnbacked" ||
// pool.interface.parseLog(log).name == "Supply" ||
// pool.interface.parseLog(log).name == "Withdraw" ||
// pool.interface.parseLog(log).name == "Borrow" ||
// pool.interface.parseLog(log).name == "Repay" ||
// pool.interface.parseLog(log).name == "SwapBorrowRateMode" ||
// pool.interface.parseLog(log).name == "IsolationModeTotalDebtUpdated" ||
// pool.interface.parseLog(log).name == "UserEModeSet" ||
// pool.interface.parseLog(log).name == "ReserveUsedAsCollateralEnabled" ||
// pool.interface.parseLog(log).name == "ReserveUsedAsCollateralDisabled" ||
// pool.interface.parseLog(log).name == "RebalanceStableBorrowRate" ||
// pool.interface.parseLog(log).name == "FlashLoan" ||
// pool.interface.parseLog(log).name == "LiquidationCall" ||
// pool.interface.parseLog(log).name == "ReserveDataUpdated" ||
// pool.interface.parseLog(log).name == "MintedToTreasury"


// const event = {
	// 	network: '1',
	// 	blockHash: '0x4a7f1c3222fdb4e7ca3f3b01deade67323bd7989b5171d766cbdc9c37b3de034',
	// 	blockNumber: 18634974,
	// 	from: '0x3c9Ea5C4Fec2A77E23Dd82539f4414266Fe8f757',
	// 	hash: '0x6147711f330db7f12bee12b3726cb5411b5b7aa776cea925f984a48120955575',
	// 	to: '0xC13e21B648A5Ee794902342038FF3aDAB66BE987',
	// 	logs: [
	// 	  {
	// 		address: '0xf705d2B7e92B3F38e6ae7afaDAA2fEE110fE5914',
	// 		data: '0x00000000000000000000000000000000000000000001aa234ec0e102dade9b63',
	// 		topics: [Array]
	// 	  },
	// 	  {
	// 		address: '0xf705d2B7e92B3F38e6ae7afaDAA2fEE110fE5914',
	// 		data: '0x00000000000000000000000000000000000000000001aa234ec0e102dade9b6300000000000000000000000000000000000000000000029f1723472798de9b630000000000000000000000000000000000000000034d4d6a95cba6f4f9a2249b',
	// 		topics: [Array]
	// 	  },
	// 	  {
	// 		address: '0xC13e21B648A5Ee794902342038FF3aDAB66BE987',
	// 		data: '0x000000000000000000000000000000000000000000267dc697fd352f26b4dafe00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002c7e82a503c0ccaf41b000000000000000000000000000000000000000000003485c3bda12e13d7b70dc4d0000000000000000000000000000000000000000034d4d6a95cba6f4f9a2249b',
	// 		topics: [Array]
	// 	  },
	// 	  {
	// 		address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
	// 		data: '0x00000000000000000000000000000000000000000001a784379d99db42000000',
	// 		topics: [Array]
	// 	  },
	// 	  {
	// 		address: '0xC13e21B648A5Ee794902342038FF3aDAB66BE987',
	// 		data: '0x0000000000000000000000003c9ea5c4fec2a77e23dd82539f4414266fe8f75700000000000000000000000000000000000000000001a784379d99db4200000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000002c7e82a503c0ccaf41b000',
	// 		topics: [Array]
	// 	  }
	// 	],
	// 	input: '0xa415bcad0000000000000000000000006b175474e89094c44da98b954eedeac495271d0f00000000000000000000000000000000000000000001a784379d99db42000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000003c9ea5c4fec2a77e23dd82539f4414266fe8f757',
	// 	value: '0x0',
	// 	nonce: '0x709',
	// 	gas: '0x7264f',
	// 	gasUsed: '0x558f8',
	// 	cumulativeGasUsed: '0x7d0212',
	// 	gasPrice: '0x83b1f484f',
	// 	gasTipCap: '0x5f5e100',
	// 	gasFeeCap: '0xb623c7d13',
	// 	transactionHash: '0x6147711f330db7f12bee12b3726cb5411b5b7aa776cea925f984a48120955575'
	//   }

	// {
	// 	gateways: DefaultGateways {
	// 	  gatewaysService: GatewaysService { gatewayConfigs: [Array] }
	// 	},
	// 	secrets: DefaultSecrets {
	// 	  secrets: { TENDERLY_ACCESS_KEY: '***REDACTED***' }
	// 	},
	// 	storage: DefaultStorage {
	// 	  storageService: StorageService {
	// 		baseUrl: 'https://storage.tenderly.co/api',
	// 		storageId: '6fbbf406-649c-44a3-b381-7ce42ee51026',
	// 		token: '8518b077-f75a-4d92-a737-48bf4ee2962f'
	// 	  }
	// 	}
	//   }
