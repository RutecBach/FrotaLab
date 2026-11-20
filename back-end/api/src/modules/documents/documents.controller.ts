import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
@Controller('documents')
export class DocumentsController {
  constructor(@Inject(DocumentsService) private service: DocumentsService) {}
  @Get() list(@Req() r: any) {
    return this.service.list(r.user);
  }
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      defParamCharset: 'utf8',
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 },
    }),
  )
  upload(@UploadedFile() f: Express.Multer.File, @Body() b: unknown, @Req() r: any) {
    return this.service.upload(f, b, r.user);
  }
  @Get(':id/download') download(@Param('id') id: string, @Req() r: any, @Res() res: any) {
    return this.service.download(id, r.user, res);
  }
}
