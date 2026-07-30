// Feature: realtime-anomaly-detection, Property 22: Bounded Event Queue
// **Validates: Requirements 10.5**

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { EventQueue } = require('../../src/queue/eventQueue.js');

describe('Property 22: Bounded Event Queue', () => {
  it('queue size never exceeds maxSize for any sequence of enqueues', () => {
    fc.assert(
      fc.property(
        // Generate a maxSize between 1 and 100
        fc.integer({ min: 1, max: 100 }),
        // Generate a sequence of events to enqueue
        fc.array(fc.anything(), { minLength: 1, maxLength: 200 }),
        (maxSize, events) => {
          const queue = new EventQueue(maxSize);

          for (const event of events) {
            queue.enqueue(event);
            // After every enqueue, size must not exceed maxSize
            expect(queue.size()).toBeLessThanOrEqual(maxSize);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('when full, enqueue discards the oldest item', () => {
    fc.assert(
      fc.property(
        // Generate a small maxSize for tractability
        fc.integer({ min: 1, max: 50 }),
        // Generate more events than maxSize to guarantee overflow
        fc.array(fc.integer(), { minLength: 2, maxLength: 100 }),
        (maxSize, events) => {
          const queue = new EventQueue(maxSize);

          // Enqueue all events
          for (const event of events) {
            queue.enqueue(event);
          }

          const contents = queue.dequeueAll();

          if (events.length > maxSize) {
            // Queue should contain only the last maxSize events
            const expectedEvents = events.slice(events.length - maxSize);
            expect(contents).toEqual(expectedEvents);
          } else {
            // Queue should contain all events in order
            expect(contents).toEqual(events);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('dequeueAll returns items in chronological (insertion) order', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.array(fc.integer(), { minLength: 1, maxLength: 150 }),
        (maxSize, events) => {
          const queue = new EventQueue(maxSize);

          for (const event of events) {
            queue.enqueue(event);
          }

          const dequeued = queue.dequeueAll();

          // Items should be in the same relative order as they were inserted
          // (only the last maxSize items are kept)
          const expectedSlice = events.slice(Math.max(0, events.length - maxSize));
          expect(dequeued).toEqual(expectedSlice);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('after dequeueAll, queue is empty', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.array(fc.anything(), { minLength: 0, maxLength: 100 }),
        (maxSize, events) => {
          const queue = new EventQueue(maxSize);

          for (const event of events) {
            queue.enqueue(event);
          }

          queue.dequeueAll();

          expect(queue.size()).toBe(0);
          expect(queue.isEmpty()).toBe(true);
          expect(queue.dequeueAll()).toEqual([]);
        }
      ),
      { numRuns: 200 }
    );
  });
});
