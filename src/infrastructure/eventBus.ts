import { DomainEvent } from "../domain/types";

export class EventBus {
  private readonly published: DomainEvent[] = [];

  publish(event: DomainEvent): void {
    this.published.push(event);
  }

  list(): DomainEvent[] {
    return [...this.published];
  }
}
