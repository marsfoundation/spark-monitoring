import {
    ActionFn,
    Context,
    Event
} from '@tenderly/actions'

import { Contract } from 'ethers'

import { dsrAuthOracleAbi, potAbi } from './abis'

import { createMainnetProvider, createProvider, /*sendMessagesToPagerDuty,*/ sendMessagesToSlack } from './utils'

const MAKER_POT = '0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7' as const
const OPTIMISM_DSR_AUTH_ORACLE = '0x33a3aB524A43E69f30bFd9Ae97d1Ec679FF00B64' as const
const BASE_DSR_AUTH_ORACLE = '0x2Dd2a2Fe346B5704380EfbF6Bd522042eC3E8FAe' as const
const ARBITRUM_DSR_AUTH_ORACLE = '0xE206AEbca7B28e3E8d6787df00B010D4a77c32F3' as const

const DISCREPANCY_TIME_THRESHOLD = 1_800_000 as const  // 30 minutes in milliseconds

export const getPotDsrDataSync: ActionFn = async (context: Context, _: Event) => {

    const mainnet = await createMainnetProvider(context)
    const optimism = await createProvider(context, 'OPTIMISM_RPC_URL')
    const base = await createProvider(context, 'BASE_RPC_URL')
    const arbitrum = await createProvider(context, 'ARBITRUM_RPC_URL')

    const pot = new Contract(MAKER_POT, potAbi, mainnet)
    const optimismDsrAuthOracle = new Contract(OPTIMISM_DSR_AUTH_ORACLE, dsrAuthOracleAbi, optimism)
    const baseDsrAuthOracle = new Contract(BASE_DSR_AUTH_ORACLE, dsrAuthOracleAbi, base)
    const arbitrumDsrAuthOracle = new Contract(ARBITRUM_DSR_AUTH_ORACLE, dsrAuthOracleAbi, arbitrum)

    const mainnetDsr = await pot.dsr()
    console.log({mainnetDsr})

    const [ optimismDsr ] = await optimismDsrAuthOracle.getPotData()
    console.log({optimismDsr})
    const [ baseDsr ] = await baseDsrAuthOracle.getPotData()
    console.log({baseDsr})
    const [ arbitrumDsr ] = await arbitrumDsrAuthOracle.getPotData()
    console.log({arbitrumDsr})

    const executionTimestamp = new Date().getTime()

    mainnetDsr != optimismDsr && await handleDsrDiscrepancy('Optimism', mainnetDsr, optimismDsr, executionTimestamp, context)
    mainnetDsr != baseDsr && await handleDsrDiscrepancy('Base', mainnetDsr, baseDsr, executionTimestamp, context)
    mainnetDsr != arbitrumDsr && await handleDsrDiscrepancy('Arbitrum', mainnetDsr, arbitrumDsr, executionTimestamp, context)
}

const handleDsrDiscrepancy = async (
    domainName: string,
    mainnetDsr: bigint,
    foreignDsr: bigint,
    executionTimestamp: number,
    context: Context,
) => {
    const lastDiscrepancyReportTime = (await context.storage.getNumber(`getPotDsrDataSync-${domainName}`)) || 0

    // If the last discrepancy was more than twice the threshold ago, treat this as a new discrepancy record
    const lastDiscrepancyInterval = executionTimestamp - lastDiscrepancyReportTime > 2 * DISCREPANCY_TIME_THRESHOLD ? 0 : executionTimestamp - lastDiscrepancyReportTime

    console.log(`Discrepancy observed on ${domainName}`)
    const messages = [`\`\`\`
🚨🔮🏛️ DSR ORACLE DISCREPANCY (${domainName.toUpperCase()}) 🚨🔮🏛️

🏛️ Mainnet DSR: ${mainnetDsr.toString()}
🔮 ${domainName} DSR: ${foreignDsr.toString()}\`\`\``]

    if (lastDiscrepancyInterval == 0) {
        await context.storage.putNumber(`getPotDsrDataSync-${domainName}`, executionTimestamp)
    }

    if (lastDiscrepancyInterval > DISCREPANCY_TIME_THRESHOLD) {
        await context.storage.putNumber(`getPotDsrDataSync-${domainName}`, executionTimestamp)
        console.log(`Sending an alert about ${domainName} DSR discrepancy`)
        await sendMessagesToSlack(messages, context, 'SPARKLEND_ALERTS_SLACK_WEBHOOK_URL')
        // TEMPORARILY DISABLED
        // await sendMessagesToPagerDuty(messages, context)
    }

}
