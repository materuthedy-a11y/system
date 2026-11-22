import { IsArray } from 'class-validator';

// Rows are validated one-by-one inside the service so a single invalid row
// fails only itself instead of rejecting the whole batch at the pipe level.
export class BulkImportCustomersDto {
  @IsArray()
  customers: Record<string, unknown>[];
}

export class BulkImportSuppliersDto {
  @IsArray()
  suppliers: Record<string, unknown>[];
}
