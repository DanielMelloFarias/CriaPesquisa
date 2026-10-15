import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Layout } from "../Components/layout/Layout.js";
import { ProtectedRoute } from "./auth/ProtectedRoute.js";
import { Login } from "./pages/Login.js";
import { Pesquisas } from "./pages/Pesquisas.js";
import { DetalhePesquisa } from "./pages/DetalhePesquisa.js";
import { TrocarSenha } from "./pages/TrocarSenha.js";

/**
 * Telas carregadas sob demanda. O critério é o custo: painel e resultados
 * arrastam o Chart.js, o construtor e a administração só interessam a ADMIN e
 * GESTOR. Um coletador em campo, no 4G, baixa só login, lista e formulário.
 * Login, lista e o formulário de resposta continuam no pacote inicial porque
 * são o caminho de uso mais comum.
 */
const Dashboard = lazy(() => import("./pages/Dashboard.js").then((m) => ({ default: m.Dashboard })));
const ResultadosPesquisa = lazy(() =>
  import("./pages/ResultadosPesquisa.js").then((m) => ({ default: m.ResultadosPesquisa })),
);
const NovaPesquisa = lazy(() => import("./pages/NovaPesquisa.js").then((m) => ({ default: m.NovaPesquisa })));
const Usuarios = lazy(() => import("./pages/Usuarios.js").then((m) => ({ default: m.Usuarios })));
const NovoUsuario = lazy(() => import("./pages/NovoUsuario.js").then((m) => ({ default: m.NovoUsuario })));
const Indicadores = lazy(() => import("./pages/Indicadores.js").then((m) => ({ default: m.Indicadores })));
const RevisaoIndicador = lazy(() =>
  import("./pages/RevisaoIndicador.js").then((m) => ({ default: m.RevisaoIndicador })),
);
const Logs = lazy(() => import("./pages/Logs.js").then((m) => ({ default: m.Logs })));

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    // Exige login, mas é a única rota que aceita senha provisória — é para onde
    // o ProtectedRoute manda quem ainda precisa trocar.
    element: <ProtectedRoute permitirSenhaProvisoria />,
    children: [{ path: "/trocar-senha", element: <TrocarSenha /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/", element: <Dashboard /> },
          { path: "/pesquisas", element: <Pesquisas /> },
          { path: "/pesquisas/:id", element: <ResultadosPesquisa /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute papeis={["ADMIN", "GESTOR"]} />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/pesquisas/nova", element: <NovaPesquisa /> },
          { path: "/pesquisas/:id/editar", element: <NovaPesquisa /> },
          { path: "/indicadores", element: <Indicadores /> },
          { path: "/indicadores/:id", element: <RevisaoIndicador /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute papeis={["ADMIN", "GESTOR", "COLETADOR"]} />,
    children: [
      {
        element: <Layout />,
        children: [{ path: "/pesquisas/:id/responder", element: <DetalhePesquisa /> }],
      },
    ],
  },
  {
    element: <ProtectedRoute papeis={["ADMIN"]} />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/usuarios", element: <Usuarios /> },
          { path: "/usuarios/novo", element: <NovoUsuario /> },
          { path: "/usuarios/:id/editar", element: <NovoUsuario /> },
          { path: "/logs", element: <Logs /> },
        ],
      },
    ],
  },
]);
