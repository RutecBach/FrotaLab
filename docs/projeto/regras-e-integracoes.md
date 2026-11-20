# Regras e integrações

## Regras relevantes

- Autorização é conferida na API, incluindo propriedade das operações do motorista.
- Sessão usa JWT (token de autenticação assinado) em cookie `HttpOnly`, com expiração e revogação. Alterações exigem token contra CSRF (falsificação de requisições entre sites) e origem permitida.
- Rotas passam por planejamento, atribuição, execução e conclusão. Atribuição e início revalidam habilitação, documentos, categoria, carga, manutenção e concorrência.
- Entrega atrasada é calculada pelo prazo e pelo instante real de conclusão. Cancelamento exige justificativa.
- Valores monetários são inteiros em centavos. Hodômetro não pode diminuir. Distância vem de leituras de rotas concluídas.
- Relatório financeiro apresenta despesas registradas, sem inventar receitas ou lucro. Filtros de interface e CSV são iguais.
- Revisões e documentos geram alertas por data ou quilometragem. Validade de uma data inclui o próprio dia em `America/Sao_Paulo`.
- Documentos aceitam PDF, JPEG e PNG, até 10 MB, com validação de assinatura, nome seguro e download autenticado.

## Rastreamento

O navegador do motorista fornece posições por `watchPosition` com consentimento. A página precisa permanecer ativa. Acesso por celular em rede exige HTTPS; `localhost` permite ensaio no próprio computador. O servidor não garante autenticidade física das coordenadas recebidas. O operador recebe atualizações por Server-Sent Events (eventos enviados pelo servidor); após 60 segundos sem amostra, a posição fica marcada como desatualizada.

O mapa usa Leaflet e OpenStreetMap, com atribuição visível e provedor configurável por `NEXT_PUBLIC_MAP_TILE_URL`. A lista de coordenadas continua disponível se o mapa externo falhar. A aplicação não calcula trajetos rodoviários nem promete coleta em segundo plano com a tela bloqueada.

## Integração com ERP

O ERP (sistema integrado de gestão empresarial) de referência recebe eventos HTTP de rotas concluídas e despesas. A API mantém uma fila persistente, prazo de resposta, tentativas e reenvio manual. Identificadores idempotentes evitam duplicação. O receptor local guarda os eventos em `back-end/storage/erp/events.json`; credenciais vêm do ambiente. Falha do ERP não desfaz a conclusão da viagem. Um ERP comercial exige adaptação e acesso ao produto escolhido; o projeto não alega homologação comercial.
