import { Module } from '@nestjs/common';
import { PurchasesModule } from '../purchases/purchases.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';

@Module({
  imports: [PurchasesModule],
  controllers: [InsightsController, PredictionsController],
  providers: [InsightsService, PredictionsService],
  exports: [InsightsService],
})
export class IntelligenceModule {}
