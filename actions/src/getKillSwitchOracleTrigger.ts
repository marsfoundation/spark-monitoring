import {
    ActionFn,
    Context,
    Event,
    TransactionEvent,
} from '@tenderly/actions'

import { Contract } from 'ethers'

import { killSwitchOracleAbi } from './abis'

import { createEtherscanTxLink, createMainnetProvider, sendMessagesToSlack, transactionAlreadyProcessed } from './utils'

const KILL_SWITCH_ORACLE = '0x909A86f78e1cdEd68F9c2Fe2c9CD922c401abe82' as const

export const getKillSwitchOracleTrigger: ActionFn = async (context: Context, event: Event) => {
    const transactionEvent = event as TransactionEvent

    if (await transactionAlreadyProcessed('getKillSwitchOracleTrigger', context, transactionEvent)) return

    const provider = await createMainnetProvider(context)
    const killSwitchOracle = new Contract(KILL_SWITCH_ORACLE, killSwitchOracleAbi, provider)

    const logs = transactionEvent.logs
		.filter(log => log.address.toLowerCase() == KILL_SWITCH_ORACLE.toLowerCase())
		.map(log => killSwitchOracle.interface.parseLog(log))
		.filter(log => log && log.name === 'Trigger')
        .map(log => log && `\nOracle:    ${log.args[0]}\nThreshold: ${log.args[1]}\nAsnwer:    ${log.args[2]}\n`)

    await sendMessagesToSlack([`\`\`\`
🚨🕹️💀 Trigger called on Kill Switch 🚨🕹️💀
${logs.join('')}
${createEtherscanTxLink(transactionEvent.hash)}\`\`\``], context, 'SPARKLEND_ALERTS_SLACK_WEBHOOK_URL')
}
