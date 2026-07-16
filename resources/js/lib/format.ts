const dateFmt = new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
});

const dateTimeFmt = new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

export function fmtDate(value?: string | null): string {
    if (!value) return '–';
    return dateFmt.format(new Date(value));
}

export function fmtDateTime(value?: string | null): string {
    if (!value) return '–';
    return dateTimeFmt.format(new Date(value));
}

export function fmtBytes(bytes: number): string {
    if (!bytes) return '–';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
        value /= 1024;
        i++;
    }
    return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
