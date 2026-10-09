/** Response body of a service's `GET /health` endpoint. */
export interface HealthResponse {
  status: "ok";
  service: string;
}
