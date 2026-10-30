import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styled, { useTheme } from "styled-components";
import { Bar } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { ArrowLeft, Send, Check, X, Pencil, MessageSquareText } from "lucide-react";
import "../../Components/charts/setup.js";
import { ChartCard } from "../../Components/charts/ChartCard.js";
import { DonutInterativo } from "../../Components/charts/DonutInterativo.js";
import { FunilValores } from "../../Components/charts/FunilValores.js";
import { usePesquisas, usePesquisa, useResumo, type ResumoPergunta } from "../api/pesquisas.js";
import {
  useRespostas,
  useAprovarResposta,
  useReprovarResposta,
  type RespostaRegistro,
  type StatusResposta,
} from "../api/respostas.js";
import { useAuth } from "../auth/useAuth.js";
import { podeResponder, podeRevisar } from "../auth/permissoes.js";
import {
  PageHeader,
  PageTitle,
  PageSubtitle,
  Card,
  Button,
  Muted,
  Banner,
  SectionTitle,
  KpiRow,
  KpiCard,
  KpiIcon,
  KpiValue,
  KpiLabel,
  TableWrap,
  Tabela,
  Th,
  Td,
  TextInput,
  Select,
} from "../../Styles/ui.js";
import { CheckCircle2, Clock, ListChecks } from "lucide-react";

const Barra = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 18px;
  padding: 12px 14px;
  border-radius: 12px;
  background: ${(p) => p.theme.cores.surface};
  border: 1px solid ${(p) => p.theme.cores.border};
  label {
    font-size: 12.5px;
    font-weight: 600;
    color: ${(p) => p.theme.cores.textMuted};
  }
`;

const Grade = styled.div`
  display: grid;
  gap: 16px;
  margin-bottom: 16px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
`;

const Amplos = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
`;

const CardColuna = styled(Card)`
  display: flex;
  flex-direction: column;
`;

const ResumoSimples = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  min-height: 88px;
`;

const StatValue = styled.div`
  font-family: 'Space Grotesk', sans-serif;
  font-size: 26px;
  font-weight: 700;
  color: ${(p) => p.theme.cores.primaryDark};
`;
const StatLabel = styled.div`
  font-size: 11.5px;
  color: ${(p) => p.theme.cores.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

const StatusBadge = styled.span<{ $s: StatusResposta }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  background: ${(p) =>
    p.$s === "APROVADA"
      ? `${p.theme.cores.success}22`
      : p.$s === "REPROVADA"
        ? `${p.theme.cores.danger}22`
        : `${p.theme.cores.warn}22`};
  color: ${(p) =>
    p.$s === "APROVADA" ? p.theme.cores.success : p.$s === "REPROVADA" ? p.theme.cores.danger : p.theme.cores.warn};
`;

const Acoes = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const MiniBtn = styled.button<{ $tom?: "aprovar" | "reprovar" }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 8px;
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid ${(p) => p.theme.cores.border};
  background: ${(p) => p.theme.cores.surfaceAlt};
  color: ${(p) => p.theme.cores.text};
  transition: all 0.13s ease;
  &:hover {
    border-color: ${(p) =>
      p.$tom === "aprovar" ? p.theme.cores.success : p.$tom === "reprovar" ? p.theme.cores.danger : p.theme.cores.accent};
    color: ${(p) =>
      p.$tom === "aprovar" ? p.theme.cores.success : p.$tom === "reprovar" ? p.theme.cores.danger : p.theme.cores.primary};
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(8, 20, 40, 0.5);
  display: grid;
  place-items: center;
  padding: 16px;
`;

const Modal = styled.div`
  width: 100%;
  max-width: 420px;
  background: ${(p) => p.theme.cores.surface};
  border: 1px solid ${(p) => p.theme.cores.border};
  border-radius: 14px;
  padding: 22px;
  box-shadow: ${(p) => p.theme.cores.shadow};
`;

const rotuloStatus: Record<StatusResposta, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  REPROVADA: "Reprovada",
};

