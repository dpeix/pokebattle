/** Response body of a service's `GET /health` endpoint. */
export interface HealthResponse {
  status: "ok" | "error";
  service: string;
  database: "up" | "down";
}
