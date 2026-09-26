# Incidente de segurança: remoção de dump do histórico Git

- Data: 2026-09-26
- Repositório: sjtecnologia/equili
- Status: dump removido do histórico local e remoto; credenciais devem ser rotacionadas no ambiente de produção

## O que foi exposto

O arquivo `database_dump.sql` continha dados sensíveis reais e foi identificado em um repositório público. Em razão do risco de acesso público, assumimos que qualquer dado incluído no dump pode ter sido acessado por terceiros.

## O que foi feito

- Criação de branch de backup: `backup-pre-limpeza`
- Backup externo do dump em pasta fora do repositório: `C:\Users\rgran\Documents\equili-security-backups\database_dump.sql`
- Exclusão do dump do índice e commit de segurança
- Purga do histórico com `git filter-branch`
- Limpeza de refs órfãs e garbage collection
- Push do histórico reescrito com `git push --force --all origin` e `git push --force --tags origin`

## Rotação obrigatória de credenciais

As credenciais abaixo devem ser rotacionadas imediatamente no ambiente de produção, mesmo que não exista prova definitiva de uso:

1. `SECRET_KEY` do backend
   - gerar nova chave forte
   - atualizar no `.env` de produção / secrets manager
2. `GITHUB_TOKEN`
   - regenerar token no GitHub
   - atualizar em ambiente de produção
3. `RESEND_API_KEY`
   - gerar nova chave e atualizar no ambiente de produção
4. `STRIPE_SECRET_KEY`
   - gerar nova chave e atualizar no ambiente de produção
5. `VAPID` keys
   - gerar novo par de chaves e atualizar no deploy
6. Qualquer senha de banco que apareça no dump
   - trocar imediatamente e reiniciar a aplicação com a nova senha

## Observação importante

Este workspace local não possui acesso ao ambiente de produção real ou aos secrets ativos em execução. Portanto, a rotação final precisa ser executada nas plataformas de deploy/secret manager e no painel do provedor correspondente. O arquivo físico foi preservado apenas em backup externo, fora do repositório, para eventual investigação forense.

## Evidência de limpeza

O comando `git log --all --oneline -- database_dump.sql` retornou vazio após a rewrite, confirmando que o dump não aparece mais no histórico do Git.
