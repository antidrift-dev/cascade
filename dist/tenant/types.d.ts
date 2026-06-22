export interface TenantRecord {
    accountId: string;
    databaseId: string;
    createdAt: number;
    status: 'active' | 'suspended';
}
export interface TenantProvider {
    resolve(tenantId: string): Promise<TenantRecord | null>;
    register(tenantId: string, record: TenantRecord): Promise<void>;
    remove(tenantId: string): Promise<void>;
}
