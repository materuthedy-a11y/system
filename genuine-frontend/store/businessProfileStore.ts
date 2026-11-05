import { create } from 'zustand';
import type { BusinessBrand, BusinessProfile } from '@/lib/api/settings';

interface BusinessProfileState {
  businessId: string | null;
  profile: BusinessProfile | null;
  brand: BusinessBrand | null;
  setProfile: (businessId: string, profile: BusinessProfile) => void;
  setBrand: (businessId: string, brand: BusinessBrand) => void;
}

export const useBusinessProfileStore = create<BusinessProfileState>((set) => ({
  businessId: null,
  profile: null,
  brand: null,
  setProfile: (businessId, profile) => set({ businessId, profile, brand: { name: profile.name, logoUrl: profile.logoUrl ?? null } }),
  setBrand: (businessId, brand) => set({ businessId, brand }),
}));
