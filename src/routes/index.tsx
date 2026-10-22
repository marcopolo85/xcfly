import { createFileRoute } from "@tanstack/react-router";
import { FlightGame } from "@/components/FlightGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Thermikjagd – Gleitschirm-Streckenflug Schweiz" },
      { name: "description", content: "2D-Gleitschirm-Simulator: finde unsichtbare Thermik per Vario-Ton und fliege XC-Strecken ab Schweizer Startplätzen." },
      { property: "og:title", content: "Thermikjagd – Gleitschirm-Streckenflug Schweiz" },
      { property: "og:description", content: "Thermik per Vario finden, ausgedehnte Streckenflüge über die Schweizer Alpen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FlightGame,
});
