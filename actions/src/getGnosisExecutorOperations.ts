import {
    ActionFn,
    Context,
    Event,
    TransactionEvent,
} from '@tenderly/actions'

import { Contract, JsonRpcProvider } from 'ethers'

import { ambBridgeExecutorAbi } from './abis'

import { createGnosisscanTxLink, sendMessagesToSlack } from './utils'

const AMB_BRIDGE_EXECUTOR = '0xc4218c1127cb24a0d6c1e7d25dc34e10f2625f5a' as const

export const getGnosisExecutorOperations: ActionFn = async (context: Context, event: Event) => {
    const transactionEvent = event as TransactionEvent

    const rpcUrl = await context.secrets.get('GNOSIS_RPC_URL')
	const provider = new JsonRpcProvider(rpcUrl)
    const bridgeExecutor = new Contract(AMB_BRIDGE_EXECUTOR, ambBridgeExecutorAbi, provider)

    const executorLogs = transactionEvent.logs
		.filter(log => log.address.toLowerCase() == AMB_BRIDGE_EXECUTOR.toLowerCase())
		.map(log => bridgeExecutor.interface.parseLog(log))

    const queueLogs = executorLogs.filter(log => log?.name == 'ActionsSetQueued')
    const executeLogs = executorLogs.filter(log => log?.name == 'ActionsSetExecuted')

    let messages: string[] = []

    for (const log of queueLogs) {
        messages.push(`\`\`\`
🏛️🦉 Queue called on Gnosis Executor 🏛️🦉

🪄 Spell${log?.args.targets.length > 1 ? 's:' : ': '}         ${log?.args.targets.join(', ')}
⏳ Execution time: ${new Date(Number(log?.args.executionTime)).toUTCString()}

${createGnosisscanTxLink(transactionEvent.hash)}\`\`\``)
    }

    for (const log of executeLogs) {
        const action = await bridgeExecutor.getActionsSetById(log?.args.id)
        console.log(action)
        console.log(action.targets)
        console.log(action[0])
        messages.push(`\`\`\`
🏛️🦉 Execute called on Gnosis Executor 🏛️🦉

${createGnosisscanTxLink(transactionEvent.hash)}\`\`\``)
    }

    await sendMessagesToSlack(messages, context, 'TEST_SLACK_WEBHOOK_URL')
}
