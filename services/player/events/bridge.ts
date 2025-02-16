import {
  PlayerEventType,
  PlayerEventHandler,
  PlayerEvents,
  EventSubscription,
  PlayerEventEmitter,
} from '../types/events';
import type {SetupEvents} from '../types/setup';
import type {PlayerError} from '../types/errors';

type EventListener = (...args: any[]) => void;

/**
 * Basic EventEmitter implementation for React Native
 */
class EventEmitter {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private maxListeners = 10;

  setMaxListeners(n: number): void {
    this.maxListeners = n;
  }

  emit(event: string, ...args: any[]): boolean {
    const listeners = this.listeners.get(event);
    if (!listeners) return false;

    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
    return true;
  }

  on(event: string, listener: EventListener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const listeners = this.listeners.get(event)!;

    if (listeners.size >= this.maxListeners) {
      console.warn(
        'MaxListenersExceededWarning: Possible EventEmitter memory leak detected. ' +
          `${listeners.size} ${event} listeners added. ` +
          'Use emitter.setMaxListeners() to increase limit',
      );
    }

    listeners.add(listener);
    return this;
  }

  once(event: string, listener: EventListener): this {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    return this.on(event, onceWrapper);
  }

  off(event: string, listener: EventListener): this {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }
    return this;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
}

/**
 * Implementation of the event emitter for the player system
 */
class PlayerEventEmitterImpl implements PlayerEventEmitter {
  private handlers: Map<
    PlayerEventType,
    Set<PlayerEventHandler<PlayerEventType>>
  > = new Map();

  /**
   * Subscribe to a specific event type
   * @param type Event type to subscribe to
   * @param handler Handler function for the event
   * @returns Subscription handle
   */
  subscribe<T extends PlayerEventType>(
    type: T,
    handler: PlayerEventHandler<T>,
  ): EventSubscription {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    const handlers = this.handlers.get(type)!;
    handlers.add(handler as PlayerEventHandler<PlayerEventType>);

    return {
      unsubscribe: () => {
        handlers.delete(handler as PlayerEventHandler<PlayerEventType>);
        if (handlers.size === 0) {
          this.handlers.delete(type);
        }
      },
    };
  }

  /**
   * Emit an event
   * @param type Event type to emit
   * @param event Event data
   */
  emit<T extends PlayerEventType>(type: T, event: PlayerEvents[T]): void {
    const handlers = this.handlers.get(type);
    if (!handlers) return;

    // Add timestamp if not present
    const eventWithTimestamp = {
      ...event,
      timestamp: event.timestamp || Date.now(),
    };

    // Execute handlers asynchronously
    handlers.forEach(handler => {
      Promise.resolve().then(() => handler(eventWithTimestamp));
    });
  }

  /**
   * Remove all event handlers
   */
  clear(): void {
    this.handlers.clear();
  }
}

/**
 * Singleton instance of the event emitter
 */
export const playerEventEmitter = new PlayerEventEmitterImpl();

/**
 * Hook to subscribe to player events
 * @param handlers Map of event handlers
 * @returns Function to unsubscribe all handlers
 */
export function usePlayerEvents(handlers: {
  [K in PlayerEventType]?: PlayerEventHandler<K>;
}): () => void {
  const subscriptions: EventSubscription[] = [];

  // Subscribe to each handler
  Object.entries(handlers).forEach(([type, handler]) => {
    if (handler) {
      subscriptions.push(
        playerEventEmitter.subscribe(
          type as PlayerEventType,
          handler as PlayerEventHandler<PlayerEventType>,
        ),
      );
    }
  });

  // Return cleanup function
  return () => {
    subscriptions.forEach(sub => sub.unsubscribe());
  };
}

/**
 * Helper to emit player events with proper typing
 * @param type Event type
 * @param data Event data
 */
export function emitPlayerEvent<T extends PlayerEventType>(
  type: T,
  data: Omit<PlayerEvents[T], 'timestamp' | 'type'>,
): void {
  playerEventEmitter.emit(type, {
    ...data,
    timestamp: Date.now(),
    type,
  } as PlayerEvents[T]);
}
export {PlayerEventType};

/**
 * Event bridge for player setup and initialization events.
 * Extends EventEmitter to provide type-safe event handling.
 * @class SetupEventBridge
 * @extends EventEmitter
 */
class SetupEventBridge extends EventEmitter {
  /**
   * Emits an event with type-safe parameters.
   * @template {keyof SetupEvents} K - The event name
   * @param {K} event - The event to emit
   * @param {...Parameters<SetupEvents[K]>} args - The event arguments
   * @returns {boolean} - Whether the event had listeners
   */
  emit<K extends keyof SetupEvents>(
    event: K,
    ...args: Parameters<SetupEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Registers an event listener with type-safe callback.
   * @template {keyof SetupEvents} K - The event name
   * @param {K} event - The event to listen for
   * @param {SetupEvents[K]} listener - The event callback
   * @returns {this} - The event emitter instance
   */
  on<K extends keyof SetupEvents>(event: K, listener: SetupEvents[K]): this {
    return super.on(event, listener);
  }

  /**
   * Registers a one-time event listener with type-safe callback.
   * @template {keyof SetupEvents} K - The event name
   * @param {K} event - The event to listen for
   * @param {SetupEvents[K]} listener - The event callback
   * @returns {this} - The event emitter instance
   */
  once<K extends keyof SetupEvents>(event: K, listener: SetupEvents[K]): this {
    return super.once(event, listener);
  }

  /**
   * Removes an event listener with type-safe callback.
   * @template {keyof SetupEvents} K - The event name
   * @param {K} event - The event to remove listener from
   * @param {SetupEvents[K]} listener - The event callback to remove
   * @returns {this} - The event emitter instance
   */
  off<K extends keyof SetupEvents>(event: K, listener: SetupEvents[K]): this {
    return super.off(event, listener);
  }
}

/**
 * Singleton instance of the setup event bridge.
 * Use this to emit and listen for setup-related events.
 */
export const setupEventBridge = new SetupEventBridge();
setupEventBridge.setMaxListeners(20); // Set a higher limit for setup events
