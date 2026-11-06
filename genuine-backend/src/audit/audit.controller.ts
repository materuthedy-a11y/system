import { Controller, Get, HttpCode, HttpStatus, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Business } from '../common/decorators/business.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { JwtAuthGuard, PermissionGuard } from '../common/guards';
import { AuditService, AuditQuery } from './audit.service';

@ApiTags('Audit trail')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('audit.view')
  @ApiOperation({ summary: 'List this business audit events' })
  list(@Business() businessId: string, @Query() query: AuditQuery) {
    return this.audit.list(businessId, query);
  }

  @Get('export')
  @RequirePermission('audit.export')
  @ApiOperation({ summary: 'Export this business audit events as CSV' })
  async export(@Business() businessId: string, @Query() query: AuditQuery, @Res() response: Response) {
    const csv = await this.audit.exportCsv(businessId, query);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="mizania-audit-log.csv"');
    response.setHeader('Cache-Control', 'private, no-store');
    return response.status(HttpStatus.OK).send(`\uFEFF${csv}`);
  }

  @Get(':id')
  @RequirePermission('audit.view')
  @ApiOperation({ summary: 'Get an audit event from this business' })
  getOne(@Business() businessId: string, @Param('id') id: string) {
    return this.audit.getOne(businessId, id);
  }
}
