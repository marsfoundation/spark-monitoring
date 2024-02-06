import {
    ActionFn,
    Context,
    Event,
    TransactionEvent,
} from '@tenderly/actions'

import { createEtherscanTxLink, sendMessagesToSlack } from './utils'

export const getExecOnSparkProxy: ActionFn = async (context: Context, event: Event) => {
    const transactionEvent = event as TransactionEvent

    await sendMessagesToSlack([`\`\`\`
🏛️✨ Exec called on Spark SubProxy 🏛️✨

${createEtherscanTxLink(transactionEvent.hash)}\`\`\``], context, 'ALERTS_IMPORTANT_SLACK_WEBHOOK_URL')
}
