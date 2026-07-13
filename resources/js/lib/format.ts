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
