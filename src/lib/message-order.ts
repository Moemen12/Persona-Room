export interface OrderedMessage {
  id: string;
  createdAt: string;
}

function compareMessages(left: OrderedMessage, right: OrderedMessage): number {
  const leftTimestamp = Date.parse(left.createdAt);
  const rightTimestamp = Date.parse(right.createdAt);

  if (Number.isFinite(leftTimestamp) && Number.isFinite(rightTimestamp) && leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }

  if (Number.isFinite(leftTimestamp) !== Number.isFinite(rightTimestamp)) {
    return Number.isFinite(leftTimestamp) ? -1 : 1;
  }

  const leftId = Number(left.id);
  const rightId = Number(right.id);

  if (Number.isFinite(leftId) && Number.isFinite(rightId) && leftId !== rightId) {
    return leftId - rightId;
  }

  return left.id.localeCompare(right.id, undefined, { numeric: true });
}

/** Returns a new array ordered oldest-to-newest with an id tie-breaker. */
export function sortRoomMessages<T extends OrderedMessage>(messages: readonly T[]): T[] {
  return [...messages].sort(compareMessages);
}
