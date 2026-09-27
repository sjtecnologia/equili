# Checklist de deploy seguro - Equili (VPS Hostinger)

Este checklist foi escrito para evitar downtime e proteger o acesso ao servidor em produção.

## 1) Requisitos mínimos de produção

- Usar HTTPS com TLS válido em `https://equili.com.br` e `https://www.equili.com.br`.
- O backend deve permitir apenas essas origins no CORS e nunca `*`.
- O refresh cookie deve ser `Secure=True` e `SameSite=Lax` quando `DEBUG=False`.
- O backend deve aplicar headers HTTP de segurança em todas as respostas.
- O Nginx do frontend deve negar arquivos sensíveis (`.env`, `.git`, `database_dump.sql`, etc.).

## 2) Acesso SSH: usuário de deploy (sem usar root)

Importante: não desative root ou senha antes de confirmar que o login por chave funciona.

### Crie o usuário de deploy

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
```

### Gere a chave SSH no seu computador local

```bash
ssh-keygen -t ed25519 -C "deploy@equili"
```

### Copie a chave pública para o VPS

```bash
ssh-copy-id deploy@2.24.97.144
```

### Teste login por chave antes de desativar senha

```bash
ssh -i ~/.ssh/id_ed25519 deploy@2.24.97.144
```

> Só prosseguir para a próxima etapa se esse login funcionar sem pedir senha.

## 3) Desativar senha e root no SSH

Edite `/etc/ssh/sshd_config` e confirme:

```bash
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Reinicie o SSH:

```bash
sudo systemctl restart sshd
```

> Mantenha uma sessão SSH aberta enquanto testa a chave. Só feche depois de confirmar que o login por chave continua funcionando.

## 4) Firewall (ufw)

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Se houver backend em porta customizada (ex.: 8000), abra apenas se realmente necessário e depois feche ou restrinja por IP se puder.

## 5) HTTPS/TLS

- Certificado válido em produção (Let’s Encrypt ou provedor equivalente).
- Redirecionar HTTP -> HTTPS.
- Configurar `Strict-Transport-Security` no Nginx/backend.
- Verificar que o frontend usa apenas `https://equili.com.br` e `https://www.equili.com.br`.

## 6) Backups e dados sensíveis

- Fazer backup regular do banco PostgreSQL.
- Armazenar backups fora do diretório público do site.
- Nunca versionar `.env`, dumps SQL, chaves privadas, certificados, ou arquivos de secrets.
- Manter os backups criptografados quando possível.

## 7) Rotação de chaves e tokens

- Rotacionar `SECRET_KEY` em caso de vazamento ou troca de ambiente.
- Rotacionar `GITHUB_TOKEN` se ele tiver sido exposto ou se a política de acesso mudar.
- Registrar a data da rotação e o responsável.
- Reiniciar serviços após a troca de segredos para aplicar as novas variáveis.

## 8) Monitoramento e alertas

- Verificar logs do Nginx e do backend diariamente.
- Ativar alertas para autenticação falha, rate limit, e erros 5xx.
- Monitorar uso de CPU, memória e espaço em disco.
- Revisar acessos SSH e logs de autenticação após qualquer mudança de infraestrutura.

## 9) Validação antes de fechar a sessão SSH atual

Antes de fechar a sessão aberta no root, confirme:

- login por chave no usuário `deploy` funciona;
- `sudo` funciona como `deploy`;
- login por senha foi desabilitado;
- login root foi desabilitado;
- firewall está ativo;
- site continua respondendo em HTTPS sem erros de CORS ou cookie.

## 10) Observações finais

- Não usar `root` no dia a dia.
- Manter o acesso administrativo mínimo.
- Usar sempre chaves SSH em vez de senha.
- Fazer alterações de segurança em etapas controladas para evitar perda de acesso.
