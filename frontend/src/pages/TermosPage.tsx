import { Link } from 'react-router-dom'

const EMAIL_SUPORTE = 'suporte@equili.app'
const EULA_APPLE = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-xs sm:p-10">
        <Link to="/login" className="text-sm font-medium text-primary-500 hover:underline">
          Voltar ao login
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-gray-900 sm:text-3xl">Termos de Uso</h1>
        <p className="mt-2 text-sm text-gray-500">Última atualização: 3 de novembro de 2026.</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-gray-700 sm:text-base">
          <section>
            <h2 className="text-lg font-semibold text-gray-900">1. Aceitação dos termos</h2>
            <p className="mt-2">
              Estes Termos de Uso regulam o acesso e o uso do Equili, aplicativo de gestão
              financeira pessoal. Ao criar uma conta ou utilizar o aplicativo, você declara que leu,
              entendeu e concorda com estes termos e com a{' '}
              <Link to="/privacidade" className="text-primary-500 font-medium hover:underline">
                Política de Privacidade
              </Link>
              . Se não concordar, não utilize o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">2. O que o Equili oferece</h2>
            <p className="mt-2">
              O Equili ajuda você a organizar dívidas, receitas, contas a pagar e a receber,
              investimentos e metas financeiras. O aplicativo também oferece recursos opcionais de
              inteligência artificial, como chat financeiro, Plano de Ação e assistente de voz.
            </p>
            <p className="mt-2">
              O Equili é uma ferramenta de organização e não substitui aconselhamento financeiro,
              contábil, jurídico ou de investimentos. As informações e sugestões apresentadas,
              inclusive as geradas por inteligência artificial, têm caráter informativo e não
              constituem recomendação profissional.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">3. Conta e segurança</h2>
            <p className="mt-2">
              Você é responsável por manter a confidencialidade das credenciais de acesso e por
              todas as atividades realizadas na sua conta. Informe imediatamente o suporte em caso
              de uso não autorizado. É necessário fornecer informações verdadeiras e mantê-las
              atualizadas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">4. Planos e assinaturas</h2>
            <p className="mt-2">
              O Equili oferece um plano Gratuito e planos pagos Premium e Pro / Família, com
              recursos e limites descritos na tela{' '}
              <strong>Planos e assinaturas</strong> do aplicativo. Os preços e as condições vigentes
              são sempre os exibidos no momento da contratação.
            </p>
            <p className="mt-2">
              Assinaturas contratadas pelo aplicativo para iPhone são vendidas e cobradas pela
              Apple por meio da App Store, utilizando sua conta Apple ID. O preço é exibido em reais
              ou na moeda da sua região antes da confirmação da compra.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">
              5. Renovação automática (App Store)
            </h2>
            <p className="mt-2">
              As assinaturas feitas na App Store são de renovação automática. O pagamento é cobrado
              na sua conta Apple ID na confirmação da compra. A renovação ocorre automaticamente
              pelo mesmo valor e período, salvo cancelamento até 24 horas antes do fim do período
              atual. A cobrança da renovação é feita nas 24 horas anteriores ao término do período
              vigente.
            </p>
            <p className="mt-2">
              Você pode gerenciar ou cancelar a assinatura a qualquer momento em{' '}
              <strong>Ajustes &gt; seu nome (Apple ID) &gt; Assinaturas</strong> no iPhone, ou em{' '}
              <a
                href="https://apps.apple.com/account/subscriptions"
                target="_blank"
                rel="noreferrer"
                className="text-primary-500 font-medium hover:underline"
              >
                apps.apple.com/account/subscriptions
              </a>
              . O cancelamento interrompe a próxima renovação; o acesso aos recursos pagos continua
              até o fim do período já pago. A exclusão do aplicativo não cancela a assinatura.
            </p>
            <p className="mt-2">
              Assinaturas contratadas fora da App Store (PIX ou cartão, quando disponíveis) seguem
              as condições apresentadas no checkout e podem ser canceladas na própria tela de
              planos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">6. Reembolsos</h2>
            <p className="mt-2">
              Compras realizadas na App Store são processadas pela Apple. Pedidos de reembolso,
              cobranças indevidas e problemas de pagamento devem ser tratados diretamente com a
              Apple em{' '}
              <a
                href="https://reportaproblem.apple.com"
                target="_blank"
                rel="noreferrer"
                className="text-primary-500 font-medium hover:underline"
              >
                reportaproblem.apple.com
              </a>
              . O Equili não processa pagamentos nem reembolsos de compras feitas na App Store.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">
              7. Recursos de inteligência artificial
            </h2>
            <p className="mt-2">
              Os recursos de IA são opcionais e só funcionam após você autorizar expressamente o
              envio de dados a um provedor terceiro. A autorização pode ser revogada a qualquer
              momento em <strong>Configurações &gt; Recursos de inteligência artificial</strong>.
              Sem a autorização, o chat, o Plano de Ação e o assistente de voz ficam desativados, e
              o restante do aplicativo continua funcionando normalmente.
            </p>
            <p className="mt-2">
              As respostas geradas por IA podem conter erros ou imprecisões. Confira as informações
              antes de tomar decisões financeiras. Os dados enviados e o tratamento aplicado estão
              detalhados na{' '}
              <Link to="/privacidade" className="text-primary-500 font-medium hover:underline">
                Política de Privacidade
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">8. Uso aceitável</h2>
            <p className="mt-2">
              Você concorda em não usar o Equili para fins ilícitos, não tentar acessar contas de
              terceiros, não interferir no funcionamento do serviço, não realizar engenharia reversa
              indevida e não automatizar acessos de forma abusiva. O descumprimento pode resultar na
              suspensão ou no encerramento da conta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">
              9. Disponibilidade e limitação de responsabilidade
            </h2>
            <p className="mt-2">
              Buscamos manter o serviço disponível e seguro, mas ele pode passar por manutenções,
              atualizações ou interrupções. Na máxima extensão permitida pela lei, o Equili não se
              responsabiliza por decisões financeiras tomadas com base no aplicativo, por lucros
              cessantes ou por danos indiretos decorrentes do uso ou da indisponibilidade do
              serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">10. Propriedade intelectual</h2>
            <p className="mt-2">
              O aplicativo, a marca Equili, o código, os textos e os elementos visuais são protegidos
              por direitos de propriedade intelectual. O uso do serviço não transfere a você qualquer
              direito sobre esses elementos. Os dados que você cadastra continuam sendo seus.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">11. Encerramento da conta</h2>
            <p className="mt-2">
              Você pode excluir sua conta a qualquer momento em{' '}
              <strong>Configurações &gt; Privacidade (LGPD)</strong>. Podemos suspender ou encerrar
              o acesso em caso de violação destes termos ou de uso que comprometa a segurança do
              serviço. A exclusão da conta não cancela automaticamente assinaturas ativas na App
              Store; cancele-as nos Ajustes do iPhone.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">12. Alterações destes termos</h2>
            <p className="mt-2">
              Estes termos podem ser atualizados periodicamente. A versão vigente estará sempre
              disponível nesta página, com a data da última atualização no topo. O uso contínuo do
              aplicativo após alterações relevantes representa concordância com a nova versão.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">13. Legislação aplicável</h2>
            <p className="mt-2">
              Estes termos são regidos pelas leis da República Federativa do Brasil. Eventuais
              controvérsias serão resolvidas no foro do domicílio do consumidor, quando aplicável a
              legislação consumerista.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">14. Termos da Apple</h2>
            <p className="mt-2">
              Para usuários que adquiriram o aplicativo ou assinaturas pela App Store, aplicam-se
              também o Contrato de Licença de Usuário Final padrão da Apple (EULA), disponível em{' '}
              <a
                href={EULA_APPLE}
                target="_blank"
                rel="noreferrer"
                className="text-primary-500 font-medium hover:underline"
              >
                apple.com/legal/internet-services/itunes/dev/stdeula
              </a>
              , e as demais políticas da Apple. Em caso de conflito, prevalecem as condições
              obrigatórias da App Store.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">15. Contato</h2>
            <p className="mt-2">
              Dúvidas sobre estes termos ou sobre sua assinatura: {EMAIL_SUPORTE}. Consulte também a
              página de{' '}
              <Link to="/suporte" className="text-primary-500 font-medium hover:underline">
                Suporte
              </Link>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
