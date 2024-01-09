import {
	ActionFn,
	Context,
	Event,
	TransactionEvent,
} from '@tenderly/actions'

export const getConfigurationChangeAave: ActionFn = async (context: Context, event: Event) => {
	const transactionEvent = event as TransactionEvent

}
