export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-gray-500 mb-10">Última atualização: 20/03/2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-gray-700">
          <p>
            Esta Política de Privacidade descreve como a <strong>ChatbotLiberty</strong> ("nós", "nosso" ou "plataforma") coleta, usa, armazena e protege as informações dos usuários ("usuário" ou "cliente") ao utilizar nossos serviços disponíveis em{' '}
            <a href="https://chatbotliberty.lovable.app" className="text-blue-600 underline">https://chatbotliberty.lovable.app</a>.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Informações que Coletamos</h2>
            <p className="mb-3">Podemos coletar as seguintes informações:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li><strong>Dados de identificação:</strong> nome, e-mail, telefone</li>
              <li><strong>Dados de comunicação:</strong> mensagens enviadas e recebidas através da plataforma</li>
              <li><strong>Dados de uso:</strong> interações com o sistema, logs de acesso, endereço IP, tipo de dispositivo e navegador</li>
              <li><strong>Dados de integração:</strong> informações provenientes de integrações com serviços de terceiros, incluindo a API oficial do WhatsApp</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Uso das Informações</h2>
            <p className="mb-3">As informações coletadas são utilizadas para:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Fornecer, operar e manter nossos serviços</li>
              <li>Permitir envio e recebimento de mensagens via integração com o WhatsApp</li>
              <li>Melhorar e personalizar a experiência do usuário</li>
              <li>Monitorar e analisar uso da plataforma</li>
              <li>Garantir segurança e prevenir fraudes</li>
              <li>Cumprir obrigações legais e regulatórias</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Compartilhamento de Dados</h2>
            <p className="mb-3">Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros, exceto:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Com provedores de serviços essenciais para a operação da plataforma (ex.: Meta/WhatsApp Business API)</li>
              <li>Quando exigido por lei, regulamento ou ordem judicial</li>
              <li>Para proteger nossos direitos, propriedade ou segurança</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Armazenamento e Segurança</h2>
            <p>
              As informações são armazenadas em servidores seguros com criptografia e controles de acesso adequados. Adotamos medidas técnicas e organizacionais para proteger os dados contra acesso não autorizado, perda, alteração ou destruição.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Retenção de Dados</h2>
            <p>
              Retemos seus dados pessoais apenas pelo tempo necessário para cumprir as finalidades para as quais foram coletados, ou conforme exigido por lei. Dados podem ser excluídos mediante solicitação do usuário.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Direitos do Usuário</h2>
            <p className="mb-3">Em conformidade com a Lei Geral de Proteção de Dados (LGPD), você tem o direito de:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
              <li>Solicitar a exclusão de seus dados</li>
              <li>Revogar o consentimento a qualquer momento</li>
              <li>Solicitar a portabilidade dos dados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Uso da API do WhatsApp</h2>
            <p>
              Nossa plataforma utiliza a API oficial do WhatsApp Business (Meta) para envio e recebimento de mensagens. Ao utilizar nossos serviços, você concorda que suas mensagens e dados de contato poderão ser processados através desta integração, em conformidade com os{' '}
              <a href="https://www.whatsapp.com/legal/business-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Termos de Serviço do WhatsApp Business</a>{' '}
              e a{' '}
              <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Política de Privacidade do WhatsApp</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Alterações nesta Política</h2>
            <p>
              Reservamo-nos o direito de atualizar esta Política de Privacidade a qualquer momento. Alterações significativas serão comunicadas através da plataforma. Recomendamos a revisão periódica desta página.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contato</h2>
            <p>
              Se você tiver dúvidas ou solicitações sobre esta Política de Privacidade, entre em contato conosco através da plataforma ou pelo e-mail disponível em nosso site.
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} ChatbotLiberty. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
