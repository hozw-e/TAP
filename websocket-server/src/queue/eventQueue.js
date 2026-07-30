/**
 * Bounded FIFO event queue for buffering attendance events
 * when the anomaly engine is unavailable (circuit breaker open).
 *
 * Max capacity: 500 events (configurable).
 * Overflow policy: discard oldest event when full.
 */
class EventQueue {
  /**
   * @param {number} maxSize - Maximum queue capacity (default 500)
   */
  constructor(maxSize = 500) {
    this.queue = [];
    this.maxSize = maxSize;
  }

  /**
   * Add an event to the queue. If at capacity, discards the oldest event.
   * @param {object} event - The attendance event to enqueue
   */
  enqueue(event) {
    if (this.queue.length >= this.maxSize) {
      this.queue.shift(); // discard oldest
    }
    this.queue.push(event);
  }

  /**
   * Remove and return all events from the queue in FIFO order.
   * @returns {Array} All queued events
   */
  dequeueAll() {
    const events = [...this.queue];
    this.queue = [];
    return events;
  }

  /**
   * Peek at the current queue contents without removing.
   * @returns {Array} Copy of all queued events
   */
  peek() {
    return [...this.queue];
  }

  /**
   * Get current queue size.
   * @returns {number}
   */
  size() {
    return this.queue.length;
  }

  /**
   * Check if the queue is empty.
   * @returns {boolean}
   */
  isEmpty() {
    return this.queue.length === 0;
  }
}

module.exports = { EventQueue };
