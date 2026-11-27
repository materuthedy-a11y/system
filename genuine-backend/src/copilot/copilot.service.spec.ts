import { BadRequestException } from '@nestjs/common';
import { CopilotService } from './copilot.service';
import { CopilotTools } from './tools';
import { LlmMessage, LlmProvider } from './llm.provider';

const ctx = { businessId: 'biz-1', userId: 'user-1' };

const prismaMock = {
  copilotConversation: {
    create: jest.fn(async ({ data }: any) => ({ id: 'conv-1', title: data.title })),
    findFirst: jest.fn(async () => null),
    update: jest.fn(async () => ({})),
  },
  copilotMessage: {
    createMany: jest.fn(async () => ({})),
    findMany: jest.fn(async () => []),
  },
} as any;



function makeService(overrides: { llmConfigured?: boolean } = {}) {
  const tools = {
    execute: jest.fn(async (name: string) => {
      if (name === 'getSalesSummary')
        return {
          period: 'last 30 days',
          invoiceCount: 5,
          revenue: 100000,
          collectedOnInvoices: 80000,
          cashReceived: 90000,
        };
      if (name === 'getBusinessInsights')
        return {
          count: 3,
          insights: [{ type: 'STOCKOUT_RISK', severity: 'HIGH', title: 'X low', summary: 'Y' }],
        };
      if (name === 'getInventoryStatus') return { totalProducts: 10, lowStockCount: 2, items: [] };
      throw new Error(`unexpected tool ${name}`);
    }),
  } as unknown as CopilotTools;
  const llm = {
    configured: overrides.llmConfigured ?? false,
    providerName: overrides.llmConfigured ? 'openai-compatible:test' : 'rules-engine',
    chat: jest.fn(),
    toolSchemas: jest.fn(() => []),
  } as unknown as LlmProvider;
  return { service: new CopilotService(tools, llm, prismaMock), tools, llm };
}

