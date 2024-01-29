import {
	Context,
	TransactionEvent,
} from '@tenderly/actions'

export const transactionAlreadyProcessed = async (actionName: string, context: Context, txEvent: TransactionEvent) => {
    if (await context.storage.getNumber(`${actionName}-${txEvent.hash}`) == 1) {
        console.log(`Transaction ${txEvent.hash} was already processed by action ${actionName}`)
        return true
    }
    await context.storage.putNumber(`${actionName}-${txEvent.hash}`, 1);
    console.log(`Transaction ${txEvent.hash} is being saved as processed by action ${actionName}`)
    return false
}
