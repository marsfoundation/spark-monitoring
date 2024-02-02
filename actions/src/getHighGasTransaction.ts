import {
    ActionFn,
    Context,
    Event,
    TransactionEvent,
} from '@tenderly/actions'

import {
    createEtherscanTxLink,
    formatBigInt,
    sendMessagesToSlack,
    transactionAlreadyProcessed,
} from './utils'

export const HIGH_GAS_TRANSACTION_THRESHOLD = 2_500_000n as const

export const getHighGasTransaction: ActionFn = async (context: Context, event: Event) => {
	const transactionEvent = event as TransactionEvent

    if (await transactionAlreadyProcessed('getHighGasTransaction', context, transactionEvent)) return

    if (BigInt(transactionEvent.gasUsed) >= HIGH_GAS_TRANSACTION_THRESHOLD) {
        await sendMessagesToSlack([`\`\`\`
🚨🔥 HIGH GAS TRANSACTION 🚨🔥

⛽️ Gas used: ${formatBigInt(transactionEvent.gasUsed, 0).slice(0, -2)}

${createEtherscanTxLink(transactionEvent.hash)}\`\`\``], context, 'HIGH_GAS_SLACK_WEBHOOK_URL')
    }
}
