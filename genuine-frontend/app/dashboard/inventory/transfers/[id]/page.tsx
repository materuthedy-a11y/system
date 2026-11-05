'use client';
import { useParams } from 'next/navigation';
import { InventoryDetail } from '@/components/inventory/InventoryDetail';
export default function Page() { const { id } = useParams<{ id: string }>(); return <InventoryDetail kind="transfers" id={id}/>; }
