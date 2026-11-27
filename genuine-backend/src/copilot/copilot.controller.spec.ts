import { BadRequestException } from '@nestjs/common';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';

describe('CopilotController uploads', () => {
  const createController = () => {
    const copilot = { chat: jest.fn(async () => ({ answer: 'ok' })) } as unknown as CopilotService;
    return { controller: new CopilotController(copilot), copilot };
  };

  it('extracts CSV text and forwards it to Ask', async () => {
    const { controller, copilot } = createController();

    await controller.chat('business-1', 'user-1', { message: 'Summarize this' }, [
      { originalname: 'report.csv', buffer: Buffer.from('amount\n120') },
    ]);

    expect(copilot.chat).toHaveBeenCalledWith(
      'business-1',
      'user-1',
      'Summarize this',
      [],
      [{ name: 'report.csv', text: 'amount\n120' }],
      undefined,
    );
  });

  it('forwards a validated image as a data URL', async () => {
    const { controller, copilot } = createController();
    const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2]);

    await controller.chat('business-1', 'user-1', { message: 'Describe this' }, [
      { originalname: 'photo.png', buffer: image },
    ]);

    expect(copilot.chat).toHaveBeenCalledWith(
      'business-1',
      'user-1',
      'Describe this',
      [],
      [{ name: 'photo.png', imageDataUrl: `data:image/png;base64,${image.toString('base64')}` }],
      undefined,
    );
  });

  it('rejects images whose content does not match the file extension', async () => {
    const { controller, copilot } = createController();

    await expect(
      controller.chat('business-1', 'user-1', { message: 'Describe this' }, [
        { originalname: 'photo.png', buffer: Buffer.from('not an image') },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(copilot.chat).not.toHaveBeenCalled();
  });
});
