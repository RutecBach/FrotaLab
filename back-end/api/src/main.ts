import { createDataSource } from './persistence/data-source';
import { createApplication } from './app';
(async () => {
  const ds = createDataSource();
  await ds.initialize();
  await ds.runMigrations();
  const app = await createApplication(ds);
  const port = Number(process.env.API_PORT || 3001);
  await app.listen(port, '127.0.0.1');
  console.log(`FrotaLab API: http://localhost:${port}/api/docs`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
