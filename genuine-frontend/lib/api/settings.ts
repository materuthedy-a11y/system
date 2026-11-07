import { apiClient, unwrap } from '@/lib/api';

export interface BusinessProfile {
  id: string; name: string; legalName?: string | null; registrationNumber?: string | null;
  businessType: string; description?: string | null; email?: string | null; phone?: string | null;
  phone2?: string | null; address?: string | null; city?: string | null; region?: string | null;
  country: string; taxId?: string | null; timezone: string; language: string; website?: string | null; logoUrl?: string | null;
  currency: string; taxPercentage: number; allowNegativeStock: boolean; costingMethod: string;
  financialYear: string; isSetupComplete: boolean; isActive: boolean;
}
export interface BusinessBrand { name: string; logoUrl?: string | null; }
export interface BusinessSettings {
  businessId: string; defaultLocationId: string | null; defaultPaymentMethodId: string | null;
  invoicePrefix: string; poPrefix: string; grnPrefix: string; receiptPrefix: string;
  dateFormat: string; timeFormat: string; weekStartsOn: string; lowStockThreshold: number; theme: string;
}
export interface Location { id: string; name: string; code: string; type: string; address?: string | null; description?: string | null; isActive: boolean; }
export interface PaymentMethod { id: string; name: string; description?: string | null; code?: string | null; methodType: string; requiresReference: boolean; bankDetails?: string | null; isActive: boolean; }
export interface ExpenseCategory { id: string; name: string; code: string; description?: string | null; budgetLimit?: number | null; budgetPeriod?: string | null; isActive: boolean; }
export interface TaxRate { id: string; name: string; code: string; rate: number; description?: string | null; appliesTo: string; isDefault: boolean; isActive: boolean; }
export interface BusinessExchangeRate { id: string; baseCurrency: string; currencyCode: string; rateToBase: number; effectiveFrom: string; note?: string | null; createdBy?: string | null; createdAt: string; }
export interface ExchangeRateConversion { amount: number; result: number; currencyCode: string; baseCurrency: string; rateToBase: number; effectiveFrom: string; direction: 'TO_BASE' | 'FROM_BASE'; }
export interface ManagedUser { id: string; email: string; firstName: string; lastName: string; phone?: string | null; isActive: boolean; status: 'ACTIVE' | 'INACTIVE'; roles: Array<{id:string;name:string}>; roleId: string | null; roleName: string; createdAt: string; lastLogin?: string | null; }
export interface ManagedRole { id: string; name: string; description?: string | null; isDefault: boolean; isSystem: boolean; permissions: string[]; usersCount: number; createdAt: string; }
export interface Permission { id: string; key: string; name: string; description?: string | null; category: string; action: string; }

export const settingsAPI = {
  async getBrand() { return unwrap<BusinessBrand>(await apiClient.get('/business/brand')); },
  async getProfile() { return unwrap<BusinessProfile>(await apiClient.get('/business/profile')); },
  async updateProfile(input: Partial<BusinessProfile>) { return unwrap<BusinessProfile>(await apiClient.patch('/business/profile', input)); },
  async getGeneral() { return unwrap<BusinessSettings>(await apiClient.get('/business/settings')); },
  async updateGeneral(input: Partial<BusinessSettings>) { return unwrap<BusinessSettings>(await apiClient.patch('/business/settings', input)); },
  async locations() { return unwrap<Location[]>(await apiClient.get('/business/locations?includeInactive=true')); },
  async createLocation(input: Partial<Location>) { return unwrap<Location>(await apiClient.post('/business/locations', input)); },
  async updateLocation(id: string, input: Partial<Location>) { return unwrap<Location>(await apiClient.patch(`/business/locations/${encodeURIComponent(id)}`, input)); },
  async paymentMethods() { return unwrap<PaymentMethod[]>(await apiClient.get('/business/payment-methods?includeInactive=true')); },
  async createPaymentMethod(input: Partial<PaymentMethod>) { return unwrap<PaymentMethod>(await apiClient.post('/business/payment-methods', input)); },
  async updatePaymentMethod(id: string, input: Partial<PaymentMethod>) { return unwrap<PaymentMethod>(await apiClient.patch(`/business/payment-methods/${encodeURIComponent(id)}`, input)); },
  async expenseCategories() { return unwrap<ExpenseCategory[]>(await apiClient.get('/payments/expenses/categories?activeOnly=false')); },
  async createExpenseCategory(input: Partial<ExpenseCategory>) { return unwrap<ExpenseCategory>(await apiClient.post('/payments/expenses/categories', input)); },
  async updateExpenseCategory(id: string, input: Partial<ExpenseCategory>) { return unwrap<ExpenseCategory>(await apiClient.patch(`/payments/expenses/categories/${encodeURIComponent(id)}`, input)); },
  async taxRates() { return unwrap<TaxRate[]>(await apiClient.get('/business/tax-rates')); },
  async createTaxRate(input: Partial<TaxRate>) { return unwrap<TaxRate>(await apiClient.post('/business/tax-rates', input)); },
  async updateTaxRate(id: string, input: Partial<TaxRate>) { return unwrap<TaxRate>(await apiClient.patch(`/business/tax-rates/${encodeURIComponent(id)}`, input)); },
  async exchangeRates() { return unwrap<{baseCurrency:string;rates:BusinessExchangeRate[]}>(await apiClient.get('/business/exchange-rates')); },
  async createExchangeRate(input: {currencyCode:string;rateToBase:number;effectiveFrom:string;note?:string}) { return unwrap<BusinessExchangeRate>(await apiClient.post('/business/exchange-rates',input)); },
  async convertCurrency(input:{currencyCode:string;amount:number;asOf:string;direction:'TO_BASE'|'FROM_BASE'}) { return unwrap<ExchangeRateConversion>(await apiClient.post('/business/exchange-rates/convert',input)); },
  async users(filters?: {roleId?:string;status?:string}) { return unwrap<ManagedUser[]>(await apiClient.get('/business/users', { params: filters })); },
  async createUser(input: {email:string;firstName:string;lastName:string;phone?:string;password:string;roleId:string}) { return unwrap<ManagedUser>(await apiClient.post('/business/users', input)); },
  async updateUser(id:string,input:Partial<Pick<ManagedUser,'email'|'firstName'|'lastName'|'phone'|'roleId'|'isActive'>>) { return unwrap<ManagedUser>(await apiClient.patch(`/business/users/${encodeURIComponent(id)}`,input)); },
  async deactivateUser(id:string) { return unwrap<ManagedUser>(await apiClient.delete(`/business/users/${encodeURIComponent(id)}`)); },
  async resetUserPassword(id:string,newPassword:string) { return unwrap<{message:string}>(await apiClient.post(`/business/users/${encodeURIComponent(id)}/reset-password`,{newPassword})); },
  async roles() { return unwrap<ManagedRole[]>(await apiClient.get('/business/roles')); },
  async permissions() { return unwrap<Permission[]>(await apiClient.get('/business/permissions')); },
  async createRole(input:{name:string;description?:string;permissions:string[]}) { return unwrap<ManagedRole>(await apiClient.post('/business/roles',input)); },
  async updateRole(id:string,input:Partial<Pick<ManagedRole,'name'|'description'|'permissions'>>) { return unwrap<ManagedRole>(await apiClient.patch(`/business/roles/${encodeURIComponent(id)}`,input)); },
  async deleteRole(id:string) { return unwrap<{message:string}>(await apiClient.delete(`/business/roles/${encodeURIComponent(id)}`)); },
};
