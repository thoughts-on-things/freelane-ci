export interface ProviderSummary {
    id: string;
    name: string;
    adapter: string;
    quota: string;
    notes: string;
}
export declare function listProviders(): ProviderSummary[];
export declare function formatProviderList(items: ProviderSummary[], format: string): string;
