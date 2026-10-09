import { STATUS_CODES } from "node:http";
import type { FastifyReply } from "fastify";

/** Replies an error in the format Fastify uses for its own errors. */
export function sendError(
  reply: FastifyReply,
  statusCode: number,
  message: string,
  details: Record<string, unknown> = {},
): FastifyReply {
  return reply.code(statusCode).send({
    statusCode,
    error: STATUS_CODES[statusCode] ?? "Error",
    message,
    ...details,
  });
}
