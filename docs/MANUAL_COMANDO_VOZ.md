# Manual de Comando de Voz - Equili

## Overview

O sistema de comando de voz permite que você controle todas as funcionalidades do Equili apenas falando. A aplicação utiliza reconhecimento de voz com transcrição em português brasileiro e interpretação de comandos por IA para executar ações precisas.

**Como ativar:** Clique no ícone de microfone em qualquer página da aplicação.

---

## 1. Contas a Pagar

Gerenciar contas e despesas que você precisa pagar.

### 1.1 Criar Conta a Pagar

**Ações esperadas:** Abrir modal para criar nova conta a pagar.

**Exemplos de frases:**
- "Criar conta pagar"
- "Nova conta a pagar"
- "Registrar despesa"
- "Tenho uma conta a pagar"
- "Criar pagamento"

**Palavras-chave:**
- `criar`
- `conta pagar` / `conta a pagar`
- `nova`
- `despesa`
- `pagamento`

**Dados necessários:**
- Descrição (ex: "Aluguel", "Conta de luz")
- Valor (ex: "1200", "150 reais")
- Data de vencimento (ex: "15 de dezembro", "próximo mês")
- Categoria (opcional): `saúde`, `educação`, `moradia`, `alimentação`, `transporte`, `lazer`, `outro`
- Modalidade (opcional): `avulsa`, `parcelada`

**Fluxo:**
1. Sistema reconhece a intenção de criar conta pagar
2. Solicita a descrição e valor (geralmente no mesmo comando)
3. Se não incluir data, pede a data de vencimento
4. Cria a conta e navega para a lista de Contas a Pagar

---

### 1.2 Excluir Conta a Pagar

**Ações esperadas:** Remover uma conta a pagar existente.

**Exemplos de frases:**
- "Excluir conta aluguel"
- "Deletar despesa de luz"
- "Remover conta pagar"
- "Apagar pagamento"

**Palavras-chave:**
- `excluir` / `deletar` / `remover` / `apagar`
- `conta pagar` / `conta a pagar`
- Nome/descrição da conta

**Dados necessários:**
- Nome ou descrição da conta a excluir

**Fluxo:**
1. Sistema identifica a intenção de excluir
2. Busca pela conta com nome similar
3. Executa exclusão
4. Atualiza lista

---

## 2. Contas a Receber

Gerenciar contas e receitas que você vai receber.

### 2.1 Criar Conta a Receber

**Ações esperadas:** Abrir modal para criar nova conta a receber.

**Exemplos de frases:**
- "Criar conta receber"
- "Nova receita"
- "Registrar venda"
- "Cliente vai me pagar"

**Palavras-chave:**
- `criar`
- `conta receber` / `conta a receber`
- `receita`
- `venda`
- `novo cliente`

**Dados necessários:**
- Descrição (ex: "Venda produto X", "Consultoria")
- Valor (ex: "5000", "2500 reais")
- Data de vencimento

**Fluxo:**
1. Sistema reconhece intenção de criar conta a receber
2. Coleta descrição e valor
3. Solicita data de vencimento se não fornecida
4. Cria a conta e navega para Contas a Receber

---

### 2.2 Excluir Conta a Receber

**Ações esperadas:** Remover uma conta a receber.

**Exemplos de frases:**
- "Excluir conta do cliente X"
- "Remover receita"
- "Deletar venda"

**Palavras-chave:**
- `excluir` / `deletar` / `remover`
- `conta receber` / `receita`
- Nome do cliente ou descrição

**Dados necessários:**
- Descrição/nome da conta a receber

**Fluxo:**
1. Identifica intenção de exclusão
2. Busca pela conta
3. Remove e atualiza lista

---

## 3. Renda

Gerenciar suas fontes de renda (salário, freelance, etc).

### 3.1 Criar Renda

**Ações esperadas:** Registrar nova fonte de renda.

**Exemplos de frases:**
- "Adicionar renda"
- "Meu salário é 5000"
- "Tenho renda de freelance"
- "Cadastrar fonte de renda"

**Palavras-chave:**
- `criar` / `adicionar` / `registrar`
- `renda`
- `salário`
- `freelance`
- `ganho`

**Dados necessários:**
- Descrição (ex: "Salário", "Freelance Web")
- Valor mensal (ex: "5000")
- Tipo (opcional): `salario`, `freelance`, `investimento`, `bonus`, `outro`
- Frequência (opcional): `mensal`, `quinzenal`, `semanal`, `diária`

**Fluxo:**
1. Reconhece registro de renda
2. Extrai descrição e valor
3. Cria e navega para Rendas

---

### 3.2 Atualizar Renda

**Ações esperadas:** Modificar valor de renda existente.

**Exemplos de frases:**
- "Atualizar renda para 6000"
- "Meu salário aumentou"
- "Novo valor de renda 7500"

