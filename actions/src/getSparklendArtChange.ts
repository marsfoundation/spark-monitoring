import {
    ActionFn,
    Context,
    Event,
    TransactionEvent,
} from '@tenderly/actions'

import { Contract } from 'ethers'

import { vatAbi } from './abis'

import { createEtherscanTxLink, createMainnetProvider, formatBigInt, sendMessagesToSlack, transactionAlreadyProcessed } from './utils'

const VAT = '0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B' as const
const D3M_POOL = '0xAfA2DD8a0594B2B24B59de405Da9338C4Ce23437' as const
const ILK = '0x4449524543542d535041524b2d44414900000000000000000000000000000000' as const

export const getSparklendArtChange: ActionFn = async (context: Context, event: Event) => {
    const transactionEvent = event as TransactionEvent

    if (await transactionAlreadyProcessed('getSparklendArtChange', context, transactionEvent)) return

    const provider = await createMainnetProvider(context)
    const vat = new Contract(VAT, vatAbi, provider)

    const [, art] = await vat.urns(ILK, D3M_POOL)

    await sendMessagesToSlack([`\`\`\`
🏛️🎨 Sparklend Art was updated in Vat 🏛️🎨

🎨 Current art: ${formatBigInt(art, 18)}

${createEtherscanTxLink(transactionEvent.hash)}\`\`\``], context, 'SPARKLEND_INFO_SLACK_WEBHOOK_URL')
}
