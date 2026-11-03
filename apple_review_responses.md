# Respostas da Apple Store Review - Equili

## 1. Guideline 2.1(b) - Modelo de Negócio

### Resposta para Review Notes:

> **Resposta aos Guidelines 2.1(b):**
>
> **1.** As assinaturas servem pessoas físicas que usam o Equili como app de controle financeiro pessoal e doméstico. O app não vende para empresas ou negócios. As assinaturas liberam: Chat IA (limitado ao volume do plano vigente), Plano de Ação financeiro guiado pela IA e assistente de voz.
>
> **2.** Os usuários compram diretamente dentro do app nativo iOS, via In-App Purchase na App Store brasileira. Não há vendas diretas fora do app (não há links a marketplace de terceiros).
>
> **3.** Os dois planos existentes são *Premium* e *Pro*. Cada um com opção mensal e anual. O *Premium* libera recursos básicos, e o *Pro* libera Chat IA (limitado ao volume do plano vigente), Plano de Ação e assistente de voz.
>
> **4.** Até o momento não existem conteúdos pagos por outro caminho. Caso ocorram no futuro, providenciarão para tornar claro nos campos de envio, mantendo esta área sempre consistente com as diretrizes da App Store.

---

## 2. Guideline 4 - Design (Tamanhos de Tela)

### Resposta para Testing Guide:

> **Testes executados em toda breakpoint iOS e Devices da família Apple:**
>
> Layouts adequados para iPhone e iPad da família Apple, mantendo o mesmo nível de usabilidade em todas as telas. O breakpoint iOS foi revisado para atender a todos os dispositivos onde o app está disponível, incluindo smartphones de todos tamanhos e iPad. Testes realizados no simulador e em devices físicos confirmam que os layouts funcionam corretamente em landscape e portrait. Screenshots de teste em iPad (9th generation) e iPad Pro (12.9-inch) disponíveis no recurso de testes do App Store Connect.

---

## 3. Guidelines 5.1.1(i) e 5.1.2(i) - Privacidade e Uso de Dados com IA

### Resposta para Additional Info:

> **Sobre o envio de dados a serviços de IA (OpenRouter):**
>
> O Equili envia dados financeiros dos usuários (rendas, dívidas, contas a pagar e a receber, saldos e investimentos resumidos) para serviços de terceiro por OpenRouter, Inc. através de nossa API secundária. Três garantias são apresentadas antes do envio:
>
> **(a)** Transmissão explicada antes via popups de consentimento no app;
>
> **(b)** Destinatário identificado explicitamente naquele popup: *OpenRouter, Inc. (openrouter.ai), que encaminha a solicitação para provedores de modelos de IA (atualmente NVIDIA e Google). O processamento pode ocorrer fora do Brasil, inclusive nos Estados Unidos.*
>
> **(c)** Pergunta ao usuário antes do envio real. O usuário deve autorizar explicitamente em uma janela de consentimento dentro do aplicativo antes que qualquer dado seja transmitido.
>
> A Política de Privacidade pública em https://equili.com.br/privacidade inclui informações completas sobre:
> - Quais dados são coletados (mensagens de chat, transcrições de áudio, resumo financeiro)
> - Quem recebe os dados (OpenRouter e provedores de modelos)
> - Como o usuário pode revogar a autorização (Configurações > Privacidade (LGPD))
> - Que dados NÃO são enviados (nome, e-mail, senha, dados de cartão, credenciais de acesso)
>
> Somente após a autorização explícita do usuário é que os dados são enviados aos provedores de IA. Sem a autorização, os recursos de IA (chat, Plano de Ação, voz) ficam desativados, mas o restante do app continua funcionando normalmente.

---

## 4. Guideline 1.5 - URL de Suporte

### Support URL para App Store Connect:

> https://equili.com.br/suporte

### Página de Suporte já existente:

A página `SuportePage.tsx` já contém:
- Formulário de e-mail para contato direto
- Perguntas frequentes (cancelamento, restauração de compra, exclusão de conta, IA, senha, erros/sugestões)
- Links rápidos para privacidade e termos
- Informações sobre gestão de assinaturas na App Store

A página está estruturada para atender usuários que precisam de ajuda com o app, assinaturas e recursos.

---
*Documento gerado em 3 de novembro de 2026 para resposta ao parecer Apple Store.*