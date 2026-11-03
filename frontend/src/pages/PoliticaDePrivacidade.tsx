import { Link } from 'react-router-dom'

const EMAIL_SUPORTE = 'suporte@equili.app'
const OPENROUTER_PRIVACIDADE = 'https://openrouter.ai/privacy'

export default function PoliticaDePrivacidade() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-xs sm:p-10">
        <Link to="/login" className="text-sm font-medium text-primary-500 hover:underline">
          Voltar ao login
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-gray-900 sm:text-3xl">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-gray-500">Última atualização: 3 de novembro de 2026.</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-gray-700 sm:text-base">
          <section>
            <h2 className="text-lg font-semibold text-gray-900">1. Quem somos</h2>
            <p className="mt-2">
              O Equili ("nós") é um aplicativo de gestão financeira pessoal (controle de dívidas,
              receitas e contas a pagar). Esta política explica como tratamos seus dados, em
              conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">2. Dados que coletamos</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Dados de cadastro: nome e e-mail informados no login;</li>
              <li>
                Dados de login social: informações básicas fornecidas pelo Google ou Apple quando
                você usa esses logins (nome e e-mail);
              </li>
              <li>
                Dados inseridos por você: informações financeiras cadastradas no app (dívidas,
                valores, datas, contas a pagar, receitas);
              </li>
              <li>
                Dados de uso: informações técnicas sobre o dispositivo e o uso do aplicativo, para
                funcionamento e melhorias;
              </li>
              <li>
                Dados de assinatura: plano contratado, status, datas de início, renovação e
                cancelamento. Em compras feitas pela App Store, não recebemos nem armazenamos os
                dados do seu cartão; a cobrança é feita pela Apple.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">3. Finalidade e base legal</h2>
            <p className="mt-2">
              Utilizamos seus dados para: (a) operar o aplicativo e prestar o serviço de gestão
              financeira; (b) autenticar sua conta e manter sua sessão segura; (c) gerenciar sua
              assinatura e liberar os recursos do plano contratado; (d) oferecer suporte técnico;
              (e) cumprir obrigações legais. As bases legais são: execução do contrato de uso,
              consentimento e obrigação legal/regulatória, conforme aplicável.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">4. Compartilhamento</h2>
            <p className="mt-2">
              Não vendemos nem alugamos seus dados. Compartilhamos apenas o necessário com: (a)
              provedores de infraestrutura e hospedagem (armazenamento em nuvem e banco de dados);
              (b) provedores de autenticação, como Google e Apple, quando você escolhe esses
              logins; (c) provedores de assinatura e validação de compras, como a RevenueCat e a
              Apple, para processar e confirmar compras feitas na App Store; (d) provedores de
              inteligência artificial, somente se você autorizar os recursos de IA; (e) autoridades,
              quando exigido por lei ou ordem judicial.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">
              5. Recursos de inteligência artificial
            </h2>
            <p className="mt-2">
              O chat financeiro, o Plano de Ação e o assistente de voz usam modelos de inteligência
              artificial de terceiros por meio da plataforma <strong>OpenRouter</strong>, que
              encaminha as solicitações aos provedores dos modelos. Esses recursos são
              <strong> opcionais</strong> e só são ativados depois que você autoriza expressamente,
              em uma janela de consentimento dentro do aplicativo.
            </p>
            <p className="mt-2">Quando você usa um recurso de IA, podemos enviar:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>o texto da sua mensagem no chat ou a transcrição do seu comando de voz;</li>
              <li>
                um resumo financeiro compacto necessário para responder à pergunta (por exemplo:
                receitas, dívidas, contas a pagar e saldos);
              </li>
              <li>o histórico recente da conversa, para manter o contexto do atendimento.</li>
            </ul>
            <p className="mt-2">
              <strong>Não enviamos</strong> seu nome, e-mail, senha, dados de cartão ou credenciais
              de acesso. Os dados são enviados apenas para gerar a resposta solicitada e não são
              usados por nós para publicidade.
            </p>
            <p className="mt-2">
              O processamento pode ocorrer em servidores fora do Brasil, incluindo nos Estados
              Unidos, com base no seu consentimento e nas cláusulas contratuais dos provedores. A
              OpenRouter e os provedores dos modelos podem manter registros técnicos das
              solicitações pelo tempo necessário à prestação do serviço e à segurança. Consulte a
              política de privacidade da OpenRouter em{' '}
              <a
                href={OPENROUTER_PRIVACIDADE}
                target="_blank"
                rel="noreferrer"
                className="text-primary-500 font-medium hover:underline"
              >
                openrouter.ai/privacy
              </a>
              .
            </p>
            <p className="mt-2">
              Você pode revogar a autorização a qualquer momento em{' '}
              <strong>Configurações &gt; Recursos de inteligência artificial</strong>. A revogação
              desativa o chat, o Plano de Ação e o assistente de voz; o restante do aplicativo
              continua funcionando. Você também pode solicitar a exclusão dos dados relacionados à
              IA pelo e-mail {EMAIL_SUPORTE}.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">6. Armazenamento e segurança</h2>
            <p className="mt-2">
              Seus dados são armazenados em servidores em nuvem com acesso restrito e medidas de
              segurança técnicas e organizacionais (criptografia de dados sensíveis, controle de
              acesso e monitoramento). Retemos os dados enquanto sua conta estiver ativa ou pelo
              prazo exigido por lei. Dados enviados a provedores de IA são tratados conforme a
              seção 5 e mantidos apenas pelo tempo necessário à finalidade.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">
              7. Cookies e armazenamento local
            </h2>
            <p className="mt-2">
              O aplicativo utiliza armazenamento local e cookies de sessão para manter você logado e
              autenticado. Eles não são usados para rastreamento publicitário.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">8. Seus direitos (LGPD)</h2>
            <p className="mt-2">
              Você pode solicitar, a qualquer momento: acesso, correção, exclusão, portabilidade,
              anonimização e revogação de consentimento dos seus dados. Para exercer seus direitos,
              entre em contato pelo e-mail {EMAIL_SUPORTE}.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">9. Exclusão da conta</h2>
            <p className="mt-2">
              Ao solicitar a exclusão da sua conta, seus dados pessoais e financeiros serão removidos
              de nossos sistemas, salvo aqueles que a lei exigir que mantenhamos. A exclusão da conta
              não cancela automaticamente assinaturas ativas na App Store; para isso, cancele a
              assinatura em Ajustes &gt; Apple ID &gt; Assinaturas no iPhone.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">10. Alterações desta política</h2>
            <p className="mt-2">
              Esta política pode ser atualizada periodicamente. A versão vigente estará sempre
              disponível nesta página, com a data da última atualização no topo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">11. Contato</h2>
            <p className="mt-2">
              Dúvidas ou solicitações: {EMAIL_SUPORTE}. Você também pode consultar a página de{' '}
              <Link to="/suporte" className="text-primary-500 font-medium hover:underline">
                Suporte
              </Link>{' '}
              e os{' '}
              <Link to="/termos" className="text-primary-500 font-medium hover:underline">
                Termos de Uso
              </Link>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
