import { createFileRoute } from "@tanstack/react-router";
import { CompleteVehicleController } from "@/components/grf/complete-vehicle-controller";

export const Route = createFileRoute("/completar-cadastro")({
  head: () => ({
    meta: [
      { title: "Completar cadastro – Portal GRF" },
      {
        name: "description",
        content: "Complete os dados e documentos de um veículo que já existe no cadastro mestre da GRF.",
      },
    ],
  }),
  component: CompleteVehicleController,
});
