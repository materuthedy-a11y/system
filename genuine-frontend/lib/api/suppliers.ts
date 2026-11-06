import { apiClient, unwrap } from '@/lib/api';

export interface SupplierContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position?: string | null;
  isPrimary: boolean;
}

export interface SupplierAddress {
  id: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country?: string | null;
}

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  supplierCode: string;
  description?: string | null;
  email: string;
  phone: string;
  secondaryPhone?: string | null;
  address?: SupplierAddress | null;
  contacts: SupplierContact[];
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankSwiftCode?: string | null;
  taxId?: string | null;
  creditLimit: number;
  paymentTerms: string;
  openingBalance: number;
  totalPurchased: number;
  totalPaid: number;
  totalReturned: number;
  outstandingBalance: number;
  creditUtilization: number;
  isActive: boolean;
  lastPurchaseDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInput {
  name: string;
  supplierCode?: string;
  description?: string;
  email: string;
  phone: string;
  secondaryPhone?: string;
  address?: Omit<SupplierAddress, 'id'> | null;
  contacts?: Array<Partial<Omit<SupplierContact, 'id' | 'isPrimary'>> & { isPrimary?: boolean }>;
  bankName?: string;
  bankAccountNumber?: string;
  bankSwiftCode?: string;
  taxId?: string;
  creditLimit?: number;
  paymentTerms: 'NET-7' | 'NET-14' | 'NET-30' | 'NET-45' | 'NET-60' | 'CASH';
  openingBalance?: number;
  isActive?: boolean;
}

export interface SupplierStatement {
  supplierId: string;
  supplierName: string;
  period: string;
  openingBalance: number;
  purchases: number;
  payments: number;
  returns: number;
  closingBalance: number;
  invoices: Array<{ date: string; invoiceNumber: string; amount: number; type: 'PURCHASE' | 'PAYMENT' | 'RETURN' }>;
}

export interface SupplierFilters {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'OVERDUE';
  paymentTerms?: string;
  sortBy?: 'name' | 'outstanding' | 'lastPurchase' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface SupplierPage { data: Supplier[]; total: number; page: number; limit: number; }

const root = '/suppliers-customers/suppliers';

export const suppliersAPI = {
  async list(filters: SupplierFilters = {}) {
    return unwrap<SupplierPage>(await apiClient.get(root, { params: filters }));
  },
  async get(id: string) {
    return unwrap<Supplier>(await apiClient.get(`${root}/${encodeURIComponent(id)}`));
  },
  async create(input: SupplierInput) {
    return unwrap<Supplier>(await apiClient.post(root, input));
  },
  async update(id: string, input: Partial<SupplierInput>) {
    return unwrap<Supplier>(await apiClient.patch(`${root}/${encodeURIComponent(id)}`, input));
  },
  async remove(id: string) {
    return unwrap<{ message: string }>(await apiClient.delete(`${root}/${encodeURIComponent(id)}`));
  },
  async statement(id: string, month: string) {
    return unwrap<SupplierStatement>(await apiClient.get(`${root}/${encodeURIComponent(id)}/statement`, { params: { month } }));
  },
};
