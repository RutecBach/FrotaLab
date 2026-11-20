import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IntegrationJob, User } from '../../persistence/entities';
import { permit, identity, audit } from '../../common';
@Injectable()
export class IntegrationService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private working = false;
  constructor(@Inject(DataSource) readonly ds: DataSource) {}
  onModuleInit() {
    if (process.env.INTEGRATION_WORKER !== 'false') {
      this.timer = setInterval(() => void this.tick(), 10000);
      this.timer.unref();
    }
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async list(user: User) {
    permit(user, ['ADMIN']);
    const items = await this.ds
      .getRepository(IntegrationJob)
      .find({ order: { createdAt: 'DESC' }, take: 200 });
    return {
      items,
      total: items.length,
      configured: !!(process.env.ERP_URL && process.env.ERP_SECRET),
    };
  }
  async send(id: string, user?: User) {
    if (user) permit(user, ['ADMIN']);
    identity(id);
    return this.ds.transaction(async (em) => {
      const job = await em
        .getRepository(IntegrationJob)
        .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!job) throw new NotFoundException();
      if (job.status === 'SENT') return job;
      if (!process.env.ERP_URL || !process.env.ERP_SECRET)
        throw new ConflictException('Configure ERP_URL e ERP_SECRET para sincronizar.');
      job.attempts++;
      try {
        const response = await fetch(process.env.ERP_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.ERP_SECRET}`,
            'Idempotency-Key': job.eventId,
          },
          body: JSON.stringify({ eventId: job.eventId, ...job.payload }),
          signal: AbortSignal.timeout(3000),
          redirect: 'error',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        job.status = 'SENT';
        job.result = `Recebido com HTTP ${response.status}`;
        job.nextAttemptAt = null;
      } catch (error: any) {
        job.status = job.attempts >= 5 ? 'FAILED' : 'PENDING';
        job.result = String(error.message).slice(0, 200);
        job.nextAttemptAt =
          job.attempts >= 5
            ? null
            : new Date(Date.now() + Math.min(300000, 5000 * 2 ** job.attempts));
      }
      await em.getRepository(IntegrationJob).save(job);
      if (user) await audit(em, user, 'integration', id, 'RETRY', { status: job.status });
      return job;
    });
  }
  async tick() {
    if (this.working || !this.ds.isInitialized || !process.env.ERP_URL || !process.env.ERP_SECRET)
      return;
    this.working = true;
    try {
      const jobs = await this.ds
        .getRepository(IntegrationJob)
        .createQueryBuilder('j')
        .where('j.status=:s AND j."nextAttemptAt"<=:now', { s: 'PENDING', now: new Date() })
        .take(5)
        .getMany();
      for (const job of jobs) await this.send(job.id);
    } catch (e: any) {
      console.error('Integração pendente:', e.message);
    } finally {
      this.working = false;
    }
  }
}