function IconeStatus({ s }: { s: StatusResposta }) {
  if (s === "APROVADA") return <Check size={12} />;
  if (s === "REPROVADA") return <X size={12} />;
  return <Clock size={12} />;
}

export function ResultadosPesquisa() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useTheme();
  const { usuario } = useAuth();
  const revisar = podeRevisar(usuario?.papel);
  const responder = podeResponder(usuario?.papel);

  const { data: lista } = usePesquisas();
  const { data: pesquisa, isLoading: carregandoP } = usePesquisa(id);
  const { data: resumo, isLoading: carregandoR } = useResumo(id);
  // Registros individuais trazem dados pessoais: o VISUALIZADOR fica só com o
  // resumo, e o COLETADOR recebe da API apenas os que ele coletou.
  const { data: registros } = useRespostas(responder ? id : undefined);
  const aprovar = useAprovarResposta();
  const reprovar = useReprovarResposta();

  const [reprovando, setReprovando] = useState<RespostaRegistro | null>(null);
  const [observacao, setObservacao] = useState("");

  const optBar: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: t.cores.textMuted, font: { size: 10 } }, grid: { color: t.cores.border } },
      y: { ticks: { color: t.cores.textMuted, font: { size: 10 } }, grid: { display: false } },
    },
  };

  if (carregandoP || carregandoR) {
    return (
      <div>
        <PageHeader>
          <PageTitle>Resultados</PageTitle>
        </PageHeader>
        <Card>
          <Muted style={{ textAlign: "center", padding: "28px 0" }}>Carregando resultados…</Muted>
        </Card>
      </div>
    );
  }

  if (!pesquisa || !resumo) {
    return (
      <div>
        <PageHeader>
          <PageTitle>Pesquisa não encontrada</PageTitle>
          <Button $variant="ghost" onClick={() => navigate("/pesquisas")}>
            <ArrowLeft size={16} /> Voltar
          </Button>
        </PageHeader>
      </div>
    );
  }

  const pendentes = registros?.itens.filter((r) => r.status === "PENDENTE").length ?? 0;

  // Perguntas com muitas categorias viram cards largos (linha inteira); as demais
  // ficam no grid compacto. Separá-las evita buracos no grid.
  const ehAmplo = (pg: ResumoPergunta) => !!pg.distribuicao && pg.distribuicao.filter((d) => d.contagem > 0).length > 8;
  const compactos = resumo.perguntas.filter((pg) => !ehAmplo(pg));
  const amplos = resumo.perguntas.filter(ehAmplo);

  function confirmarReprovar() {
    if (!reprovando) return;
    reprovar.mutate({ id: reprovando.id, observacao: observacao.trim() || undefined });
    setReprovando(null);
    setObservacao("");
  }

  function renderPergunta(p: ResumoPergunta) {
    if (p.distribuicao && p.distribuicao.length > 0) {
      const ativos = [...p.distribuicao].filter((d) => d.contagem > 0).sort((a, b) => b.contagem - a.contagem);

      // Muitas categorias (ex.: município, grupos populacionais) → card sozinho na
      // linha, rosca com a legenda inteira ao lado (todas visíveis, sem "Outros").
      if (ativos.length > 8) {
        return (
          <DonutInterativo
            key={p.perguntaId}
            full
            legenda="right"
            titulo={p.enunciado}
            unidade="respostas"
            labels={ativos.map((d) => d.opcao)}
            data={ativos.map((d) => d.contagem)}
          />
        );
      }

      // Múltipla escolha (poucas opções) → barras horizontais (com "Mostrar valores").
      if (p.tipo === "MULTIPLA_ESCOLHA") {
        const labels = p.distribuicao.map((d) => d.opcao);
        const dados = p.distribuicao.map((d) => d.contagem);
        const valores = p.distribuicao.map((d) => ({ rotulo: d.opcao, valor: d.contagem, extra: `${d.percentual}%`, barra: d.contagem }));
        return (
          <ChartCard key={p.perguntaId} titulo={p.enunciado} valores={valores}>
            <Bar
              data={{ labels, datasets: [{ label: "Respostas", data: dados, backgroundColor: t.cores.primary, borderRadius: 6 }] }}
              options={optBar}
            />
          </ChartCard>
        );
      }

      // Escolha única (poucas opções) → rosca compacta.
      return (
        <DonutInterativo
          key={p.perguntaId}
          titulo={p.enunciado}
          unidade="respostas"
          labels={ativos.map((d) => d.opcao)}
          data={ativos.map((d) => d.contagem)}
        />
      );
    }

    if (p.tipo === "NUMERO") {
      const valores = [
        { rotulo: "Máximo", valor: p.maximo ?? 0, barra: p.maximo ?? 0 },
        { rotulo: "Média", valor: p.media ?? 0, barra: p.media ?? 0 },
        { rotulo: "Mínimo", valor: p.minimo ?? 0, barra: p.minimo ?? 0 },
      ];
      return (
        <Card key={p.perguntaId}>
          <SectionTitle style={{ margin: 0, marginBottom: 12 }}>{p.enunciado}</SectionTitle>
          <FunilValores valores={valores} />
          <Muted style={{ marginTop: 10, fontSize: 12 }}>{p.totalRespostas} resposta(s)</Muted>
        </Card>
      );
    }

    return (
      <CardColuna key={p.perguntaId}>
        <SectionTitle style={{ margin: 0 }}>{p.enunciado}</SectionTitle>
        <ResumoSimples>
          <KpiIcon $cor={t.cores.primary}>
            <MessageSquareText size={20} />
          </KpiIcon>
          <div>
            <StatValue style={{ fontSize: 26 }}>{p.preenchidos ?? p.totalRespostas}</StatValue>
            <StatLabel>respostas preenchidas</StatLabel>
          </div>
        </ResumoSimples>
      </CardColuna>
    );
  }

  return (
    <div>
      <PageHeader>
        <div>
          <PageTitle>Resultados da pesquisa</PageTitle>
          <PageSubtitle>{pesquisa.titulo}</PageSubtitle>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button $variant="ghost" onClick={() => navigate("/pesquisas")}>
            <ArrowLeft size={16} /> Pesquisas
          </Button>
          {responder && (
            <Button onClick={() => navigate(`/pesquisas/${id}/responder`)}>
              <Send size={16} /> Responder
            </Button>
          )}
        </div>
      </PageHeader>

      {lista && lista.itens.length > 1 && (
        <Barra>
          <label htmlFor="sel-ver-pesquisa">Ver pesquisa:</label>
          <Select
            id="sel-ver-pesquisa"
            value={id}
            onChange={(e) => navigate(`/pesquisas/${e.target.value}`)}
            style={{ maxWidth: 360 }}
          >
            {lista.itens.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo}
              </option>
            ))}
          </Select>
        </Barra>
      )}

      <KpiRow>
        <KpiCard $cor="#16A34A">
          <KpiIcon $cor="#16A34A">
            <CheckCircle2 size={20} />
          </KpiIcon>
          <KpiValue>{resumo.total}</KpiValue>
          <KpiLabel>Respostas aprovadas</KpiLabel>
        </KpiCard>
        <KpiCard $cor="#D97706">
          <KpiIcon $cor="#D97706">
            <Clock size={20} />
          </KpiIcon>
          <KpiValue>{pendentes}</KpiValue>
          <KpiLabel>Pendentes de revisão</KpiLabel>
        </KpiCard>
        <KpiCard $cor="#1756B8">
          <KpiIcon $cor="#1756B8">
            <ListChecks size={20} />
          </KpiIcon>
          <KpiValue>{resumo.perguntas.length}</KpiValue>
          <KpiLabel>Perguntas</KpiLabel>
        </KpiCard>
      </KpiRow>

      {resumo.total === 0 ? (
        <Banner $tone="info" style={{ marginBottom: 16 }}>
          Ainda não há respostas aprovadas nesta pesquisa. Assim que o PO aprovar, os gráficos aparecem aqui.
        </Banner>
      ) : (
        <>
          {compactos.length > 0 && <Grade>{compactos.map(renderPergunta)}</Grade>}
          {amplos.length > 0 && <Amplos>{amplos.map(renderPergunta)}</Amplos>}
        </>
      )}

      {responder && (
        <Card>
          <SectionTitle>{revisar ? "Registros por usuário" : "Seus registros"}</SectionTitle>
          <Muted style={{ fontSize: 12.5, marginBottom: 12 }}>
            Cada envio gera um registro. {revisar ? "Aprove ou reprove para os dados entrarem nos resultados." : "Somente o PO (Gestor) aprova ou reprova."}
          </Muted>
          {!registros || registros.itens.length === 0 ? (
            <Muted style={{ textAlign: "center", padding: "18px 0" }}>Nenhum registro ainda.</Muted>
          ) : (
            <TableWrap>
              <Tabela>
                <thead>
                  <tr>
                    <Th>Usuário</Th>
                    <Th>Município</Th>
                    <Th>Enviada</Th>
                    <Th>Status</Th>
                    <Th>Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {registros.itens.map((r) => {
                    const ehDono = r.coletador?.id === usuario?.id;
                    // A API recusa edição fora de coleta (a resposta voltaria a PENDENTE).
                    const podeEditar = (revisar || ehDono) && pesquisa?.status === "PUBLICADA";
                    return (
                      <tr key={r.id}>
                        <Td style={{ fontWeight: 600 }}>{r.coletador?.nome ?? "—"}</Td>
                        <Td>{r.municipio ?? "—"}</Td>
                        <Td>{new Date(r.enviadaEm).toLocaleDateString("pt-BR")}</Td>
                        <Td>
                          <StatusBadge $s={r.status}>
                            <IconeStatus s={r.status} />
                            {rotuloStatus[r.status]}
                          </StatusBadge>
                          {r.status === "REPROVADA" && r.observacao && (
                            <Muted style={{ display: "block", fontSize: 11, marginTop: 3 }}>{r.observacao}</Muted>
                          )}
                        </Td>
                        <Td>
                          <Acoes>
                            {podeEditar && (
                              <MiniBtn
                                type="button"
                                onClick={() => navigate(`/pesquisas/${id}/responder?resposta=${r.id}`)}
                                title="Editar resposta"
                              >
                                <Pencil size={12} /> Editar
                              </MiniBtn>
                            )}
                            {revisar && r.status !== "APROVADA" && (
                              <MiniBtn
                                type="button"
                                $tom="aprovar"
                                disabled={aprovar.isPending}
                                onClick={() => aprovar.mutate(r.id)}
                                title="Aprovar"
                              >
                                <Check size={12} /> Aprovar
                              </MiniBtn>
                            )}
                            {revisar && r.status !== "REPROVADA" && (
                              <MiniBtn
                                type="button"
                                $tom="reprovar"
                                onClick={() => {
                                  setReprovando(r);
                                  setObservacao("");
                                }}
                                title="Reprovar"
                              >
                                <X size={12} /> Reprovar
                              </MiniBtn>
                            )}
                          </Acoes>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Tabela>
            </TableWrap>
          )}
        </Card>
      )}

      {reprovando && (
        <Overlay
          onClick={(e) => {
            if (e.target === e.currentTarget) setReprovando(null);
          }}
        >
          <Modal>
            <SectionTitle style={{ marginTop: 0 }}>Reprovar registro</SectionTitle>
            <Muted style={{ fontSize: 12.5, marginBottom: 12 }}>
              Registro de <strong>{reprovando.coletador?.nome ?? "—"}</strong>
              {reprovando.municipio ? ` · ${reprovando.municipio}` : ""}. Informe o motivo (opcional):
            </Muted>
            <TextInput
              autoFocus
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: município divergente, dados incompletos…"
              style={{ width: "100%", marginBottom: 16 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button $variant="ghost" onClick={() => setReprovando(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmarReprovar} disabled={reprovar.isPending}>
                <X size={16} /> Reprovar
              </Button>
            </div>
          </Modal>
        </Overlay>
      )}
    </div>
  );
}
