# FrotaLab

- **Discente:** Rute Cristina Bach
- **Docente:** Prof. Wellington de Souza Ferreira
- **Disciplina:** Projeto e Desenvolvimento de Sistemas Web

Sistema acadêmico de gerenciamento de frotas e logística para o Exame de Suficiência de Projeto e Desenvolvimento de Sistemas Web, UTFPR. O projeto implementa os 13 requisitos do modelo-base: autenticação, veículos, motoristas, rotas, rastreamento, entregas, abastecimentos, manutenção, serviços, alertas, indicadores, relatórios e documentos.

A stack (conjunto de tecnologias) utiliza TypeScript, Next.js 16/React 19, Tailwind CSS, React Hook Form e Zod na interface; NestJS 11, TypeORM e PostgreSQL no servidor. As versões instaladas estão fixadas em `pnpm-lock.yaml`.

## Início rápido

Pré-requisitos: Node.js 22 ou superior e pnpm 11. Na pasta `FrotaLab`, execute:

```sh
pnpm install --frozen-lockfile
pnpm configure
pnpm dev
```

- `pnpm install` baixa as dependências, incluindo o PostgreSQL portátil. Os scripts de instalação permitidos estão em `pnpm-workspace.yaml`.
- `pnpm configure` cria `back-end/.env` a partir de `back-end/.env.example`, com segredos aleatórios. Um arquivo existente é preservado.
- `pnpm dev` inicia o PostgreSQL portátil se necessário, aplica as migrations (evoluções versionadas do banco), carrega os dados fictícios sem apagar registros e inicia API, interface e receptor ERP.

