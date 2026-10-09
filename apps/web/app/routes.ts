import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("team", "routes/team.tsx"),
  route("team/pokemon/:id", "routes/team.pokemon.$id.ts"),
  route("battle", "routes/battle.tsx"),
] satisfies RouteConfig;
