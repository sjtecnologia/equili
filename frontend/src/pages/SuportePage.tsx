import { Link } from 'react-router-dom'
import { Mail, MessageCircle, ShieldCheck } from 'lucide-react'

const EMAIL_SUPORTE = 'contato@sjtecnologia.com'

export default function SuportePage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-xs sm:p-10">
        <Link to="/login" className="text-sm font-medium text-primary-500 hover:underline">
          Voltar ao login
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100">
            <MessageCircle size={22} className="text-primary-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Suporte do Equili</h1>
            <p className="text-sm text-gray-500">Estamos aqui para ajudar com sua conta e assinatura.</p>
          </div>
        </div>

        <div className="mt-8 space-y-7 text-sm leading-7 text-gray-700 sm:text-base">
          <section className="rounded-xl border border-primary-100 bg-primary-50 p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Mail size={18} className="text-primary-500" />
              Fale com a gente
            </h2>
            <p className="mt-2">
              Envie um e-mail para{' '}
              <a
                href={`mailto:${EMAIL_SUPORTE}?subject=Suporte%20Equili`}
                className="font-semibold text-primary-600 hover:underline"
              >
                {EMAIL_SUPORTE}
              </a>
              . Respondemos em até <strong>2 dias úteis</strong>.
            </p>
            <p className="mt-2 text-gray-600">
              Para agilizar, informe o e-mail da sua conta, o modelo do aparelho e, se possível, um
              print da tela com o problema.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Perguntas frequentes</h2>

            <div className="mt-4 space-y-5">
              <div>
                <h3 className="font-semibold text-gray-900">Como cancelo minha assinatura no iPhone?</h3>
                <p className="mt-1">
                  Abra <strong>Ajustes</strong> no iPhone, toque no seu nome (Apple ID), depois em{' '}
                  <strong>Assinaturas</strong>, selecione <strong>Equili</strong> e toque em{' '}
                  <strong>Cancelar assinatura</strong>. Você também pode gerenciar em{' '}
                  <a
                    href="https://apps.apple.com/account/subscriptions"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-500 font-medium hover:underline"
                  >
                    apps.apple.com/account/subscriptions
                  </a>
                  . O acesso aos recursos pagos continua até o fim do período já pago.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900">Como restauro uma compra feita em outro aparelho?</h3>
                <p className="mt-1">
                  Entre com a mesma conta Equili e a mesma conta Apple ID usada na compra. Abra{' '}
                  <strong>Planos e assinaturas</strong> e toque em <strong>Restaurar compras</strong>.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900">Como excluo minha conta e meus dados?</h3>
                <p className="mt-1">
                  No app, abra <strong>Configurações &gt; Privacidade (LGPD)</strong> e use{' '}
                  <strong>Excluir minha conta e todos os dados</strong>. Se não conseguir acessar a
                  conta, envie um e-mail para {EMAIL_SUPORTE} a partir do endereço cadastrado.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900">Como revogo a autorização dos recursos de IA?</h3>
                <p className="mt-1">
                  Abra <strong>Configurações &gt; Recursos de inteligência artificial</strong> e toque
                  em <strong>Revogar autorização de IA</strong>. Sem a autorização, o chat, o Plano de
                  Ação e o assistente de voz ficam desativados, mas o restante do app continua
                  funcionando.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900">Esqueci minha senha ou não consigo entrar.</h3>
                <p className="mt-1">
                  Na tela de login, use a opção de recuperação de senha. Se ainda precisar de ajuda,
                  fale com a gente pelo e-mail {EMAIL_SUPORTE}.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900">Encontrei um erro ou tenho uma sugestão.</h3>
                <p className="mt-1">
                  Escreva para {EMAIL_SUPORTE} descrevendo o que aconteceu. Seu retorno ajuda a
                  melhorar o Equili.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <ShieldCheck size={18} className="text-primary-500" />
              Privacidade e termos
            </h2>
            <p className="mt-2">
              Consulte a{' '}
              <Link to="/privacidade" className="text-primary-500 font-medium hover:underline">
                Política de Privacidade
              </Link>{' '}
              e os{' '}
              <Link to="/termos" className="text-primary-500 font-medium hover:underline">
                Termos de Uso
              </Link>
              . Para assinaturas compradas na App Store, aplicam-se também os termos da Apple.
            </p>
          </section>

          <p className="text-xs text-gray-400">
            Equili — gestão financeira pessoal. Atendimento em português do Brasil.
          </p>
        </div>
      </article>
    </main>
  )
}
