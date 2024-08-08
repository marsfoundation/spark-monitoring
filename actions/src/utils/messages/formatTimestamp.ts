export const formatTimestamp = (timestamp: number): string =>
    new Date(timestamp * 1000).toUTCString().split(' ').slice(1, -1).join(' ')
