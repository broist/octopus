export type ProfitMode = 'markup' | 'multiplier' | 'fixed';
export type CostBasis = 'own' | 'sub' | 'manual';
export type PdfMode = 'summary' | 'detailed';

export interface QuoteItem {
    id: string;
    code?: string;
    description: string;
    technicalDescription?: string;
    quantity: number;
    unit: string;
    ownMaterialUnit: number;
    ownLaborUnit: number;
    subMaterialUnit: number;
    subLaborUnit: number;
    manualBase: number;
    basis: CostBasis;
    profitOverride: boolean;
    profitMode: ProfitMode;
    profitValue: number;
    active: boolean;
    internalNote?: string;
    sequence?: number;
    [key: string]: unknown;
}

export interface QuoteCategory {
    id: string;
    code?: string;
    title: string;
    active: boolean;
    collapsed: boolean;
    profitOverride: boolean;
    profitMode: ProfitMode;
    profitValue: number;
    items: QuoteItem[];
    [key: string]: unknown;
}

export interface QuotePayment {
    id: string;
    name: string;
    percent: number;
    condition: string;
    note?: string;
}

export interface QuoteSections {
    includes?: string;
    excludes?: string;
    assumptions?: string;
    clientData?: string;
    openQuestions?: string;
    nextStep?: string;
    [key: string]: string | undefined;
}

export interface QuoteData {
    id?: string;
    projectName: string;
    quoteNumber: string;
    clientName: string;
    clientCompany?: string;
    billingData?: string;
    email?: string;
    phone?: string;
    location: string;
    quoteDate?: string;
    validUntil?: string;
    description?: string;
    preparedBy?: string;
    notes?: string;
    status: string;
    version: number;
    vatRate: number;
    discount: number;
    contingency: number;
    projectCost: number;
    rounding: number;
    globalProfitMode: ProfitMode;
    globalProfitValue: number;
    pdfMode: PdfMode;
    showQuantitiesToCustomer: boolean;
    categories: QuoteCategory[];
    payments: QuotePayment[];
    sections: QuoteSections;
    [key: string]: unknown;
}

export interface QuoteListItem {
    id: number;
    quote_number: string | null;
    project_name: string;
    client_name: string | null;
    location: string | null;
    status: string;
    version: number;
    net_offer: number;
    gross_offer: number;
    updated_at: string;
}

export interface FolderOption {
    id: number;
    name: string;
    depth: number;
}
