import {
	BlockEvent,
	Context,
	Event,
} from '@tenderly/actions'

export const cleanTransactionRegistry = (actionNames: Array<string>) => async (context: Context, event: Event) => {
    const blockEvent = event as BlockEvent

    for (const actionName of actionNames) {
        await removeStaleRecordsFromRegistry(actionName, blockEvent, context)
    }
}

const removeStaleRecordsFromRegistry = async (actionName: string, blockEvent: BlockEvent, context: Context) => {
    const registry = await context.storage.getJson(`${actionName}-tx-registry`)

    if(!registry) return

    await context.storage.putJson(`${actionName}-tx-registry`, Object.keys(registry as Record<string, number>).reduce((updatedRegistry, txHash) => {
        if (registry[txHash] + 100 > blockEvent.blockNumber) {
            updatedRegistry[txHash] = registry[txHash]
        } else {
            console.log(`Removing tx ${txHash} at ${registry[txHash]} from ${actionName}`)
        }
        return updatedRegistry
    }, {} as Record<string, number>))
}

export const cleanTransactionRegistryMainnet = cleanTransactionRegistry([
    'getCapAutomatorUpdate',
    'getConfigurationChangeAave',
    'getHighGasTransaction',
    'getLiquidationSparkLend-mainnet',
    'getProtocolInteractionSparklend-mainnet',
])

export const cleanTransactionRegistryGnosis = cleanTransactionRegistry([
    'getLiquidationSparkLend-gnosis',
    'getProtocolInteractionSparklend-gnosis',
])
