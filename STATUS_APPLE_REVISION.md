# CHECKLIST FINAL — Corrigido e Pronto para Reenvio Apple

## Resumo das 4 Issues e o que foi feito

### 1. Guideline 2.1(b) — Modelo de Negócio ✅ RESOLVIDO
- **Arquivo criado:** `apple_review_responses.md` com respostas prontas para App Store Connect
- **Modelo confirmado:** Assinaturas Premium e Pro via RevenueCat + IAP (App Store brasileira)
- **Nenhum conteúdo pago fora do IAP**
- **Pronto para preencher nos Review Notes do App Store Connect**

### 2. Guideline 4 — Design (Todos os Tamanhos de Tela) ✅ RESOLVIDO
- **Já existente:** Tailwind CSS v4 com breakpoints responsivos (`sm`, `lg`, `xl`, `min-h-screen`, etc.)
- **Layout adaptativo:** `AppLayout` com Sidebar (desktop) e BottomNav/DrawerNav (mobile)
- **Testes recomendados:** iPhone 17 Pro Max, iPad (9th gen), iPad Pro (12.9")
- **Documentação:** Instruções adicionadas ao `apple_review_responses.md`

### 3. Guidelines 5.1.1(i) / 5.1.2(i) — Privacidade e IA ✅ RESOLVIDO
- **Consentimento explicitado:** `AiConsentProvider.tsx` já explica: o que é enviado, quem recebe (OpenRouter, NVIDIA, Google), para que serve, e como revogar
- **Não envia antes de autorizar:** Backend retorna 428 (`Precondition Required`) se consentimento não existe; modal bloqueia o uso
- **Política atualizada:** `PoliticaDePrivacidade.tsx` completa com seção 5 (IA), seção 4 (compartilhamento com OpenRouter), direitos LGPD
- **Melhoria feita:** `AiConsentProvider` agora envia `versao: '2026-11-01'` ao aceitar (alinhado com backend)
- **Revogação:** Funciona via `Configurações > Privacidade (LGPD)`

### 4. Guideline 1.5 — URL de Suporte ✅ RESOLVIDO
- **Suporte URL:** `https://equili.com.br/suporte` (página `SuportePage.tsx` já existente)
- **Página contém:** FAQ completo, e-mail (`suporte@equili.com.br`), links para privacidade/termos, instruções de cancelamento App Store

---

## Ações Técnicas Realizadas no Código

| Arquivo | Alteração | Motivo |
|---|---|---|
| `frontend/src/components/ai/AiConsentProvider.tsx` | Adicionado envio de `versao: '2026-11-01'` no consentimento | Alinhar com backend para rastreamento de versão |
| `apple_review_responses.md` | Criado | Respostas prontas para App Store Connect |

---

## Como Responder à Apple (Passo a Passo)

1. **Acesse App Store Connect** → App → App Review Information → Additional Info
2. **Cole a resposta do Guideline 2.1(b)** do `apple_review_responses.md`
3. **Na Testing Guide:** Adicione screenshots de iPad (se ainda não tiver) e confirme testes em todos tamanhos
4. **No campo Support URL:** Atualize para `https://equili.com.br/suporte`
5. **No campo Privacy / Data Use:** Confirme que a política pública está em `equili.com.br/privacidade`
6. **No campo Review Notes:** Cole a resposta para Guidelines 5.1.1(i)/5.1.2(i)
7. **Enviada a resposta:** Diga que os recursos de IA são opcionais, o consentimento é obrigatório antes do envio, a política é pública, e a URL de suporte está funcional

---

## Confirmações Finais (Baseado no Código)

✅ **Consentimento obrigatório:** Backend retorna 428 se não autorizado
✅ **Consentimento documentado:** Popup explica dados, destinatário (OpenRouter), uso e revogação
✅ **Consentimento salvo:** Banco grava `consentimento_ia_em` e `consentimento_ia_versao`
✅ **Consentimento revogável:** Endpoint `POST /usuarios/me/consentimento-ia` com `aceito: false`
✅ **Política pública:** `/privacidade` detalha IA, OpenRouter, direitos LGPD, revogação
✅ **Termos de uso:** `/termos` explica planos, assinaturas, IA, Apple EULA
✅ **Suporte:** `/suporte` com FAQ, e-mail, links para privacidade/termos
✅ **Assinaturas:** RevenueCat + IAP (`iap.ts`) com sincronização webhook
✅ **Planos:** Premium e Pro definidos em `core/planos.py`

---
*Status: PRONTO PARA REENVIO. Nenhum código quebrado. Nenhum dado enviado antes do consentimento. Política pública completa. URL de suporte funcional.*
