import {
    ActionFn,
    Context,
    Event,
    TransactionEvent,
} from '@tenderly/actions'

import { Contract } from 'ethers'

import { dsrAuthOracleAbi } from './abis'

import { createMainnetProvider, formatDsr, formatTimestamp, sendMessagesToSlack, transactionAlreadyProcessed } from './utils'

const getDSRAuthOracleRefresh = (domainName: string, dsrAuthOracleAddress: string, explorerTxLink: string): ActionFn  => async (context: Context, event: Event) => {
    const transactionEvent = event as TransactionEvent

    if (await transactionAlreadyProcessed(`getDSRAuthOracleRefresh-${domainName}`, context, transactionEvent)) return

    const provider = await createMainnetProvider(context)
    const dsrAuthOracle = new Contract(dsrAuthOracleAddress, dsrAuthOracleAbi, provider)

    const log = transactionEvent.logs
        .filter(log => log.address.toLowerCase() == dsrAuthOracleAddress.toLowerCase())
        .map(log => dsrAuthOracle.interface.parseLog(log))
        .filter(log => log && log.name === 'SetPotData')
        .slice(-1)[0]

        console.log(log)

    if(log) {
        const message = [`\`\`\`
🔮💰 DSR Oracle refreshed on ${domainName} 🔮💰
dsr: ${formatDsr(log.args[0][0].toString())}
chi: ${log.args[0][1].toString()}
rho: ${formatTimestamp(Number(log.args[0][2]))}

${explorerTxLink.replace('<TX_HASH>', transactionEvent.hash)}\`\`\``]

        await sendMessagesToSlack(message, context, 'SPARKLEND_INFO_SLACK_WEBHOOK_URL')
    }
}

export const getDSRAuthOracleRefreshArbitrum = getDSRAuthOracleRefresh('Arbitrum', '0xE206AEbca7B28e3E8d6787df00B010D4a77c32F3', 'https://arbiscan.io/tx/<TX_HASH>')
export const getDSRAuthOracleRefreshBase = getDSRAuthOracleRefresh('Base', '0x2Dd2a2Fe346B5704380EfbF6Bd522042eC3E8FAe', 'https://basescan.org/tx/<TX_HASH>')
export const getDSRAuthOracleRefreshOptimism = getDSRAuthOracleRefresh('Optimism', '0x33a3aB524A43E69f30bFd9Ae97d1Ec679FF00B64', 'https://optimistic.etherscan.io/tx/<TX_HASH>')
