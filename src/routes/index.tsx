import { createFileRoute } from "@tanstack/react-router";
import { GameView } from "@/components/game-view";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <GameView />;
}
