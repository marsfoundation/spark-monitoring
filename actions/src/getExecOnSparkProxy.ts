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
✨✨✨ Exec called on Spark Proxy ✨✨✨

${createEtherscanTxLink(transactionEvent.hash)}\`\`\``], context, 'TEST_SLACK_WEBHOOK_URL')
}
