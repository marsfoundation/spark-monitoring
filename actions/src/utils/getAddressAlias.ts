export const aliases = {
    MAKER_CORE_D3M: 'Maker Core D3M',
}

export const getAddressAlias = (address: string): string | null => {
    const aliasesRegistry = {
        '0xafa2dd8a0594b2b24b59de405da9338c4ce23437': aliases.MAKER_CORE_D3M,
    } as Record<string, string>

    return aliasesRegistry[address.toLowerCase()] || null
}
