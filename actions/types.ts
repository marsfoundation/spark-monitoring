import { providers } from 'ethers';

export type TenderlyFork = {
    block_number?: number;
    network_id: string;
    initial_balance?: number;
  };

export type EthersOnTenderlyFork = {
id: number;
provider: providers.JsonRpcProvider;
blockNumber: number;
};
