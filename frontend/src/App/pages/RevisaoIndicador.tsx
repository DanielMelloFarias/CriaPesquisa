import { useParams } from "react-router-dom";
import { useIndicador } from "../api/indicadores.js";
import { PageTitle } from "../../Styles/ui.js";

// Placeholder mínimo: a Tarefa 6 substitui esta página pela tela de revisão.
export function RevisaoIndicador() {
  const { id } = useParams();
  const { data } = useIndicador(id);
  return <PageTitle>{data?.nome ?? "Indicador"}</PageTitle>;
}
