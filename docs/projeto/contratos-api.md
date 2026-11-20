# Contratos da API FrotaLab

Prefixo: `/api`. Tipos e campos usam inglês no código. A interface apresenta rótulos em português. Datas instantâneas usam ISO 8601 com fuso; datas civis usam `YYYY-MM-DD`. Identificadores são UUID. Dinheiro é inteiro em centavos.

## Autenticação e respostas

`POST /auth/login` recebe `{ "email": "...", "password": "..." }`, define cookie `frotalab` protegido e retorna `{ user, csrfToken }`. `GET /auth/me` recupera a sessão. `POST /auth/logout` revoga a sessão. Mutações autenticadas exigem o cabeçalho `X-CSRF-Token` retornado no login e origem autorizada.

Listas retornam `{ items, total, page, limit }` quando paginadas. Consultas de documentos, alertas e últimas posições retornam `{ items, total }`. Paginação usa `page` e `limit` (máximo 200). Cadastros suportam busca `q`; filtros adicionais são indicados abaixo. Falhas retornam `{ statusCode, message }`: 400 para entrada inválida, 401 para sessão ausente/expirada, 403 para perfil ou propriedade, 404 para ausência e 409 para conflito de negócio ou unicidade.

## Cadastros

| Recurso | Métodos | Campos de criação |
| --- | --- | --- |
| `/vehicles` | GET, POST, PATCH `/:id` | plate, model, category, capacityKg, odometer, registrationUntil, insuranceUntil |
| `/drivers` | GET, POST, PATCH `/:id` | name, email, password, licenseNumber, categories[], licenseUntil |
| `/centers` | GET, POST, PATCH `/:id` | name, address, latitude, longitude |
| `/users` | GET, POST, PATCH `/:id` | name, email, password, role |

`active` altera ativação em cadastros. Gestor e administrador mantêm veículos, motoristas e centros. Somente administrador mantém usuários. Cadastro de motorista cria a conta correspondente. Senha exige pelo menos 10 caracteres; em edição, omitir `password` preserva o valor. Campos desconhecidos são recusados. `active=true` filtra cadastros ativos.

## Operação

- `GET/POST /routes` e `PATCH /routes/:id`: name, centerId, scheduledStart, scheduledEnd, deliveryIds[]. A ordem do array define a sequência das paradas.
- `POST /routes/:id/assign`: vehicleId, driverId. Operador/administrador; valida recursos e conflitos.
- `POST /routes/:id/start`: odometer. Motorista responsável/administrador; revalida condições e registra início.
- `POST /routes/:id/complete`: odometer. Exige todas as entregas tratadas; registra fim e evento ERP na mesma transação.
- `POST /routes/:id/cancel`: reason. Apenas antes do início; preserva histórico e libera entregas para replanejamento.
- `GET/POST /deliveries` e `PATCH /deliveries/:id`: reference, recipient, address, latitude, longitude, weightKg, deadline. Alterações em entrega já atribuída são recusadas.
- `POST /deliveries/:id/complete`: corpo vazio; motorista responsável em viagem/administrador.
- `POST /deliveries/:id/cancel`: reason; operador/administrador ou motorista responsável durante viagem.
- `GET/POST /fuel`: routeId, occurredAt, odometer, liters, totalCents, station opcional. O servidor deriva veículo e motorista da rota.

Rotas e entregas aceitam filtro `status`. `GET /deliveries?available=true` retorna pendentes sem vínculo ativo. Motoristas recebem somente suas rotas, entregas e abastecimentos.

## Manutenção e documentos

- `GET/POST /maintenance-plans`, `PATCH /maintenance-plans/:id`: vehicleId, description, dueDate e/ou dueKm, intervalDays e intervalKm opcionais.
- `GET/POST /maintenance-orders`: vehicleId, planId opcional, type (`PREVENTIVE` ou `CORRECTIVE`), description, blocking.
- `POST /maintenance-orders/:id/start`: mecânico assume a ordem.
- `POST /maintenance-orders/:id/services`: description, parts, partsCents, laborCents. Valores não negativos.
- `POST /maintenance-orders/:id/complete`: exige serviço registrado; atualiza limites do plano vinculado.
- `GET /documents`: metadados autorizados, sem caminho interno.
- `POST /documents`: multipart com `file`, `type`, exatamente um de `vehicleId`/`driverId` e `validUntil` opcional. Limite de 10 MB, PDF/JPEG/PNG.
- `GET /documents/:id/download`: download autorizado como anexo.

## Rastreamento e análise

`POST /positions` recebe routeId, latitude, longitude, accuracy, recordedAt e source (`device` ou `demo`). Exige motorista da rota ativa, intervalo de cinco segundos e horário coerente. `GET /positions` fornece a última posição por veículo para gestão/operação. `GET /positions/stream` usa conexão autenticada e eventos `snapshot`, `position`, `heartbeat` e `session-expired`.

`GET /dashboard` retorna indicadores adequados ao perfil. `GET /alerts` calcula vencimentos atuais. `GET /reports/operational`, `/financial` e `/productivity` aceitam `from` e `to` inclusivos em datas civis e retornam `{ period, summary, items }`. Acrescentar `.csv` ao tipo exporta o mesmo recorte. O término do período corresponde ao início exclusivo do dia seguinte no Brasil.

`GET /audit` é restrito ao administrador e consulta alterações relevantes sem senhas.

## ERP de referência

`GET /integrations` e `POST /integrations/:id/retry` são restritos ao administrador. Eventos persistidos têm eventId único, payload, status, attempts, nextAttemptAt e result. Estados: `PENDING`, `SENT`, `FAILED`. Há até cinco tentativas automáticas com intervalos crescentes; reenvio manual continua disponível após falha.

O adaptador envia `POST` à URL configurada em `ERP_URL`, com `Authorization: Bearer <ERP_SECRET>` e `Idempotency-Key: <eventId>`. O corpo contém eventId, type `route.completed`, routeId, name, completedAt, distanceKm e expenses[] com id, totalCents e occurredAt. O receptor responde 2xx para aceite e para duplicata já aceita. Respostas não 2xx ou ausência de resposta em três segundos são falhas. A API não segue redirecionamentos.

O receptor demonstrativo executa em `127.0.0.1:3002/events`, valida segredo e identificador e persiste eventos em arquivo. O contrato demonstra integração genérica; não representa um ERP comercial homologado.
