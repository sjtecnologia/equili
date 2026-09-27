# Rotação de credenciais em produção após vazamento de dump

- Data: 2026-09-26
- Escopo: ambiente de produção / VPS / secret manager
- Status: os segredos devem ser tratados como comprometidos, mesmo sem prova definitiva de uso

## 1) SECRET_KEY (prioridade máxima)

A `SECRET_KEY` compromete todos os JWTs emitidos pelo backend e invalida automaticamente todas as sessões atuais.

### Procedimento

1. Gere uma nova chave:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
2. Atualize a variável `SECRET_KEY` no `.env` de produção ou no secret manager da VPS.
3. Reinicie o backend.
4. Confirme no log que o serviço iniciou corretamente.

### Efeito esperado

Todos os usuários serão deslogados. Isso é aceitável e necessário, porque a chave antiga foi comprometida.

---

## 2) GITHUB_TOKEN

1. Acesse o GitHub em `Settings > Developer settings > Tokens`.
2. Revogue o token antigo.
3. Gere um novo token com os mesmos escopos mínimos necessários.
4. Atualize `GITHUB_TOKEN` no `.env` de produção ou secret manager.
5. Reinicie o serviço que usa o token.

---

## 3) RESEND_API_KEY

1. Acesse o painel do Resend.
2. Revogue a chave antiga.
3. Gere uma nova API key.
4. Atualize `RESEND_API_KEY` no `.env` de produção.
5. Reinicie o serviço quando o novo valor estiver ativo.

---

## 4) STRIPE_SECRET_KEY (se usada)

1. Acesse o painel da Stripe.
2. Revogue a chave secreta antiga.
3. Gere uma nova `STRIPE_SECRET_KEY`.
4. Atualize o valor no `.env` / secret manager.
5. Reinicie o app após confirmação do ambiente.

---

## 5) VAPID keys

A chave VAPID é usada para push notifications. Caso o dump tenha dado acesso às chaves ou ao ambiente, gere um novo par.

### Procedimento

1. Gere novo par de chaves:
   ```bash
   py-vapid --gen
   ```
   ou use a biblioteca do projeto conforme o padrão local.
2. Atualize as variáveis:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY_B64`
3. Reinicie o serviço.
4. Informe aos usuários que, no futuro, eles podem precisar se registrar novamente para receber push notifications.

---

## 6) Senha do PostgreSQL / DATABASE_URL

Se a senha do banco ou o `DATABASE_URL` apareceu no dump ou em qualquer artefato versionado, a senha deve ser trocada imediatamente.

### Procedimento

1. Altere a senha no PostgreSQL:
   ```sql
   ALTER USER postgres WITH PASSWORD 'nova_senha_forte';
   ```
   ou no usuário equivalente do banco.
2. Atualize `DATABASE_URL` no `.env` de produção.
3. Confirme que o app está usando o novo valor antes do deploy ou do reinício.
4. Cuidado com a ordem de execução: primeiro o banco com a nova senha e depois o app com a nova connection string; sem isso o serviço pode cair por incompatibilidade de credenciais.

---

## 7) Checklist de execução na VPS

1. Backup do `.env` atual:
   ```bash
   cp /caminho/do/.env /caminho/do/.env.bak.$(date +%Y%m%d%H%M%S)
   ```
2. Atualize cada variável em `.env` ou no secret manager.
3. Valide que todos os valores estão preenchidos.
4. Reinicie o backend:
   ```bash
   sudo systemctl restart equili-backend
   ```
5. Confirme health check e login ativo.

---

## 8) Observações de risco

Como o dump continha dados reais e foi exposto em repositório público, qualquer credencial ou configuração ligada ao ambiente deve ser considerada comprometida. A rotação deve ser feita ainda que não exista prova definitiva de uso malicioso.

---

## 9) Comunicação e conformidade

Se o dump continha dados pessoais como e-mails, nomes, valores, endereços ou qualquer informação identificável, a equipe deve avaliar:

- notificação aos usuários afetados;
- análise de impacto de privacidade e segurança;
- avaliação de comunicação à ANPD, quando aplicável;
- documentação formal do incidente para o time e para a área jurídica.

A decisão final sobre comunicação deve ser feita com base na avaliação de impacto e nas exigências da LGPD e da legislação aplicável.
