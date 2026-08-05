import { EventEmitter } from 'node:events';

/**
 * EventBus is a singleton that manages system-wide events.
 * It allows different packages (AgentCore, MissionControl, CRM) 
 * to communicate asynchronously without tight coupling.
 */
class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Publish an event to the system.
   * @param event The event name (e.g., 'job.completed')
   * @param payload The data associated with the event
   */
  publish(event: string, payload: any) {
    console.log(`[EventBus] Publishing: ${event}`, payload);
    this.emit(event, payload);
  }

  /**
   * Subscribe to a specific event.
   * @param event The event name to listen for
   * @param callback The function to execute when the event fires
   */
  subscribe(event: string, callback: (payload: any) => void) {
    this.on(event, callback);
  }
}

export const eventBus = EventBus.getInstance();
export type EventBusType = typeof eventBus;
