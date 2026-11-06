'use client';

import { useRouter } from 'next/navigation';
import { ProductForm } from '@/components/products/ProductForm';
import type { Product } from '@/lib/api/products';
import { useAuthStore } from '@/store/authStore';

export default function NewProductPage() {
  const router = useRouter();
  const canView = useAuthStore((state) => state.user?.permissions?.includes('products.view') ?? false);
  return <ProductForm onSuccess={(product: Product) => { if (canView) router.push(`/dashboard/products/${product.id}`); }} />;
}