**Palavras-chave:**
- `atualizar` / `alterar` / `modificar` / `aumentar` / `diminuir`
- `renda`
- `salário`
- Novo valor

**Dados necessários:**
- Novo valor

**Fluxo:**
1. Identifica atualização de renda
2. Extrai novo valor
3. Atualiza primeira renda cadastrada
4. Navega para Rendas

---

### 3.3 Excluir Renda

**Ações esperadas:** Remover fonte de renda.

**Exemplos de frases:**
- "Excluir renda de freelance"
- "Remover salário"
- "Deletar fonte de renda"

**Palavras-chave:**
- `excluir` / `deletar` / `remover`
- `renda`
- Nome da fonte

**Dados necessários:**
- Descrição da renda a excluir

**Fluxo:**
1. Identifica exclusão
2. Busca pela renda
3. Remove e atualiza

---

## 4. Dívidas

Gerenciar dívidas e empréstimos com histórico de pagamentos.

### 4.1 Criar Dívida

**Ações esperadas:** Registrar nova dívida.

**Exemplos de frases:**
- "Cadastrar dívida"
- "Peguei empréstimo de 10000"
- "Tenho dívida com o banco"
- "Criar dívida"

**Palavras-chave:**
- `criar` / `cadastrar` / `registrar`
- `dívida` / `divida`
- `empréstimo`
- `devo`
- `crédito`

**Dados necessários:**
- Descrição (ex: "Empréstimo banco", "Dívida pessoal")
- Valor total (ex: "10000")
- Valor de parcela (ex: "500")
- Número de parcelas (se não fornecido, calcula automático)
- Tipo (opcional): `emprestimo`, `fiado`, `cartao_consignado`
- Credor (opcional): nome de quem você deve
- Data primeira parcela

**Fluxo:**
1. Reconhece criação de dívida
2. Coleta descrição, valores e parcelas
3. Solicita data se necessário
4. Cria e navega para Dívidas

---

### 4.2 Registrar Pagamento de Dívida

**Ações esperadas:** Registrar pagamento de uma parcela.

**Exemplos de frases:**
- "Pagar dívida"
- "Já paguei o empréstimo"
- "Registrar pagamento da dívida"
- "Paguei parcela do banco"

**Palavras-chave:**
- `pagar` / `registrar pagamento`
- `dívida` / `divida`
- `parcela`
- `empréstimo`
- Valor pago (opcional)

**Dados necessários:**
- Nome/descrição da dívida
- Valor pago (opcional, usa valor padrão se não fornecido)
- Data do pagamento (opcional)

**Fluxo:**
1. Identifica pagamento de dívida
2. Busca pela dívida descrita
3. Registra pagamento
4. Atualiza lista de dívidas e histórico
5. Retorna para Dívidas

---

### 4.3 Excluir Dívida

**Ações esperadas:** Remover dívida do registro.

**Exemplos de frases:**
- "Excluir dívida com João"
- "Remover empréstimo"
- "Deletar dívida do banco"

**Palavras-chave:**
- `excluir` / `deletar` / `remover`
- `dívida` / `divida`
- `empréstimo`
- Nome do credor

**Dados necessários:**
- Nome/descrição da dívida

**Fluxo:**
1. Identifica exclusão
2. Busca pela dívida
3. Remove e atualiza histórico

---

## 5. Investimentos

Registrar e acompanhar investimentos e patrimônio.

### 5.1 Criar Investimento

**Ações esperadas:** Registrar novo investimento.

**Exemplos de frases:**
- "Criei investimento"
- "Comprei ações da Petrobras"
- "Tenho investimento em fundos"
- "Aplicar em renda fixa"

**Palavras-chave:**
- `criar` / `registrar` / `comprei`
- `investimento`
- `ação` / `fundo` / `renda fixa` / `cripto`
- Valor

**Dados necessários:**
- Nome (ex: "PETR4", "Fundo ABC", "Bitcoin")
- Tipo (opcional): `acoes`, `fundos`, `renda_fixa`, `cripto`, `imovel`, `outro`
- Valor investido (ex: "5000")
- Data do investimento

**Fluxo:**
1. Reconhece criação de investimento
2. Coleta nome, tipo e valor
3. Solicita data se necessário
4. Cria e navega para Investimentos

---

### 5.2 Atualizar Investimento

**Ações esperadas:** Atualizar valor atual do investimento.

**Exemplos de frases:**
- "Atualizar valor da ação"
- "Meu investimento agora vale 6000"
- "Ações subiram para 120 reais"

**Palavras-chave:**
- `atualizar` / `modificar` / `agora vale` / `novo valor`
- `investimento`
- Novo valor

**Dados necessários:**
- Nome do investimento para buscar
- Novo valor atual

**Fluxo:**
1. Identifica atualização
2. Busca investimento pela descrição
3. Atualiza valor e navega

---

### 5.3 Excluir Investimento

**Ações esperadas:** Remover investimento do registro.

