import { Link } from 'react-router-dom'

export default function PoliticaDePrivacidade() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-sm sm:p-10">
        <Link to="/login" className="text-sm font-medium text-primary-500 hover:underline">
          Voltar ao login
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-gray-900 sm:text-3xl">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-gray-500">Última atualização: 29 de setembro de 2026.</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-gray-700 sm:text-base">
          <section>
            <h2 className="text-lg font-semibold text-gray-900">1. Quem somos</h2>
            <p className="mt-2">
              O Equili ("nós") é um aplicativo de gestão financeira pessoal (controle de dívidas, receitas e contas a pagar). Esta política explica como tratamos seus dados, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">2. Dados que coletamos</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Dados de cadastro: nome e e-mail informados no login;</li>
              <li>Dados de login social: informações básicas fornecidas pelo Google ou Apple quando você usa esses logins (nome e e-mail);</li>
              <li>Dados inseridos por você: informações financeiras cadastradas no app (dívidas, valores, datas, contas a pagar, receitas);</li>
              <li>Dados de uso: informações técnicas sobre o dispositivo e o uso do aplicativo, para funcionamento e melhorias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">3. Finalidade e base legal</h2>
            <p className="mt-2">
              Utilizamos seus dados para: (a) operar o aplicativo e prestar o serviço de gestão financeira; (b) autenticar sua conta e manter sua sessão segura; (c) oferecer suporte técnico; (d) cumprir obrigações legais. As bases legais são: execução do contrato de uso, consentimento e obrigação legal/regulatória, conforme aplicável.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">4. Compartilhamento</h2>
            <p className="mt-2">
              Não vendemos nem alugamos seus dados. Compartilhamos apenas: (a) com provedores de infraestrutura e hospedagem necessários ao funcionamento do serviço (armazenamento em nuvem, banco de dados); (b) com autoridades, quando exigido por lei ou ordem judicial.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">5. Armazenamento e segurança</h2>
            <p className="mt-2">
              Seus dados são armazenados em servidores em nuvem com acesso restrito e medidas de segurança técnicas e organizacionais (criptografia de dados sensíveis, controle de acesso e monitoramento). Retemos os dados enquanto sua conta estiver ativa ou pelo prazo exigido por lei.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">6. Cookies e armazenamento local</h2>
            <p className="mt-2">
              O aplicativo utiliza armazenamento local e cookies de sessão para manter você logado e autenticado. Eles não são usados para rastreamento publicitário.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">7. Seus direitos (LGPD)</h2>
            <p className="mt-2">
              Você pode solicitar, a qualquer momento: acesso, correção, exclusão, portabilidade, anonimização e revogação de consentimento dos seus dados. Para exercer seus direitos, entre em contato pelo e-mail renato.ti@saojudascontabilidade.com.br.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">8. Exclusão da conta</h2>
            <p className="mt-2">
              Ao solicitar a exclusão da sua conta, seus dados pessoais e financeiros serão removidos de nossos sistemas, salvo aqueles que a lei exigir que mantenhamos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">9. Alterações desta política</h2>
            <p className="mt-2">
              Esta política pode ser atualizada periodicamente. A versão vigente estará sempre disponível nesta página, com a data da última atualização no topo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">10. Contato</h2>
            <p className="mt-2">Dúvidas ou solicitações: renato.ti@saojudascontabilidade.com.br.</p>
          </section>
        </div>
      </article>
    </main>
  )
}
