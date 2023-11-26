import { simulateTransactionBundle } from './apis';

import * as dotenv from "dotenv";

import { deployedBytecode as HealthCheckerBytecode } from '../jsons/SparkLendHealthChecker.json';

dotenv.config();

const main = async() => {
	const token = process.env.TENDERLY_ACCESS_KEY!;

    console.log({token})

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

main();