**Exemplos de frases:**
- "Excluir investimento em ações"
- "Remover fundo"
- "Deletar Bitcoin"

**Palavras-chave:**
- `excluir` / `deletar` / `remover`
- `investimento`
- Nome do investimento

**Dados necessários:**
- Nome do investimento

**Fluxo:**
1. Identifica exclusão
2. Busca investimento
3. Remove e atualiza

---

## 6. Navegação

Navegar entre diferentes seções da aplicação usando voz.

### 6.1 Navegar entre Seções

**Ações esperadas:** Ir para uma seção específica.

**Exemplos de frases:**
- "Ir para dashboard"
- "Mostrar contas a pagar"
- "Ver dívidas"
- "Ir para investimentos"
- "Abre relatório"

**Palavras-chave:**
- `ir` / `vai` / `mostra` / `abre` / `vai para` / `ve`
- Nome da seção: `dashboard`, `contas pagar`, `contas receber`, `dividas`, `investimentos`

**Destinos suportados:**
- `/dashboard` - Página inicial
- `/contas-pagar` - Gestão de contas a pagar
- `/contas-receber` - Gestão de contas a receber
- `/rendas` - Gestão de rendas
- `/dividas` - Gestão de dívidas
- `/investimentos` - Gestão de investimentos

**Fluxo:**
1. Reconhece intenção de navegação
2. Extrai destino
3. Navega para seção

---

## 7. Tratamento de Erros

O sistema fornece mensagens claras quando:

### Dívida/Investimento/Conta não encontrada
**Mensagem:** "Não encontrei [tipo] com '[nome]' para [ação]."
**Ação:** Verificar o nome exato e tentar novamente com pronuncia mais clara.

### Nenhum registro cadastrado
**Mensagem:** "Nenhum(a) [tipo] cadastrado(a) para [ação]."
**Ação:** Criar o registro primeiro antes de tentar atualizar ou excluir.

### Timeout
**Mensagem:** "Servidor demorou demais. Verifique sua conexão e tente novamente."
**Ação:** Verificar conexão de internet e tentar novamente.

### Não entendido
**Mensagem:** "Desculpe, não entendi. Tente novamente com uma frase diferente."
**Ação:** Reformular o comando com palavras mais claras.

---

## 8. Boas Práticas

### ✅ Recomendado
- Pronunciar com clareza em tom normal
- Incluir valores numéricos quando relevan
- Especificar o tipo quando necessário ("conta a pagar" vs "conta a receber")
- Usar nomes descritivos e únicos para itens
- Mencionar datas completas (ex: "15 de dezembro" vs só "15")

### ❌ Evitar
- Falar muito rápido ou muito baixo
- Usar abreviações não óbvias
- Ter barulho de fundo muito alto
- Dar várias informações fora de ordem
- Nomes genéricos duplicados (ex: múltiplas "Despesa")

---

## 9. Exemplos de Conversas Completas

### Exemplo 1: Criar Dívida com Empréstimo
```
Usuário: "Criar dívida"
Sistema: Entendido. Para criar uma dívida, preciso dos detalhes.
Usuário: "Empréstimo do banco, 10 mil, 500 por mês, 20 parcelas, começando dia 1º"
Sistema: ✓ Dívida criada: Empréstimo do banco - R$ 10.000 em 20 parcelas de R$ 500
Resultado: Navegação para /dividas
```

### Exemplo 2: Pagar Parcela
```
Usuário: "Pagar dívida"
Sistema: Qual dívida?
Usuário: "Empréstimo do banco"
Sistema: ✓ Pagamento registrado para: Empréstimo do banco
Resultado: Parcela marcada como paga, lista atualizada
```

### Exemplo 3: Navegar
```
Usuário: "Ir para investimentos"
Sistema: Navegando...
Resultado: Página de investimentos aberta
```

### Exemplo 4: Criar Investimento
```
Usuário: "Comprei 100 ações da Petrobras por 5 mil reais"
Sistema: Entendido. Criando investimento.
Usuário: "Hoje"
Sistema: ✓ Investimento criado: PETR4 - R$ 5.000 investidos
Resultado: Navegação para /investimentos
```

---

## 10. Dicas de Troubleshooting

| Problema | Solução |
|----------|---------|
| Comando não reconhecido | Reformular: evite usar "tipo", use "espécie"; evite "remunerar", use "salário" |
| Valor não detectado | Pronunciar números com clareza: "cinco mil" ao invés de "5k" |
| Data recusada | Usar formato completo: "15 de dezembro" ao invés de só "dia 15" |
| Item não encontrado | Verificar se o item existe; tentar nome similar |
| Microfone não funciona | Permitir acesso de áudio nas configurações do navegador |

---

## 11. Suporte e Feedback

Para reportar problemas ou sugerir novas frases, entre em contato com o time de desenvolvimento.

**Sistema versão:** 2.0+ (expandido com dívidas, investimentos e navegação)
**Última atualização:** 2024
