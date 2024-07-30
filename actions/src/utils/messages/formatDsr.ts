import { BigNumber } from 'bignumber.js'

function pow(a: BigNumber, b: BigNumber): BigNumber {
    return BigNumber.clone({ POW_PRECISION: 100 }).prototype.pow.apply(a, [new BigNumber(b).toNumber()])
}

export const formatDsr = (dsr: string): string => {
    const percentage = pow(
        BigNumber(dsr).div(BigNumber('1000000000000000000000000000')),
        BigNumber(60 * 60 * 24 * 365),
    ).minus(BigNumber(1))
    return percentage.multipliedBy(100).toFixed(2).toString().concat('%')
}