Abra [http://localhost:3000](http://localhost:3000). A documentação da API está em [http://localhost:3001/api/docs](http://localhost:3001/api/docs). Use Ctrl+C para encerrar.

No Windows, o inicializador faz o mesmo e instala as dependências que faltarem:

```powershell
powershell -ExecutionPolicy Bypass -File .\Iniciar-FrotaLab.ps1
```

## Contas fictícias

| Perfil                    | E-mail                   |
| ------------------------- | ------------------------ |
| Administrador             | admin@frotalab.test      |
| Gestor                    | gestor@frotalab.test     |
| Operador                  | operador@frotalab.test   |
| Motorista                 | motorista@frotalab.test  |
| Segundo motorista         | motorista2@frotalab.test |
| Motorista com CNH vencida | vencido@frotalab.test    |
| Mecânico                  | mecanico@frotalab.test   |

Senha inicial: `FrotaLab@2026`, salvo alteração de `SEED_PASSWORD` antes do primeiro seed (carga inicial). Alterar a variável depois não redefine senhas já gravadas. Esses dados são públicos e não devem ser usados em uma operação real.

## Organização

```text
FrotaLab/
├── front-end/
│   ├── app/               Páginas e estilos (app/styles)
│   ├── components/        Componentes e configuração dos módulos
│   ├── lib/               Funções de apoio e sessão
│   └── test/              Testes de navegador e de datas
├── back-end/
│   ├── api/src/modules/   Módulos da API, cada um com serviço e controller
│   ├── api/src/persistence/  Entidades, migrations, carga inicial e conexão
│   ├── api/test/          Testes de regras e integração
│   ├── database/          PostgreSQL portátil, Docker e dados locais
│   ├── storage/           Anexos e eventos ERP locais (não versionados)
│   ├── scripts/           Configuração, receptor ERP e conferência de persistência
│   └── .env.example       Modelo da configuração privada
├── docs/                  Documentação técnica e diagramas
├── scripts/               Inicialização e verificação
├── .cache/                Temporários e registros de pnpm verify (não versionados)
└── Iniciar-FrotaLab.ps1
```

Os estilos da interface são classes próprias; o Tailwind fornece a base. O material original da disciplina e o PDF de escopo ficam na pasta superior, fora do projeto.

## Outras formas de executar

Use uma forma por vez: encerre a instância em execução antes de iniciar outra.

### Componentes separados

Em terminais diferentes, na raiz e nesta ordem:

```sh
pnpm db
pnpm db:prepare
pnpm dev:api
pnpm dev:web
pnpm erp:demo
```

Mantenha o banco aberto. `pnpm db:prepare` termina sozinho, e o ERP só é necessário para testar a integração.

Para mudar a porta da API, altere `API_PORT` em `back-end/.env`. O `pnpm dev` repassa o valor à interface. Ao iniciar o front-end sozinho, defina a mesma variável no terminal.

### VS Code

Abra a pasta **FrotaLab** e, em **Executar e Depurar** (`Ctrl+Shift+D`), escolha uma configuração e pressione **F5**. **Shift+F5** encerra a sessão.

| Configuração                   | Comportamento                                                   |
| ------------------------------ | --------------------------------------------------------------- |
| FrotaLab completo              | Inicia banco, API, front-end e ERP na ordem necessária.         |
| 1. Banco de dados (PostgreSQL) | Inicia o banco portátil e mantém os dados existentes.           |
| 2. API (NestJS)                | Com o banco ligado, prepara o banco e inicia API com depuração. |
| 3. Front-end (Next.js)         | Inicia a interface em `http://localhost:3000`.                  |
| 4. ERP de demonstração         | Inicia o receptor local usado para testar a integração.         |

Ao iniciar separadamente, siga a ordem banco, API e front-end.

### Docker ou PostgreSQL existente

O banco portátil é um servidor PostgreSQL real, com arquivos persistentes. Para usar Docker:

```sh
docker compose --env-file back-end/.env -f back-end/database/compose.yaml up -d database
pnpm dev
```

Também é possível apontar `DATABASE_URL` para uma instalação existente, com um banco exclusivo do projeto e permissão para criar tabelas e índices. `synchronize` permanece desativado: alterações estruturais são feitas por migrations, em `back-end/api/src/persistence/migration.ts`.

## Demonstração principal

1. Entre como gestor e consulte ou cadastre veículos, motoristas e centros. Confira alertas e documentos.
2. Entre como operador, cadastre entregas, organize as paradas de uma rota e atribua veículo e motorista disponíveis.
3. Entre como motorista, inicie a rota atribuída com o hodômetro atual, autorize localização e registre abastecimento e entregas.
4. Conclua ou cancele com motivo todas as entregas e encerre a viagem com hodômetro final válido.
5. Entre como mecânico, inicie uma ordem aberta, registre o serviço e conclua a manutenção.
6. Entre como gestor e consulte relatórios e exportações. Como administrador, consulte a integração gerada ao concluir a rota.

Há uma rota já atribuída a `motorista@frotalab.test`. A habilitação de `vencido@frotalab.test` está vencida de propósito. A Fiorino possui manutenção pendente para demonstrar bloqueios e alertas. Registros históricos são relativos à primeira carga; ajuste o período dos relatórios para incluí-los.

## Verificação

Com o PostgreSQL iniciado:

```sh
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm verify` executa tudo isso, grava o resultado em `docs/verificacao/verificacao.json` e os registros em `.cache/checks`.

- Os testes de API usam exclusivamente o banco `frotalab_test`, recriado a cada arquivo de testes. Não aponte outro sistema para esse nome. Os anexos deles ficam em `back-end/storage/uploads`.
- Os testes de navegador exigem a aplicação em execução e a senha inicial das contas. Eles gravam um veículo e um anexo de teste no banco em uso.
- No Windows, os testes de navegador usam o Microsoft Edge instalado. Em outros sistemas, execute `pnpm exec playwright install chromium`. A gravação exige `pnpm exec playwright install ffmpeg` em todos os sistemas.

## Preservação de dados

Ao reiniciar, migrations aplicadas não se repetem e o seed não substitui dados existentes. Não apague `back-end/database/data` nem `back-end/storage` para atualizar o sistema.

Para copiar os dados, encerre os serviços e copie `back-end/database/data` junto com `back-end/storage`, que guarda anexos e eventos do ERP. Em banco externo, use as ferramentas PostgreSQL de cópia e restauração. A configuração privada fica em `back-end/.env`.

## Documentação

O [índice da documentação](docs/README.md) reúne regras, contratos da API, matriz de requisitos e diagramas. O roteiro, o relatório e as evidências de verificação ficam em pastas locais excluídas do pacote de código.
