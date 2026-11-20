# Decisões de implementação

As escolhas abaixo foram tomadas para executar a proposta aprovada.

| Decisão | Motivo | Consequência se precisar mudar |
| --- | --- | --- |
| Usar a pasta atual e a branch feat/frotalab | O projeto começou sem código nem branch principal; nenhum trabalho anterior precisava de isolamento | O histórico pode ser levado a outra branch sem alterar a aplicação |
| Manter dependências em um manifesto raiz | Evita versões divergentes entre as aplicações e simplifica instalação | Separar pacotes posteriormente exige reorganizar comandos, sem alterar regras |
| Registrar o andamento com ferramentas nativas do Windows | O auxiliar Git Bash não conseguiu criar seu diretório no ambiente gerenciado | O formato de registro e as evidências de commits foram preservados |
| Fornecer PostgreSQL portátil para desenvolvimento | O serviço Docker estava indisponível; o banco real e a persistência foram mantidos | Há uma dependência de desenvolvimento adicional; Docker e instalação existente continuam possíveis |
| Usar coordenadas controladas nas evidências | Permite testes repetíveis e evita coleta de localização física sem necessidade | A gravação não comprova hardware GPS; o modo de dispositivo exige autorização e contexto seguro |
| Preservar o histórico de planos preventivos avulsos | Excluir plano concluído quebrava o vínculo com ordens e perdia referência | Planos concluídos ficam inativos e podem ser reativados de forma explícita |
| Completar revisão interrompida com outro modelo disponível | A primeira execução retornou achados e ficou indisponível antes do parecer | O relatório de revisão distingue as duas etapas e as regressões, sem alegar uma aprovação que não ocorreu |

Não houve publicação nem submissão externa durante a implementação local. A matrícula não foi informada e permanece em branco no relatório.


## Reorganização solicitada em 2 de novembro de 2026

A API e seus testes ficam em `back-end/api`; a inicialização e os dados PostgreSQL ficam em `back-end/database`. Configuração privada, anexos e eventos ERP também pertencem ao back-end. Cada componente declara suas próprias dependências, mantendo uma instalação coordenada na raiz; instalações totalmente independentes exigiriam arquivos de versões separados.

Automações gerais ficam em `scripts`; temporários, em `.cache`. Documentação e entregas permanecem na raiz. Essa escolha preserva os comandos do conjunto e permite execução por componente.

O adaptador `@nestjs/platform-express` importa RxJS sem declarar essa dependência no pacote publicado. A antiga instalação na raiz encobria essa ausência. A declaração em `packageExtensions` corrige a resolução dentro do pacote, sem alterar versões. A resolução falhou antes da correção e passou depois; os 23 testes e as duas compilações também passaram.

A observação da revisão sobre espaços finais foi conferida nos bytes: as linhas citadas não têm espaços ou tabulações finais novos; o aviso corresponde ao CRLF já armazenado nos documentos históricos. A conferência Git com `core.whitespace=cr-at-eol` passou. A formatação original foi preservada.
