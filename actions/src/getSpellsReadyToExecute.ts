import {
    Context,
    Event
} from '@tenderly/actions'

import { Block, Contract } from 'ethers'

import { multicallAbi, remoteExecutorAbi } from './abis'

import { createProvider, sendMessagesToSlack } from './utils'

const EXECUTOR = '0xc4218C1127cB24a0D6c1e7D25dc34e10f2625f5A'
const MULTICALL = '0xcA11bde05977b3631167028862bE2a173976CA11'

const TIME_THRESHOLD = 600_000 as const  // 10 minutes in milliseconds

export const getSpellsReadyToExecute = (rpcUrlSecret: string, domainName: string) => async (context: Context, _: Event) => {
    const provider = await createProvider(context, rpcUrlSecret)

    const executor = new Contract(EXECUTOR, remoteExecutorAbi, provider)
    const multicall = new Contract(MULTICALL, multicallAbi, provider)

    const actionSetCount = BigInt(await executor.getActionsSetCount())

    const latestBlockTimestamp = ((await provider.getBlock('latest')) as Block).timestamp
    const executionTimestamp = new Date().getTime()

    const multicallCalls: Array<{ target: string; callData: string }> = []
    const messages: Array<string> = []

    for (let i = 0; i < actionSetCount; i++) {
        multicallCalls.push({
            target: EXECUTOR,
            callData: executor.interface.encodeFunctionData('getCurrentState', [i]),
        })
        multicallCalls.push({
            target: EXECUTOR,
            callData: executor.interface.encodeFunctionData('getActionsSetById', [i]),
        })
    }

    let multicallResults = (await multicall.aggregate.staticCall(multicallCalls)).returnData

    for (let i = 0; i < actionSetCount; i++) {
        const currentState = Number(executor.interface.decodeFunctionResult('getCurrentState', multicallResults[0])[0])
        console.log('currentState', currentState)
        const actionsSet = executor.interface.decodeFunctionResult('getActionsSetById', multicallResults[1])[0]
        console.log('actionsSet', actionsSet)

        multicallResults = multicallResults.slice(2)

        if (currentState == 0 && latestBlockTimestamp >= BigInt(actionsSet.executionTime)) {
            const lastReportTime = (await context.storage.getNumber(`getSpellsReadyToExecute-${domainName}`)) || 0

            const lastReportInterval = executionTimestamp - lastReportTime > 2 * TIME_THRESHOLD ? 0 : executionTimestamp - lastReportTime

            if (lastReportInterval == 0) {
                await context.storage.putNumber(`getSpellsReadyToExecute-${domainName}`, executionTimestamp)
            }

            if (lastReportInterval > TIME_THRESHOLD) {
                await context.storage.putNumber(`getSpellsReadyToExecute-${domainName}`, executionTimestamp)
                messages.push(`\`\`\`
🪄⏳🏛️ ${domainName.toUpperCase()} SPELL AWAITING TO BE EXECUTED 🪄⏳🏛️
🪄 Spell: ${actionsSet.targets[0]}\`\`\``)
            }
        }
    }

    if (messages.length > 0) {
        await sendMessagesToSlack(messages, context, 'SPARKLEND_ALERTS_SLACK_WEBHOOK_URL')
    }

}

export const getSpellsReadyToExecuteGnosis = getSpellsReadyToExecute('GNOSIS_RPC_URL', 'gnosis')
