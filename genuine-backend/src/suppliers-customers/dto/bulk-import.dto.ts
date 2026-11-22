import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCustomerDto } from './create-customer.dto';
import { CreateSupplierDto } from './create-supplier.dto';

export class BulkImportCustomersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCustomerDto)
  customers: CreateCustomerDto[];
}

export class BulkImportSuppliersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierDto)
  suppliers: CreateSupplierDto[];
}
