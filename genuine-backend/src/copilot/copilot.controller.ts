import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { extname, basename } from 'path';
import { PDFParse } from 'pdf-parse';
import WordExtractor from 'word-extractor';
import { Business } from '../common/decorators/business.decorator';
import { UserId } from '../common/decorators/auth.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CopilotAttachment, CopilotService } from './copilot.service';

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_EXTRACTED_TEXT = 20_000;
const MAX_VISION_IMAGES = 5;
const ALLOWED_EXTENSIONS = new Set([
  '.csv',
  '.pdf',
  '.doc',
  '.docx',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);
const DOCX_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const DOC_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

interface UploadedMemoryFile {
  originalname: string;
  buffer: Buffer;
}

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

class ChatDto {
  @IsString() @MaxLength(2000) message!: string;
  @IsOptional() history?: unknown;
  @IsOptional() @IsString() conversationId?: string;
}

@ApiTags('Uliza')
@ApiBearerAuth()
@Controller('copilot')
@UseGuards(JwtAuthGuard)
export class CopilotController {
  constructor(private readonly copilot: CopilotService) {}

  @Get('status')
  status() {
    return {
      assistant: 'Uliza',
      provider: this.copilot.providerName,
      llmConfigured: this.copilot.providerName !== 'rules-engine',
    };
  }

  @Get('suggestions')
  suggestions() {
    return {
      suggestions: [
        'How were sales this month?',
        'Which products are running low?',
        'What are my biggest business risks?',
        'Show outstanding invoices',
        'How is cash flow looking?',
        'Which customers might stop buying?',
      ],
    };
  }

  @Get('conversations')
  listConversations(@Business() businessId: string, @UserId() userId: string) {
    return this.copilot.listConversations(businessId, userId);
  }

  @Get('conversations/:id')
  getConversation(
    @Business() businessId: string,
    @UserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.copilot.getConversation(businessId, userId, id);
  }

  @Delete('conversations/:id')
  deleteConversation(
    @Business() businessId: string,
    @UserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.copilot.deleteConversation(businessId, userId, id);
  }

  @Post('chat')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
      fileFilter: (_request, file, callback) => {
        const extension = extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(extension)) {
          callback(
            new BadRequestException(
              'Only CSV, PDF, DOC/DOCX, PNG, JPG, and WEBP files are supported.',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async chat(
    @Business() businessId: string,
    @UserId() userId: string,
    @Body() dto: ChatDto,
    @UploadedFiles() files: UploadedMemoryFile[] = [],
  ) {
    const history = this.parseHistory(dto.history);
    const attachments = await this.extractAttachments(files);
    return this.copilot.chat(
      businessId,
      userId,
      dto.message,
      history,
      attachments,
      dto.conversationId,
    );
  }

  private parseHistory(value: unknown): HistoryMessage[] {
    let history = value;
    if (typeof history === 'string') {
      if (history.length > 30_000) throw new BadRequestException('Chat history is too large.');
      try {
        history = JSON.parse(history);
      } catch {
        throw new BadRequestException('Chat history must be valid JSON.');
      }
    }
    if (history === undefined || history === null) return [];
    if (!Array.isArray(history))
      throw new BadRequestException('Chat history must be a list of messages.');
    return history.slice(-10).map((message) => {
      if (
        !message ||
        (message.role !== 'user' && message.role !== 'assistant') ||
        typeof message.content !== 'string' ||
        message.content.length > 2000
      ) {
        throw new BadRequestException('Chat history contains an invalid message.');
      }
      return { role: message.role, content: message.content };
    });
  }

  private async extractAttachments(files: UploadedMemoryFile[]): Promise<CopilotAttachment[]> {
    const attachments: CopilotAttachment[] = [];
    let extractedLength = 0;
    let visionImageCount = 0;

    for (const file of files) {
      const extension = extname(file.originalname).toLowerCase();
      const name = basename(file.originalname)
        .replace(/[\r\n]/g, '_')
        .slice(0, 120);
      if (!file.buffer?.length) throw new BadRequestException(`${name} is empty.`);

      if (['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) {
        if (visionImageCount >= MAX_VISION_IMAGES) {
          throw new BadRequestException(
            `Ask can analyze up to ${MAX_VISION_IMAGES} images at a time.`,
          );
        }
        const image = this.validateImage(extension, file.buffer, name);
        attachments.push({
          name,
          imageDataUrl: `data:${image.mimeType};base64,${file.buffer.toString('base64')}`,
        });
        visionImageCount++;
        continue;
      }

      let text: string;
      if (extension === '.csv') {
        if (file.buffer.includes(0))
          throw new BadRequestException(`${name} is not a valid text CSV file.`);
        text = file.buffer
          .toString('utf8')
          .replace(/^\uFEFF/, '')
          .trim();
      } else if (extension === '.pdf') {
        if (file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
          throw new BadRequestException(`${name} is not a valid PDF file.`);
        }
        const parser = new PDFParse({ data: new Uint8Array(file.buffer), isEvalSupported: false });
        let renderedPages = 0;
        try {
          const result = await parser.getText();
          const pagesWithText = result.pages
            .map((page) => ({
              num: page.num,
              text: page.text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '').trim(),
            }))
            .filter((page) => page.text);
          text = pagesWithText.map((page) => `Page ${page.num}:\n${page.text}`).join('\n\n');

          const imageOnlyPages = result.pages.filter(
            (page) => !page.text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '').trim(),
          );
          if (imageOnlyPages.length) {
            const availableImages = MAX_VISION_IMAGES - visionImageCount;
            if (imageOnlyPages.length > availableImages) {
              throw new BadRequestException(
                `${name} has ${imageOnlyPages.length} scanned pages. Ask can analyze up to ${availableImages} more page images in this message; split the PDF and try again.`,
              );
            }
            const screenshots = await parser.getScreenshot({
              partial: imageOnlyPages.map((page) => page.num),
              desiredWidth: 1400,
              imageDataUrl: false,
              imageBuffer: true,
            });
            for (const page of screenshots.pages) {
              attachments.push({
                name: `${name} (page ${page.pageNumber})`,
                imageDataUrl: `data:image/png;base64,${Buffer.from(page.data).toString('base64')}`,
              });
              visionImageCount++;
              renderedPages++;
            }
            if (!renderedPages) {
              throw new BadRequestException(
                `${name} pages could not be rendered for image analysis.`,
              );
            }
          }
        } catch (error) {
          if (error instanceof BadRequestException) throw error;
          throw new BadRequestException(`${name} could not be read for text or image analysis.`);
        } finally {
          await parser.destroy();
        }
        if (!text && !renderedPages) {
          throw new BadRequestException(`${name} has no readable text or pages to analyze.`);
        }
      } else if (extension === '.docx') {
        if (!file.buffer.subarray(0, 4).equals(DOCX_SIGNATURE)) {
          throw new BadRequestException(`${name} is not a valid DOCX file.`);
        }
        const mammoth = await import('mammoth');
        try {
          text = (await mammoth.extractRawText({ buffer: file.buffer })).value.trim();
        } catch {
          throw new BadRequestException(`${name} could not be read as a DOCX file.`);
        }
      } else {
        if (!file.buffer.subarray(0, 8).equals(DOC_SIGNATURE)) {
          throw new BadRequestException(`${name} is not a valid DOC file.`);
        }
        try {
          text = (await new WordExtractor().extract(file.buffer)).getBody().trim();
        } catch {
          throw new BadRequestException(`${name} could not be read as a DOC file.`);
        }
      }

      if (text) {
        extractedLength += text.length;
        if (extractedLength > MAX_EXTRACTED_TEXT) {
          throw new BadRequestException(
            'Combined document text exceeds 20,000 characters. Split the files and ask again.',
          );
        }
        attachments.push({ name, text });
      }
    }

    return attachments;
  }

  private validateImage(extension: string, buffer: Buffer, name: string): { mimeType: string } {
    const png =
      extension === '.png' &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg =
      ['.jpg', '.jpeg'].includes(extension) &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
    const webp =
      extension === '.webp' &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    if (!png && !jpeg && !webp)
      throw new BadRequestException(`${name} does not match its image file type.`);
    return { mimeType: png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp' };
  }
}
