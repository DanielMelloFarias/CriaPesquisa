import { NavLink } from "react-router-dom";
import styled from "styled-components";
import { LayoutDashboard, ClipboardList, Users, ScrollText, Gauge, type LucideIcon } from "lucide-react";
import { Logo } from "../ui/Logo.js";
import { UsuarioCard } from "./UsuarioCard.js";
import { useAuth } from "../../App/auth/useAuth.js";

interface ItemNav {
  to: string;
  rotulo: string;
  Icon: LucideIcon;
  papeis?: string[];
}

const NAV: { grupo: string; itens: ItemNav[] }[] = [
  {
    grupo: "Principal",
    itens: [
      { to: "/", rotulo: "Dashboard", Icon: LayoutDashboard },
      { to: "/pesquisas", rotulo: "Pesquisas", Icon: ClipboardList },
    ],
  },
  {
    grupo: "Administração",
    itens: [
      { to: "/indicadores", rotulo: "Indicadores", Icon: Gauge, papeis: ["ADMIN", "GESTOR"] },
      { to: "/usuarios", rotulo: "Usuários", Icon: Users, papeis: ["ADMIN"] },
      { to: "/logs", rotulo: "Auditoria", Icon: ScrollText, papeis: ["ADMIN"] },
    ],
  },
];

const Aside = styled.nav<{ $colapsada: boolean }>`
  background: ${(p) => p.theme.cores.sidebar};
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0) 24%);
  color: ${(p) => p.theme.cores.sidebarText};
  width: ${(p) => (p.$colapsada ? "84px" : "240px")};
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 18px 12px;
  transition: width 0.18s ease;
  /* Fixa a navbar no viewport: o usuário no rodapé fica sempre visível,
     sem precisar rolar a página (o conteúdo à direita rola normalmente). */
  position: sticky;
  top: 0;
  align-self: flex-start;
  height: 100vh;
  overflow: hidden;

  @media (max-width: 860px) {
    position: static;
    align-self: auto;
    height: auto;
    overflow: visible;
    width: 100%;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
  }
`;

const Topo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 8px;

  @media (max-width: 860px) {
    flex-direction: row;
    padding-bottom: 0;
    margin-bottom: 0;
    padding-right: 12px;
    border-right: 1px solid rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
  }
`;

const Linha = styled.div`
  width: 34px;
  height: 3px;
  border-radius: 2px;
  background: ${(p) => p.theme.cores.accent};
  @media (max-width: 860px) { display: none; }
`;

const Grupos = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;

  @media (max-width: 860px) {
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
`;

const Grupo = styled.div<{ $colapsada: boolean }>`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  color: ${(p) => p.theme.cores.sidebarMuted};
  padding: 14px 10px 6px;
  ${(p) => (p.$colapsada ? "display:none;" : "")}
  @media (max-width: 860px) { display: none; }
`;

const linkBase = `
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
`;

const Item = styled(NavLink)<{ $colapsada: boolean }>`
  ${linkBase}
  color: ${(p) => p.theme.cores.sidebarMuted};
  justify-content: ${(p) => (p.$colapsada ? "center" : "flex-start")};
  &:hover { background: rgba(255, 255, 255, 0.08); color: ${(p) => p.theme.cores.sidebarText}; }
  &.active {
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.06) 100%);
    color: #fff;
    font-weight: 600;
    box-shadow: inset 3px 0 0 ${(p) => p.theme.cores.accent}, 0 4px 14px rgba(0, 0, 0, 0.18);
  }
  @media (max-width: 860px) { justify-content: center; }
`;

const Rotulo = styled.span<{ $colapsada: boolean }>`
  ${(p) => (p.$colapsada ? "display:none;" : "")}
  @media (max-width: 860px) { display: none; }
`;

const Rodape = styled.div<{ $colapsada: boolean }>`
  margin-top: auto;
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  @media (max-width: 860px) {
    margin-top: 0;
    padding-top: 0;
    padding-left: 12px;
    border-left: 1px solid rgba(255, 255, 255, 0.12);
    flex-direction: row;
    align-items: center;
  }
`;

export function Sidebar({ colapsada }: { colapsada: boolean }) {
  const { usuario } = useAuth();
  const podeVer = (papeis?: string[]) => !papeis || (usuario != null && papeis.includes(usuario.papel));
  const grupos = NAV.map((g) => ({ ...g, itens: g.itens.filter((i) => podeVer(i.papeis)) })).filter(
    (g) => g.itens.length > 0,
  );
  return (
    <Aside aria-label="navegação principal" $colapsada={colapsada}>
      <Topo>
        <Logo variante="branca" altura={colapsada ? 22 : 28} />
        <Linha />
      </Topo>
      <Grupos>
        {grupos.map((g) => (
          <div key={g.grupo} style={{ display: "contents" }}>
            <Grupo $colapsada={colapsada}>{g.grupo}</Grupo>
            {g.itens.map(({ to, rotulo, Icon }) => (
              <Item key={to} to={to} end={to === "/"} $colapsada={colapsada} title={rotulo}>
                <Icon size={19} />
                <Rotulo $colapsada={colapsada}>{rotulo}</Rotulo>
              </Item>
            ))}
          </div>
        ))}
      </Grupos>
      <Rodape $colapsada={colapsada}>
        <UsuarioCard colapsada={colapsada} />
      </Rodape>
    </Aside>
  );
}
