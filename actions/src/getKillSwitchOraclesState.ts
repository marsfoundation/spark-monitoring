import {
    ActionFn,
    Context,
    Event,
} from '@tenderly/actions'

import { Contract } from 'ethers'

import { oracleAbi, killSwitchOracleAbi, multicallAbi } from './abis'

import { createMainnetProvider, sendMessagesToSlack } from './utils'

const MULTICALL = '0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7' as const
const KILL_SWITCH_ORACLE = '0x33a3aB524A43E69f30bFd9Ae97d1Ec679FF00B64' as const

export const getKillSwitchOraclesState: ActionFn = async (context: Context, _: Event) => {

    const provider = await createMainnetProvider(context)

    const multicall = new Contract(MULTICALL, multicallAbi, provider)
    const killSwitchOracle = new Contract(KILL_SWITCH_ORACLE, killSwitchOracleAbi, provider)

    const oracleAddresses = await killSwitchOracle.oracles()

    let multicallCalls: Array<{ target: string; callData: string }> = []

    for (const oracleAddress of oracleAddresses) {
        const oracle = new Contract(oracleAddress, oracleAbi, provider)
        multicallCalls = [
            ...multicallCalls,
            ...[
                {
                    target: oracleAddress,
                    callData: oracle.interface.encodeFunctionData('latestAnswer'),
                },
                {
                    target: KILL_SWITCH_ORACLE,
                    callData: killSwitchOracle.interface.encodeFunctionData('oracleThresholds', [oracleAddress]),
                }
            ],
        ]
    }

    let multicallResults = (await multicall.aggregate(multicallCalls)).returnData

    for (const oracleAddress of oracleAddresses) {
        const oracle = new Contract(oracleAddress, oracleAbi, provider)

        const latestAnswer = BigInt(
            oracle.interface.decodeFunctionResult('latestAnswer', multicallResults[0])[0].toString(),
        )
        const threshold = BigInt(
            killSwitchOracle.interface.decodeFunctionResult('oracleThresholds', multicallResults[1])[0].toString(),
        )

        multicallResults = multicallResults.slice()

        const messages = [`\`\`\`
🚨🕹️💀 KILL SWITCH ORACLE THRESHOLD VIOLATION 🚨🕹️💀

🔮 Oracle: ${oracleAddress}
  Latest Answer: ${latestAnswer.toString()}
  Threshold:     ${threshold.toString()}\`\`\``]

        console.log(messages)
        if (latestAnswer > 0 && latestAnswer <= threshold) {
            await sendMessagesToSlack(messages, context, 'SPARKLEND_ALERTS_SLACK_WEBHOOK_URL')
        }
    }
}
