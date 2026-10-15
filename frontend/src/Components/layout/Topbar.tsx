import styled from "styled-components";
import { useLocation } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ThemeToggle } from "../ui/ThemeToggle.js";
import { Notificacoes } from "./Notificacoes.js";
import { UsuarioAvatar } from "./UsuarioAvatar.js";

const TITULOS: Record<string, string> = {
  "/": "Visão geral",
  "/pesquisas": "Pesquisas",
  "/indicadores": "Indicadores",
  "/usuarios": "Usuários",
  "/logs": "Auditoria",
};

const Bar = styled.header`
  min-height: 60px;
  background: ${(p) => p.theme.cores.surface};
  border-bottom: 1px solid ${(p) => p.theme.cores.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 20;
  box-shadow: 0 2px 14px rgba(11, 45, 110, 0.05);
  @media (max-width: 640px) {
    padding: 0 12px;
  }
`;

const Esq = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
`;

const Toggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid ${(p) => p.theme.cores.border};
  background: ${(p) => p.theme.cores.surfaceAlt};
  color: ${(p) => p.theme.cores.text};
  transition: background 0.15s ease;
  &:hover { background: ${(p) => p.theme.cores.border}; }
  @media (max-width: 860px) { display: none; }
`;

const Titulo = styled.div`
  font-family: 'Space Grotesk', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.cores.primaryDark};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Dir = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export function Topbar({ colapsada, onToggle }: { colapsada: boolean; onToggle: () => void }) {
  const { pathname } = useLocation();
  const titulo = TITULOS[pathname] ?? (pathname.startsWith("/indicadores/") ? "Indicadores" : "CriaPesquisa");

  return (
    <Bar>
      <Esq>
        <Toggle
          type="button"
          onClick={onToggle}
          aria-label={colapsada ? "expandir menu" : "minimizar menu"}
          title={colapsada ? "Expandir menu" : "Minimizar menu"}
        >
          {colapsada ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </Toggle>
        <Titulo>{titulo}</Titulo>
      </Esq>
      <Dir>
        <Notificacoes />
        <ThemeToggle />
        <UsuarioAvatar />
      </Dir>
    </Bar>
  );
}
