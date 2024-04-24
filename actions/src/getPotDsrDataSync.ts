import {
    ActionFn,
    Context,
    Event,
    PeriodicEvent
} from '@tenderly/actions'

import { Contract } from 'ethers'

import { dsrAuthOracleAbi, potAbi } from './abis'

import { createMainnetProvider, createProvider, sendMessagesToSlack } from './utils'

const MAKER_POT = '0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7' as const
const OPTIMISM_DSR_AUTH_ORACLE = '0x33a3aB524A43E69f30bFd9Ae97d1Ec679FF00B64' as const
const BASE_DSR_AUTH_ORACLE = '0x2Dd2a2Fe346B5704380EfbF6Bd522042eC3E8FAe' as const

const DISCREPANCY_TIME_THRESHOLD = 3_600_000 as const  // 1 hour in milliseconds

export const getPotDsrDataSync: ActionFn = async (context: Context, event: Event) => {
    const periodicEvent = event as PeriodicEvent

    const mainnet = await createMainnetProvider(context)
    const optimism = await createProvider(context, 'OPTIMISM_RPC_URL')
    const base = await createProvider(context, 'BASE_RPC_URL')

	const pot = new Contract(MAKER_POT, potAbi, mainnet)
    const optimismDsrAuthOracle = new Contract(OPTIMISM_DSR_AUTH_ORACLE, dsrAuthOracleAbi, optimism)
    const baseDsrAuthOracle = new Contract(BASE_DSR_AUTH_ORACLE, dsrAuthOracleAbi, base)

    const mainnetDsr = await pot.dsr()
    console.log({mainnetDsr})

    const [ optimismDsr ] = await optimismDsrAuthOracle.getPotData()
    console.log({optimismDsr})
    const [ baseDsr ] = await baseDsrAuthOracle.getPotData()
    console.log({baseDsr})

    mainnetDsr != optimismDsr && await handleDsrDiscrepancy('Optimism', mainnetDsr, optimismDsr, periodicEvent, context)
    mainnetDsr != baseDsr && await handleDsrDiscrepancy('Base', mainnetDsr, baseDsr, periodicEvent, context)

    await cleanUpStaleDiscrepancyRecord('Optimism', periodicEvent, context)
    await cleanUpStaleDiscrepancyRecord('Base', periodicEvent, context)
}

const handleDsrDiscrepancy = async (
    domainName: string,
    mainnetDsr: bigint,
    foreignDsr: bigint,
    periodicEvent: PeriodicEvent,
    context: Context,
) => {
    const lastDiscrepancyReportTime = await context.storage.getNumber(`getPotDsrDataSync-${domainName}`) || 0
    console.log(`Discrepancy observed on ${domainName}`)

    if (lastDiscrepancyReportTime == 0) {
        await context.storage.putNumber(`getPotDsrDataSync-${domainName}`, periodicEvent.time.getTime())
        return
    }

    if (periodicEvent.time.getTime() - lastDiscrepancyReportTime > DISCREPANCY_TIME_THRESHOLD) {

    }

    if (periodicEvent.time.getTime() - lastDiscrepancyReportTime > DISCREPANCY_TIME_THRESHOLD) {
        console.log(`Sending an alert about ${domainName} DSR discrepancy`)
        await context.storage.delete(`getPotDsrDataSync-${domainName}`)
        await sendMessagesToSlack([`\`\`\`
🚨🔮🏛️ DSR ORACLE DISCREPANCY (${domainName.toUpperCase()}) 🚨🔮🏛️

🏛️ Mainnet DSR: ${mainnetDsr.toString()}
🔮 ${domainName} DSR: ${foreignDsr.toString()}\`\`\``], context, 'SPARKLEND_ALERTS_SLACK_WEBHOOK_URL')
    }
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
