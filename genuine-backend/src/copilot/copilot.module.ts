import { Module } from '@nestjs/common';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';
import { CopilotTools } from './tools';
import { LlmProvider } from './llm.provider';

@Module({
  imports: [IntelligenceModule],
  controllers: [CopilotController],
  providers: [CopilotService, CopilotTools, LlmProvider],
})
export class CopilotModule {}
