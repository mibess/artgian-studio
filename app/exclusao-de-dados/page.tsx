import type { Metadata } from "next";
import { LegalPage, LegalSection } from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Exclusão de Dados | Artgian Studio",
  description:
    "Instruções para solicitar a exclusão de dados pessoais tratados pela Artgian Studio.",
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      eyebrow="Direitos do titular"
      title="Exclusão de dados"
      description="Você pode solicitar a exclusão dos dados associados às suas interações com a Artgian Studio e com o aplicativo do Instagram."
    >
      <LegalSection title="Como solicitar">
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            Envie uma mensagem pelo Instagram para
            <a
              className="ml-1 font-semibold text-[#9b702a] underline"
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
          </li>
          <li>
            Informe que deseja excluir seus dados e indique o nome de usuário do
            Instagram utilizado na interação.
          </li>
          <li>
            Poderemos solicitar uma confirmação mínima de identidade para evitar
            que terceiros apaguem dados em seu nome.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="Prazo e confirmação">
        <p>
          Confirmaremos o recebimento e concluiremos a solicitação em até 15 dias,
          salvo quando um prazo diferente for permitido pela legislação. Ao final,
          enviaremos uma confirmação pelo mesmo canal de contato.
        </p>
      </LegalSection>

      <LegalSection title="O que será excluído">
        <p>
          Serão excluídos ou anonimizados os dados de perfil, mensagens e registros
          de atendimento mantidos pela Artgian Studio que não precisem ser
          conservados por obrigação legal, regulatória, prevenção de fraude ou
          exercício regular de direitos.
        </p>
      </LegalSection>

      <LegalSection title="Remover a autorização na Meta">
        <p>
          Você também pode remover a integração nas configurações da sua conta
          Meta, em Aplicativos e sites. A remoção da autorização interrompe novos
          acessos, mas não substitui o pedido acima quando você também desejar a
          exclusão dos dados já armazenados pela Artgian Studio.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
