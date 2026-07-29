/**
 * Asztali Office-ban megnyitható fájltípusok (a szerveroldali
 * App\Support\OfficeFiles párja).
 */

/** kiterjesztés => program neve */
const APPS: Record<string, string> = {
    doc: 'Word',
    docx: 'Word',
    docm: 'Word',
    dot: 'Word',
    dotx: 'Word',
    rtf: 'Word',
    odt: 'Word',

    xls: 'Excel',
    xlsx: 'Excel',
    xlsm: 'Excel',
    xlsb: 'Excel',
    xltx: 'Excel',
    csv: 'Excel',
    ods: 'Excel',

    ppt: 'PowerPoint',
    pptx: 'PowerPoint',
    pptm: 'PowerPoint',
    ppsx: 'PowerPoint',
    odp: 'PowerPoint',

    vsd: 'Visio',
    vsdx: 'Visio',
};

/** A program neve toldalékolva: „Megnyitás Excelben”. */
const IN_APP: Record<string, string> = {
    Word: 'Wordben',
    Excel: 'Excelben',
    PowerPoint: 'PowerPointban',
    Visio: 'Visióban',
};

export function officeAppFor(filename?: string | null): string | null {
    const dot = (filename ?? '').lastIndexOf('.');
    if (dot < 0) return null;

    return APPS[(filename ?? '').slice(dot + 1).toLowerCase()] ?? null;
}

export function openInAppLabel(app: string): string {
    return `Megnyitás ${IN_APP[app] ?? `${app}-ben`}`;
}
