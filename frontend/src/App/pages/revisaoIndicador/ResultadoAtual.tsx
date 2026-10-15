import styled from "styled-components";
import { useCalculoIndicador, type Indicador } from "../../api/indicadores.js";
import { Card, SectionTitle, Muted } from "../../../Styles/ui.js";

type Resultado =
  | { status: "OK"; valor: number }
  | { status: "OK_FAIXAS"; faixas: Array<{ rotulo: string; percentual: number }> }
  | { status: "OK_DISTRIBUICAO"; itens: Array<{ opcao: string; contagem: number; percentual: number }> }
  | { status: "SEM_DADOS" }
  | { status: "INCOMPLETO"; motivo: string };

type ResultadoComRecorte = Resultado | { antes: Resultado; apos: Resultado };

const TIPOS_EM_PERCENTUAL = new Set(["PROPORCAO", "CRUZAMENTO", "PERCENTIL_OMS"]);

const Valor = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: ${(p) => p.theme.cores.primary};
`;

const Lista = styled.ul`
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
`;

const Par = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  @media (max-width: 560px) { grid-template-columns: 1fr; }
`;

const Rotulo = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.cores.textMuted};
  margin-bottom: 6px;
`;

function ehPar(r: ResultadoComRecorte): r is { antes: Resultado; apos: Resultado } {
  return "antes" in r && "apos" in r;
}

function Bloco({ resultado, tipo }: { resultado: Resultado; tipo: string }) {
  switch (resultado.status) {
    case "OK":
      // Mesmo formato das telas de resultado (`${percentual}%`).
      return <Valor>{TIPOS_EM_PERCENTUAL.has(tipo) ? `${resultado.valor}%` : String(resultado.valor)}</Valor>;
    case "OK_FAIXAS":
      return (
        <Lista>
          {resultado.faixas.map((f) => (
            <li key={f.rotulo}>
              {f.rotulo}: {`${f.percentual}%`}
            </li>
          ))}
        </Lista>
      );
    case "OK_DISTRIBUICAO":
      return (
        <Lista>
          {resultado.itens.map((i) => (
            <li key={i.opcao}>
              {i.opcao}: {`${i.percentual}%`}
            </li>
          ))}
        </Lista>
      );
    case "SEM_DADOS":
      return <Muted>Sem respostas aprovadas ainda</Muted>;
    case "INCOMPLETO":
      return <Muted>{resultado.motivo}</Muted>;
    default:
      return <Muted>Resultado em formato desconhecido.</Muted>;
  }
}

export function ResultadoAtual({ indicador }: { indicador: Indicador }) {
  const pesquisaId = indicador.pesquisaId ?? undefined;
  const { data, isLoading, isError } = useCalculoIndicador(indicador.codigo, pesquisaId);
  const resultado = data as ResultadoComRecorte | null | undefined;

  let corpo;
  if (!pesquisaId) corpo = <Muted>Indicador sem pesquisa vinculada: o resultado aparece só no painel.</Muted>;
  else if (isLoading) corpo = <Muted>Calculando…</Muted>;
  else if (isError) corpo = <Muted>Não foi possível calcular agora.</Muted>;
  else if (!resultado) corpo = <Muted>Sem resultado para este indicador ainda.</Muted>;
  else if (ehPar(resultado))
    corpo = (
      <Par>
        <div>
          <Rotulo>Antes</Rotulo>
          <Bloco resultado={resultado.antes} tipo={indicador.tipo} />
        </div>
        <div>
          <Rotulo>Depois</Rotulo>
          <Bloco resultado={resultado.apos} tipo={indicador.tipo} />
        </div>
      </Par>
    );
  else corpo = <Bloco resultado={resultado} tipo={indicador.tipo} />;

  return (
    <Card style={{ marginTop: 16 }}>
      <SectionTitle>Resultado atual</SectionTitle>
      {corpo}
    </Card>
  );
}
