import { apiClient, unwrap } from '@/lib/api';

export type CustomerStatus = 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED' | 'ARCHIVED';
export type CustomerType = 'RETAIL' | 'WHOLESALE' | 'CORPORATE' | 'DISTRIBUTOR';
export type CustomerActivityType = 'NOTE' | 'CALL' | 'EMAIL' | 'VISIT';

export interface CustomerContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position?: string | null;
  isPrimary: boolean;
}

export interface CustomerAddress {
  id: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country?: string | null;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  customerCode: string;
  customerType: CustomerType;
  description?: string | null;
  email: string;
  phone: string;
  secondaryPhone?: string | null;
  photoId?: string | null;
  address?: CustomerAddress | null;
  contacts: CustomerContact[];
  taxId?: string | null;
  creditLimit: number;
  paymentTerms: string;
  openingBalance: number;
  totalSales: number;
  totalPaid: number;
  totalReturned: number;
  outstandingBalance: number;
  creditUtilization: number;
  isActive: boolean;
  status: CustomerStatus;
  lastSaleDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInput {
  name: string;
  customerCode?: string;
  customerType: CustomerType;
  description?: string;
  email: string;
  phone: string;
  secondaryPhone?: string;
  taxId?: string;
  creditLimit: number;
  paymentTerms: string;
  openingBalance: number;
  isActive: boolean;
  status?: CustomerStatus;
  /** Compressed WebP data URL, null removes an existing photo, undefined leaves it unchanged. */
  photo?: string | null;
  contacts?: Array<Omit<CustomerContact, 'id' | 'isPrimary'> & { isPrimary?: boolean }>;
  address?: Omit<CustomerAddress, 'id'> | null;
}

export interface CustomerActivity {
  id: string;
  customerId: string;
  type: CustomerActivityType;
  description: string;
  reference?: string | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string };
}

export interface CustomerStatement {
  customerId: string;
  customerName: string;
  period: string;
  openingBalance: number;
  sales: number;
  payments: number;
  returns: number;
  closingBalance: number;
  invoices: Array<{
    date: string;
    invoiceNumber: string;
    amount: number;
    type: 'SALE' | 'PAYMENT' | 'RETURN';
  }>;
}

export interface CustomerFilters {
  search?: string;
  status?: CustomerStatus | 'OVERDUE';
  customerType?: CustomerType;
  paymentTerms?: string;
  sortBy?: 'name' | 'outstanding' | 'lastSale' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CustomerPage {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
}

function query<T extends object>(filters: T) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
}

const root = '/suppliers-customers/customers';

export const customersAPI = {
  async list(filters: CustomerFilters = {}) {
    return unwrap<CustomerPage>(await apiClient.get(`${root}?${query(filters)}`));
  },
  async get(id: string) {
    return unwrap<Customer>(await apiClient.get(`${root}/${encodeURIComponent(id)}`));
  },
  async getPhoto(id: string) {
    return (await apiClient.get(`${root}/${encodeURIComponent(id)}/photo`, { responseType: 'blob' })).data as Blob;
  },
  async create(input: CustomerInput) {
    return unwrap<Customer>(await apiClient.post(root, input));
  },
  async update(id: string, input: Partial<CustomerInput>) {
    return unwrap<Customer>(await apiClient.patch(`${root}/${encodeURIComponent(id)}`, input));
  },
  async remove(id: string) {
    return unwrap<{ message: string }>(await apiClient.delete(`${root}/${encodeURIComponent(id)}`));
  },
  async statement(id: string, filters: { month?: string; dateFrom?: string; dateTo?: string } = {}) {
    return unwrap<CustomerStatement>(await apiClient.get(`${root}/${encodeURIComponent(id)}/statement?${query(filters)}`));
  },
  async activities(id: string, limit = 30) {
    return unwrap<CustomerActivity[]>(await apiClient.get(`${root}/${encodeURIComponent(id)}/activities?${query({ limit })}`));
  },
  async addActivity(id: string, input: Pick<CustomerActivity, 'type' | 'description'> & { reference?: string }) {
    return unwrap<CustomerActivity>(await apiClient.post(`${root}/${encodeURIComponent(id)}/activities`, input));
  },
};
