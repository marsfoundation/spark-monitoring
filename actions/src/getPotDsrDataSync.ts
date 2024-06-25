import {
    ActionFn,
    Context,
    Event,
    PeriodicEvent
} from '@tenderly/actions'

import { Contract } from 'ethers'

import { dsrAuthOracleAbi, potAbi } from './abis'

import { createMainnetProvider, createProvider, sendMessagesToPagerDuty, sendMessagesToSlack } from './utils'

const MAKER_POT = '0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7' as const
const OPTIMISM_DSR_AUTH_ORACLE = '0x33a3aB524A43E69f30bFd9Ae97d1Ec679FF00B64' as const
const BASE_DSR_AUTH_ORACLE = '0x2Dd2a2Fe346B5704380EfbF6Bd522042eC3E8FAe' as const
const ARBITRUM_DSR_AUTH_ORACLE = '0xE206AEbca7B28e3E8d6787df00B010D4a77c32F3' as const

const DISCREPANCY_TIME_THRESHOLD = 600_000 as const  // 10 minutes in milliseconds

export const getPotDsrDataSync: ActionFn = async (context: Context, event: Event) => {
    const periodicEvent = event as PeriodicEvent

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

    mainnetDsr != optimismDsr && await handleDsrDiscrepancy('Optimism', mainnetDsr, optimismDsr, periodicEvent, context)
    mainnetDsr != baseDsr && await handleDsrDiscrepancy('Base', mainnetDsr, baseDsr, periodicEvent, context)
    mainnetDsr != arbitrumDsr && await handleDsrDiscrepancy('Arbitrum', mainnetDsr, arbitrumDsr, periodicEvent, context)

    await cleanUpStaleDiscrepancyRecord('Optimism', periodicEvent, context)
    await cleanUpStaleDiscrepancyRecord('Base', periodicEvent, context)
    await cleanUpStaleDiscrepancyRecord('Arbitrum', periodicEvent, context)
}

const handleDsrDiscrepancy = async (
    domainName: string,
    mainnetDsr: bigint,
    foreignDsr: bigint,
    periodicEvent: PeriodicEvent,
    context: Context,
) => {
    const lastDiscrepancyReportTime = (await context.storage.getNumber(`getPotDsrDataSync-${domainName}`)) || 0

    // If the last discrepancy was more than twice the threshold ago, treat this as a new discrepancy record
    const lastDiscrepancyInterval = periodicEvent.time.getTime() - lastDiscrepancyReportTime > 2 * DISCREPANCY_TIME_THRESHOLD ? 0 : periodicEvent.time.getTime() - lastDiscrepancyReportTime

    console.log(`Discrepancy observed on ${domainName}`)
    const messages = [`\`\`\`
🚨🔮🏛️ DSR ORACLE DISCREPANCY (${domainName.toUpperCase()}) 🚨🔮🏛️

🏛️ Mainnet DSR: ${mainnetDsr.toString()}
🔮 ${domainName} DSR: ${foreignDsr.toString()}\`\`\``]

    if (lastDiscrepancyInterval == 0) {
        await context.storage.putNumber(`getPotDsrDataSync-${domainName}`, periodicEvent.time.getTime())
    }

    if (lastDiscrepancyInterval > DISCREPANCY_TIME_THRESHOLD) {
        await context.storage.putNumber(`getPotDsrDataSync-${domainName}`, periodicEvent.time.getTime())
        console.log(`Sending an alert about ${domainName} DSR discrepancy`)
        await sendMessagesToPagerDuty(messages, context)
    }

    await sendMessagesToSlack(messages, context, 'SPARKLEND_ALERTS_SLACK_WEBHOOK_URL')
}

const cleanUpStaleDiscrepancyRecord = async (
    domainName: string,
    periodicEvent: PeriodicEvent,
    context: Context,
) => {
    const lastDiscrepancyReportTime = await context.storage.getNumber(`getPotDsrDataSync-${domainName}`) || 0

    if (lastDiscrepancyReportTime && periodicEvent.time.getTime() - lastDiscrepancyReportTime > 5 * DISCREPANCY_TIME_THRESHOLD) {
        console.log(`Cleaning the record of ${domainName} DSR discrepancy`)
        await context.storage.delete(`getPotDsrDataSync-${domainName}`)
    }
}
