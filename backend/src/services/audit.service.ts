import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

export interface AuditInput {
  actorId?: string | null;
  action: string; // dotted verb, e.g. "user.role.change"
  entityType: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
  ip?: string | null;
}

// Records a privileged action. Never throws: a failed audit write
// is logged, but it must not undo the action it describes.
export async function recordAudit(event: AuditInput) {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: event.actorId ?? null,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        meta: event.meta,
        ip: event.ip ?? null,
      },
    });
  } catch (error) {
    console.error("Audit write failed:", event.action, error);
  }
}

export async function getAuditEvents(options: {
  limit: number;
  cursor?: string;
  action?: string;
}) {
  const rows = await prisma.auditEvent.findMany({
    where: options.action
      ? { action: { startsWith: options.action } }
      : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: options.limit + 1,
    ...(options.cursor
      ? { cursor: { id: options.cursor }, skip: 1 }
      : {}),
    include: {
      actor: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  const hasMore = rows.length > options.limit;
  const events = hasMore ? rows.slice(0, options.limit) : rows;

  return {
    events,
    nextCursor: hasMore ? events[events.length - 1].id : null,
  };
}
