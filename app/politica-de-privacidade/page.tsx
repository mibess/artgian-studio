import type { Metadata } from "next";
import { LegalPage, LegalSection } from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Política de Privacidade | Artgian Studio",
  description:
    "Saiba como a Artgian Studio coleta, utiliza, armazena e protege dados pessoais.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Privacidade e proteção de dados"
      title="Política de Privacidade"
      description="A Artgian Studio respeita a sua privacidade e trata dados pessoais de forma transparente, segura e limitada às finalidades descritas nesta política."
    >
      <LegalSection title="1. Quem somos">
        <p>
          A Artgian Studio, representada por Angélica Santos, cria e comercializa
          produtos personalizados em impressão 3D. Esta política se aplica ao
          site, ao atendimento e às interações com o perfil @artgian.studio no
          Instagram.
        </p>
      </LegalSection>

      <LegalSection title="2. Dados que podemos tratar">
        <p>
          Podemos receber nome, nome de usuário e identificador do Instagram,
          mensagens, comentários e informações enviadas voluntariamente durante
          o atendimento. Em pedidos, também podemos tratar telefone, e-mail,
          endereço de entrega, dados do produto e informações necessárias ao
          pagamento e envio.
        </p>
        <p>
          Não solicitamos senhas do Instagram. Dados de pagamento são processados
          pelo provedor de pagamento e não armazenamos o número completo do cartão.
        </p>
      </LegalSection>

      <LegalSection title="3. Como usamos os dados">
        <p>
          Utilizamos os dados para responder mensagens e comentários, entender a
          solicitação, elaborar orçamentos, produzir e entregar pedidos, prestar
          suporte, prevenir fraude, cumprir obrigações legais e melhorar o
          atendimento. Podemos usar automação para organizar conversas e sugerir
          respostas, sempre vinculada a essas finalidades.
        </p>
      </LegalSection>

      <LegalSection title="4. Integração com Instagram e Meta">
        <p>
          Quando você interage com a Artgian Studio pelo Instagram, recebemos
          somente os dados disponibilizados pela Meta e autorizados pelas
          permissões concedidas ao aplicativo. O tratamento também está sujeito
          aos termos e às políticas da Meta. Não vendemos dados obtidos do
          Instagram e não os utilizamos para criar perfis de publicidade de
          terceiros.
        </p>
      </LegalSection>

      <LegalSection title="5. Compartilhamento">
        <p>
          Dados podem ser compartilhados, no limite necessário, com provedores de
          hospedagem e tecnologia, Meta/Instagram, meios de pagamento, plataformas
          de frete e transportadoras. Também poderemos compartilhar informações
          quando houver obrigação legal ou para proteger direitos e prevenir
          atividades ilícitas.
        </p>
      </LegalSection>

      <LegalSection title="6. Armazenamento e segurança">
        <p>
          Adotamos medidas técnicas e administrativas razoáveis para proteger os
          dados contra acesso não autorizado, perda, alteração ou divulgação. Os
          dados são mantidos somente pelo período necessário ao atendimento,
          execução do pedido e cumprimento de obrigações legais e regulatórias.
        </p>
      </LegalSection>

      <LegalSection title="7. Seus direitos">
        <p>
          Nos termos da Lei Geral de Proteção de Dados (LGPD), você pode solicitar
          confirmação e acesso, correção, portabilidade quando aplicável,
          informação sobre compartilhamento, revogação do consentimento,
          anonimização, bloqueio ou exclusão de dados tratados de forma
          desnecessária ou irregular.
        </p>
      </LegalSection>

      <LegalSection title="8. Exclusão de dados">
        <p>
          As instruções para solicitar a exclusão estão disponíveis em
          <a className="ml-1 font-semibold text-[#9b702a] underline" href="/exclusao-de-dados">
            /exclusao-de-dados
          </a>
          . Dados cuja conservação seja exigida por lei poderão ser mantidos de
          forma restrita pelo prazo obrigatório.
        </p>
      </LegalSection>

      <LegalSection title="9. Contato">
        <p>
          Para dúvidas ou solicitações de privacidade, fale com a Artgian Studio
          pelo Instagram
          <a
            className="mx-1 font-semibold text-[#9b702a] underline"
            href="https://www.instagram.com/artgian.studio/"
            rel="noreferrer"
            target="_blank"
          >
            @artgian.studio
          </a>
          ou pelo
          <a
            className="ml-1 font-semibold text-[#9b702a] underline"
            href="https://wa.me/5516997432741"
            rel="noreferrer"
            target="_blank"
          >
            WhatsApp oficial
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="10. Atualizações desta política">
        <p>
          Esta política poderá ser atualizada para refletir mudanças legais,
          operacionais ou nos serviços utilizados. A versão vigente e a data da
          última atualização permanecerão publicadas nesta página.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
