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
  });;

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
