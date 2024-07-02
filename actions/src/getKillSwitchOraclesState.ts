import {
    ActionFn,
    Context,
    Event,
} from '@tenderly/actions'

import { Contract } from 'ethers'

import { priceSourceAbi, killSwitchOracleAbi, multicallAbi } from './abis'

import { createMainnetProvider, sendMessagesToSlack } from './utils'

const MULTICALL = '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441' as const
const KILL_SWITCH_ORACLE = '0x909A86f78e1cdEd68F9c2Fe2c9CD922c401abe82' as const

export const getKillSwitchOraclesState: ActionFn = async (context: Context, _: Event) => {

    const provider = await createMainnetProvider(context)

    const multicall = new Contract(MULTICALL, multicallAbi, provider)
    const killSwitchOracle = new Contract(KILL_SWITCH_ORACLE, killSwitchOracleAbi, provider)

    const oracleAddresses = await killSwitchOracle.oracles()

    let multicallCalls: Array<{ target: string; callData: string }> = []

    for (const oracleAddress of oracleAddresses) {
        const oracle = new Contract(oracleAddress, priceSourceAbi, provider)
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

    let multicallResults = (await multicall.aggregate.staticCall(multicallCalls)).returnData

    console.log(multicallResults)

    for (const oracleAddress of oracleAddresses) {
        const oracle = new Contract(oracleAddress, priceSourceAbi, provider)

        const latestAnswer = BigInt(
            oracle.interface.decodeFunctionResult('latestAnswer', multicallResults[0])[0].toString(),
        )
        const threshold = BigInt(
            killSwitchOracle.interface.decodeFunctionResult('oracleThresholds', multicallResults[1])[0].toString(),
        )

        multicallResults = multicallResults.slice(2)

        const messages = [`\`\`\`
🚨🕹️💀 KILL SWITCH ORACLE THRESHOLD VIOLATION 🚨🕹️💀

🔮 Oracle: ${oracleAddress}
  Latest Answer: ${latestAnswer.toString()}
  Threshold:     ${threshold.toString()}\`\`\``]

        if (latestAnswer > 0 && latestAnswer <= threshold) {
            await sendMessagesToSlack(messages, context, 'SPARKLEND_ALERTS_SLACK_WEBHOOK_URL')
        }
    }
}
