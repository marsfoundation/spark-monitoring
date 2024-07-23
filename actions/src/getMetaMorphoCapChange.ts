import {
    ActionFn,
    Context,
    Event,
    TransactionEvent,
} from '@tenderly/actions'

import { Contract } from 'ethers'

import { metaMorphoAbi } from './abis'

import { createEtherscanTxLink, createMainnetProvider, formatBigInt, sendMessagesToSlack } from './utils'

const META_MORPHO_VAULT = '0x73e65DBD630f90604062f6E02fAb9138e713edD9' as const

export const getMetaMorphoCapChange: ActionFn = async (context: Context, event: Event) => {
    const transactionEvent = event as TransactionEvent

    const provider = await createMainnetProvider(context)
    const metaMorpho = new Contract(META_MORPHO_VAULT, metaMorphoAbi, provider)

    const logs = transactionEvent.logs
		.filter(log => log.address.toLowerCase() == META_MORPHO_VAULT.toLowerCase())
		.map(log => metaMorpho.interface.parseLog(log))
		.filter(log => log && log.name === 'SetCap')
        .map(log => log && `\nMarket Id: ${log.args[1]}\nCap:       ${formatBigInt(log.args[2], 18)}\nhttps://morpho.blockanalitica.com/ethereum/markets/${log.args[1].slice(2)}\n`)

    const messages = [`\`\`\`
📈📉🦋 Meta Morpho Vault Cap Change 📈📉🦋
${logs.join('')}
${createEtherscanTxLink(transactionEvent.hash)}\`\`\``]

    await sendMessagesToSlack(messages, context, 'SPARKLEND_INFO_ALERTS_SLACK_WEBHOOK_URL')
}
