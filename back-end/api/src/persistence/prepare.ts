import { createDataSource } from './data-source';
import { seed } from './seed';
(async () => {
  const ds = createDataSource();
  await ds.initialize();
  const migrations = await ds.runMigrations();
  await seed(ds);
  console.log(
    `Banco preparado. ${migrations.length} migration(s) aplicada(s); dados existentes preservados.`,
  );
  await ds.destroy();
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
