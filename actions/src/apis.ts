import axios from 'axios';

import { TenderlyFork, EthersOnTenderlyFork } from './types';

const ethers = require('ethers');

export async function createTenderlyFork(
  tenderlyToken: string,
  fork: TenderlyFork
): Promise<EthersOnTenderlyFork> {
  console.log("ENTERED FUNCTION");

  const projectUrl = `account/phoenixlabs/project/sparklend`;

  console.log({projectUrl})

  const axiosOnTenderly = axios.create({
    baseURL: 'https://api.tenderly.co/api/v1',
    headers: {
      'X-Access-Key': tenderlyToken,
      'Content-Type': 'application/json',
    },
  });

  const forkResponse = await axiosOnTenderly.post(`${projectUrl}/fork`, fork);
  const forkId = forkResponse.data.root_transaction.fork_id;

  const provider = new ethers.providers.JsonRpcProvider(
    `https://rpc.tenderly.co/fork/${forkId}`
  );

  const bn = (
    forkResponse.data.root_transaction.receipt.blockNumber as string
  ).replace('0x', '');
  const blockNumber: number = Number.parseInt(bn, 16);

  console.info(
    `\nForked with fork id ${forkId} at block number ${blockNumber}\nhttps://dashboard.tenderly.co/phoenixlabs/sparklend/fork/${forkId}\n`
  );

  return {
    provider,
    id: forkId,
    blockNumber
  };
}

export async function simulateTransactionBundle(
  tenderlyToken: string,
  transactionBundle: any[],
  simulationConfig?: any
): Promise<any> { // Adjust return type as needed
  console.log("ENTERED FUNCTION");

  const fullTransactionData = transactionBundle.map(tx => {
    return {
      // Simulation Configuration
      save: true, // if true simulation is saved and shows up in the dashboard
      save_if_fails: false, // if true, reverting simulations show up in the dashboard
      simulation_type: 'full', // full or quick (full is default)

      network_id: '1', // network to simulate on

      // Standard EVM Transaction object
      gas: 8000000,
      gas_price: 0,
      value: 0,
      ...tx
    }
  })

  console.log({tenderlyToken})

  const response = await axios.post(
    `https://api.tenderly.co/api/v1/account/phoenixlabs/project/sparklend/simulate-bundle`,
    {
      simulations: fullTransactionData,
      simulationConfig
    },
    {
      headers: {
        'X-Access-Key': tenderlyToken as string,
      },
    },
  );



  console.log(JSON.stringify(response.data, null, 2))
}
