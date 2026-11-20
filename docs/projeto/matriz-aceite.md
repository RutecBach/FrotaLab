# Matriz de requisitos e evidências

A numeração corresponde ao documento-base do professor. Os testes usam dados fictícios e PostgreSQL. A gravação usa coordenadas de demonstração identificadas; não representa trajeto físico realizado por uma pessoa.

| Requisito | Implementação | Evidência automatizada / demonstração |
| --- | --- | --- |
| RF01 Autenticação | `modules/auth`, login, proteção no servidor | Teste API RF01; navegação de sessão ativa, visitante e cookie inválido nas páginas públicas; entrada com perfis distintos no vídeo |
| RF02 Veículos | `modules/catalog`, página Veículos | Testes de unicidade, persistência e desativação; cadastro no navegador |
| RF03 Motoristas | `modules/catalog`, habilitações e contas | Teste de validade na atribuição; cadastro de motorista no vídeo |
| RF04 Rotas | `modules/routes`, atribuição transacional | Disputa concorrente: uma atribuição aceita e uma recusada; planejamento no vídeo |
| RF05 Localização | `modules/tracking`, `DriverLocation.tsx`, `Tracking.tsx` | Testes de entrada válida/inválida, propriedade e intervalo; mapa com amostra fictícia identificada |
| RF06 Entregas | `modules/deliveries`, conclusão, cancelamento, atraso | Testes de pontualidade e viagem completa; conclusão e cancelamento com justificativa no vídeo |
| RF07 Abastecimentos | `modules/fuel`, página Abastecimentos | Teste de valores e vínculo à rota; registro no vídeo |
| RF08 Manutenção | `modules/maintenance`, planos e ordens | Teste de revisão vencida; ordem preventiva no vídeo |
| RF09 Serviços | `modules/maintenance`, registro pelo responsável | Teste de peças/mão de obra e conclusão; execução no vídeo |
| RF10 Alertas | `modules/insights`, página Alertas | Testes de limites de validade e revisão; lista de pendências no vídeo |
| RF11 Indicadores | `modules/insights`, painel | Dados do banco; painel por perfil e produtividade no vídeo |
| RF12 Relatórios | `modules/insights`, três consultas e CSV | Teste de custos e período inválido; distinção entre indicador de conclusões e coluna de atraso no navegador; relatórios no vídeo |
| RF13 Documentos | `modules/documents`, armazenamento privado | Arquivo disfarçado recusado, download sem sessão e por perfil recusado; envio pelo formulário e download com comparação de conteúdo no navegador |

Complementos de contextualização: mapa Leaflet/OpenStreetMap; rastreamento pelo navegador; adaptador HTTP para ERP; receptor local autenticado e persistente. O teste de integração simula perda de confirmação externa e verifica reenvio sem duplicar o evento lógico.

## Verificação registrada durante o desenvolvimento

- 4 testes de regras passaram.
- 7 cenários de API passaram.
- 9 cenários de módulos e integração passaram.
- 7 percursos de navegador passaram, incluindo versão móvel sem transbordamento horizontal, navegação de sessão, rótulos do relatório e envio/download de documento.
- Compilação TypeScript da API e compilação de produção do Next.js passaram.
- Preparação do banco repetida: nenhuma migration pendente, sem apagar dados.

Os resultados finais e eventuais testes adicionais da revisão devem ser conferidos em `docs/verificacao/verificacao.json`. A gravação e o relatório distinguem implementação funcional de validação física de GPS, homologação de ERP comercial e submissão ao Moodle.
