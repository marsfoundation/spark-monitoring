import {
    ActionFn,
    Context,
    Event,
    TransactionEvent,
} from '@tenderly/actions'

import { Contract } from 'ethers'

import { priceSourceAbi } from './abis'

import { createMainnetProvider, sendMessagesToSlack, transactionAlreadyProcessed } from './utils'

const priceSources = {
    WBTC_BTC: '0xfdFD9C85aD200c506Cf9e21F1FD8dd01932FBB23',
    STETH_ETH: '0x86392dC19c0b719886221c78AB11eb8Cf5c52812',
} as const

export const getCurrentAggregators: ActionFn = async (context: Context, event: Event) => {
    const transactionEvent = event as TransactionEvent

    if (await transactionAlreadyProcessed('getCurrentAggregators', context, transactionEvent)) return

    const provider = await createMainnetProvider(context)

    let messageBits: Array<string> = []
    for (const [name, address] of Object.entries(priceSources)) {
        const priceSource = new Contract(address, priceSourceAbi, provider)
        const aggregatorAddress = await priceSource.aggregator()
        messageBits.push(`${name} aggregator: ${aggregatorAddress}\nhttps://etherscan.io/address/${address}#readContract#F2`)
    }
            const message = [`\`\`\`
⛓️🔮 Oracle aggregators updated ⛓️🔮

Current aggregators:
${messageBits.join('\n\n')}

🚨🚨 Make sure that all KillSwitch Keepers are configured to monitor updated price aggregators 🚨🚨\`\`\``]

await sendMessagesToSlack(message, context, 'SPARKLEND_ALERTS_SLACK_WEBHOOK_URL')
}
