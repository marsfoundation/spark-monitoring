import { AssetsData } from './types'

export const calculateDollarValueInCents = (allAssetsData: AssetsData, amount: bigint, asset: string) => {
	return amount
		* allAssetsData[asset].price
		/ BigInt(10) ** allAssetsData[asset].decimals
		/ BigInt(10 ** 6) // dividing by 10 ** 6, not 10 ** 8 because we want the result in USD cents (we assume 8 digit precision)
}