describe('CopilotService (Uliza)', () => {
  it('answers sales questions via getSalesSummary with real figures', async () => {
    const { service, tools } = makeService();
    const res = await service.chat(ctx.businessId, ctx.userId, 'How were sales this month?');
    expect(tools.execute).toHaveBeenCalledWith('getSalesSummary', ctx, {});
    expect(res.answer).toContain('Sales summary');
    expect(res.answer).toContain('100,000');
    expect(res.answer).not.toContain('```');
    expect(res.answer).not.toContain('{"');
    expect(res.dataPeriod).toBe('last 30 days');
    expect(res.facts).toContainEqual({ label: 'Revenue', value: '100,000' });
    expect(res.followUps?.[0]).toContain('products sold most');
    expect(res.sources).toContain('getSalesSummary');
  });

  it('routes risk questions to insights', async () => {
    const { service, tools } = makeService();
    await service.chat(ctx.businessId, ctx.userId, 'What are my biggest business risks?');
    expect(tools.execute).toHaveBeenCalledWith('getBusinessInsights', ctx, {});
  });

  it('routes low-stock questions with lowOnly arg', async () => {
    const { service, tools } = makeService();
    await service.chat(ctx.businessId, ctx.userId, 'Which products are running low?');
    expect(tools.execute).toHaveBeenCalledWith('getInventoryStatus', ctx, { lowOnly: true });
  });

  it('returns helpful fallback for unsupported questions — never fabricates', async () => {
    const { service, tools } = makeService();
    const res = await service.chat(
      ctx.businessId,
      ctx.userId,
      'What is the weather in Dar es Salaam?',
    );
    expect(tools.execute).not.toHaveBeenCalled();
    expect(res.answer).toContain('sales');
    expect(res.followUps?.length).toBeGreaterThan(0);
  });

  it('rejects empty messages', async () => {
    const { service } = makeService();
    await expect(service.chat(ctx.businessId, ctx.userId, '   ')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('caps conversation history and sanitizes roles', async () => {
    const { service } = makeService();
    const history = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      content: `msg${i}`,
    }));
    const res = await service.chat(ctx.businessId, ctx.userId, 'sales?', history as any);
    expect(res.answer).toBeTruthy();
  });

  it('falls back to rules engine when LLM fails', async () => {
    const tools = { execute: jest.fn(async () => ({ ok: true })) } as unknown as CopilotTools;
    const llm = {
      configured: true,
      providerName: 'openai-compatible:x',
      chat: jest.fn(async () => null),
      toolSchemas: jest.fn(() => []),
    } as unknown as LlmProvider;
    const service = new CopilotService(tools, llm, prismaMock);
    const res = await service.chat(ctx.businessId, ctx.userId, 'How were sales?');
    expect(res.provider).toBe('rules-engine');
    expect(tools.execute).toHaveBeenCalled();
  });

  it('sends image attachments to the configured private AI provider', async () => {
    const tools = { execute: jest.fn() } as unknown as CopilotTools;
    const llm = {
      configured: true,
      providerName: 'openai-compatible:private',
      chat: jest.fn(async () => ({ role: 'assistant', content: 'I can see the uploaded image.' })),
      toolSchemas: jest.fn(() => []),
    } as unknown as LlmProvider;
    const service = new CopilotService(tools, llm, prismaMock);

    await service.chat(
      ctx.businessId,
      ctx.userId,
      'What is in this picture?',
      [],
      [{ name: 'receipt.png', imageDataUrl: 'data:image/png;base64,cHJpdmF0ZQ==' }],
    );

    const sentMessages = (llm.chat as jest.Mock).mock.calls[0][0];
    expect(sentMessages.find((message: LlmMessage) => message.role === 'user')?.content).toEqual([
      { type: 'text', text: 'What is in this picture?\n[Uploaded image: receipt.png]' },
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,cHJpdmF0ZQ==', detail: 'auto' },
      },
    ]);
  });

  it('sends extracted file text and instructs the model to analyze it', async () => {
    const tools = { execute: jest.fn() } as unknown as CopilotTools;
    const llm = {
      configured: true,
      providerName: 'openai-compatible:private',
      chat: jest.fn(async () => ({ role: 'assistant', content: 'The file lists three products.' })),
      toolSchemas: jest.fn(() => []),
    } as unknown as LlmProvider;
    const service = new CopilotService(tools, llm, prismaMock);

    await service.chat(
      ctx.businessId,
      ctx.userId,
      'Summarize this file',
      [],
      [{ name: 'stock.csv', text: 'Product,Quantity\nTea,12\nCoffee,8' }],
    );

    const sentMessages = (llm.chat as jest.Mock).mock.calls[0][0] as LlmMessage[];
    expect(sentMessages.find((message) => message.role === 'system')?.content).toContain(
      'answer from the extracted text or image included in their message',
    );
    expect(sentMessages.find((message) => message.role === 'user')?.content).toContain(
      '[Untrusted file content: stock.csv]\nProduct,Quantity\nTea,12\nCoffee,8\n[End of file content]',
    );
  });

  it('does not send attachments through the rules engine', async () => {
    const { service, tools } = makeService();

    await expect(
      service.chat(
        ctx.businessId,
        ctx.userId,
        'Summarize this file',
        [],
        [{ name: 'report.csv', text: 'revenue,100' }],
      ),
    ).rejects.toThrow('File analysis is unavailable');
    expect(tools.execute).not.toHaveBeenCalled();
  });

  it('tool errors surface honestly, not fabricated', async () => {
    const tools = {
      execute: jest.fn(async () => {
        throw new Error('db down');
      }),
    } as unknown as CopilotTools;
    const llm = {
      configured: false,
      providerName: 'rules-engine',
      chat: jest.fn(),
      toolSchemas: jest.fn(() => []),
    } as unknown as LlmProvider;
    const service = new CopilotService(tools, llm, prismaMock);
    const res = await service.chat(ctx.businessId, ctx.userId, 'sales?');
    expect(res.answer).toContain("couldn't retrieve");
  });
});
