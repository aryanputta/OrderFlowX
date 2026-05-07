import { EventBus } from "../infrastructure/eventBus";
import {
  ConsumerInboxRepository,
  EventOutboxRepository,
} from "../infrastructure/repositories";
import { DomainEvent } from "../domain/types";

export const flushOutbox = (
  outbox: EventOutboxRepository,
  eventBus: EventBus,
): void => {
  outbox.list().forEach((event) => eventBus.publish(event));
  outbox.clear();
};

export const consumeWithInbox = (
  event: DomainEvent,
  inbox: ConsumerInboxRepository,
  consumer: (event: DomainEvent) => void,
): boolean => {
  if (inbox.has(event.eventId)) {
    return false;
  }
  consumer(event);
  inbox.markProcessed(event.eventId);
  return true;
};
