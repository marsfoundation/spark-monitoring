import { formatThousandSeparators } from './formatThousandSeparators'

export const formatChi = (chi: string): string => {
    const wholeUnit =  chi[0]
    const weiTail = chi.slice(1)
    const formattedWeiTail = formatThousandSeparators(weiTail)
    return [wholeUnit, formattedWeiTail].join('.')
}
