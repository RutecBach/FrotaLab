import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { access, mkdir, writeFile, unlink } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { z } from 'zod';
import { Document, Driver, User } from '../../persistence/entities';
import { parse, uuid, date, text, permit, manage, identity, audit } from '../../common';
@Injectable()
export class DocumentsService {
  constructor(@Inject(DataSource) readonly ds: DataSource) {}
  async allow(doc: Document, user: User) {
    if (['ADMIN', 'MANAGER', 'OPERATOR', 'MECHANIC'].includes(user.role)) return;
    const driver = await this.ds.getRepository(Driver).findOneBy({ userId: user.id });
    if (!driver || doc.driverId !== driver.id)
      throw new ForbiddenException('Sem acesso a este documento.');
  }
  async list(user: User) {
    const where =
      user.role === 'DRIVER'
        ? {
            driverId:
              (await this.ds.getRepository(Driver).findOneBy({ userId: user.id }))?.id ||
              '00000000-0000-0000-0000-000000000000',
          }
        : {};
    const rows = await this.ds
      .getRepository(Document)
      .find({ where, order: { createdAt: 'DESC' } });
    return { items: rows.map(({ storageKey, ...d }) => d), total: rows.length };
  }
  async upload(file: Express.Multer.File | undefined, body: unknown, user: User) {
    permit(user, manage);
    const data = parse(
      z
        .object({
          vehicleId: uuid.optional(),
          driverId: uuid.optional(),
          type: text,
          validUntil: date.optional(),
        })
        .strict()
        .refine((d) => !!d.vehicleId !== !!d.driverId, 'Selecione somente veículo ou motorista.'),
      body,
    );
    if (!file?.buffer?.length) throw new BadRequestException('Selecione um documento.');
    const ext = extname(file.originalname).toLowerCase();
    const b = file.buffer;
    const valid =
      (ext === '.pdf' &&
        file.mimetype === 'application/pdf' &&
        b.subarray(0, 5).toString() === '%PDF-') ||
      (['.jpg', '.jpeg'].includes(ext) &&
        file.mimetype === 'image/jpeg' &&
        b[0] === 255 &&
        b[1] === 216 &&
        b[2] === 255) ||
      (ext === '.png' &&
        file.mimetype === 'image/png' &&
        b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
    if (!valid || b.length > 10 * 1024 * 1024)
      throw new BadRequestException('Envie PDF, JPEG ou PNG válido, com até 10 MB.');
    const root = resolve(process.env.UPLOAD_DIR || 'storage/uploads');
    await mkdir(root, { recursive: true });
    const storageKey = `${randomUUID()}${ext}`;
    const originalName = basename(file.originalname.replaceAll('\\', '/'))
      .replace(/[\x00-\x1f\x7f]/g, '')
      .slice(0, 180);
    await writeFile(resolve(root, storageKey), b, { flag: 'wx' });
    try {
      const saved = await this.ds.transaction(async (em) => {
        const doc = await em
          .getRepository(Document)
          .save({ ...data, storageKey, originalName, mimeType: file.mimetype, size: b.length });
        await audit(em, user, 'document', doc.id, 'UPLOAD');
        return doc;
      });
      const { storageKey: _, ...safe } = saved;
      return safe;
    } catch (error) {
      await unlink(resolve(root, storageKey));
      throw error;
    }
  }
  async download(id: string, user: User, res: any) {
    const doc = await this.ds.getRepository(Document).findOneBy({ id: identity(id) });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    await this.allow(doc, user);
    if (!/^[a-f0-9-]{36}\.(pdf|png|jpe?g)$/.test(doc.storageKey)) throw new NotFoundException();
    const path = resolve(process.env.UPLOAD_DIR || 'storage/uploads', doc.storageKey);
    await access(path).catch(() => {
      throw new NotFoundException('Arquivo do documento não encontrado.');
    });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(path, doc.originalName);
  }
}
