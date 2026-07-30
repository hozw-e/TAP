import { describe, it, expect, beforeEach } from 'vitest';

describe('queue/eventQueue', () => {
  let EventQueue;

  beforeEach(async () => {
    const mod = await import('../src/queue/eventQueue.js');
    EventQueue = mod.EventQueue;
  });

  it('starts empty', () => {
    const queue = new EventQueue();
    expect(queue.size()).toBe(0);
    expect(queue.isEmpty()).toBe(true);
  });

  it('enqueues events and tracks size', () => {
    const queue = new EventQueue();
    queue.enqueue({ student_id: 1 });
    queue.enqueue({ student_id: 2 });
    expect(queue.size()).toBe(2);
    expect(queue.isEmpty()).toBe(false);
  });

  it('dequeueAll returns events in FIFO order and empties the queue', () => {
    const queue = new EventQueue();
    queue.enqueue({ student_id: 1 });
    queue.enqueue({ student_id: 2 });
    queue.enqueue({ student_id: 3 });

    const events = queue.dequeueAll();
    expect(events).toHaveLength(3);
    expect(events[0].student_id).toBe(1);
    expect(events[1].student_id).toBe(2);
    expect(events[2].student_id).toBe(3);
    expect(queue.size()).toBe(0);
    expect(queue.isEmpty()).toBe(true);
  });

  it('discards oldest when at max capacity', () => {
    const queue = new EventQueue(3);
    queue.enqueue({ id: 1 });
    queue.enqueue({ id: 2 });
    queue.enqueue({ id: 3 });
    // Queue is full, this should discard id:1
    queue.enqueue({ id: 4 });

    expect(queue.size()).toBe(3);
    const events = queue.dequeueAll();
    expect(events[0].id).toBe(2);
    expect(events[1].id).toBe(3);
    expect(events[2].id).toBe(4);
  });

  it('respects default max size of 500', () => {
    const queue = new EventQueue();
    for (let i = 0; i < 510; i++) {
      queue.enqueue({ id: i });
    }
    expect(queue.size()).toBe(500);

    const events = queue.dequeueAll();
    // Oldest 10 should be discarded
    expect(events[0].id).toBe(10);
    expect(events[499].id).toBe(509);
  });

  it('peek returns events without modifying the queue', () => {
    const queue = new EventQueue();
    queue.enqueue({ student_id: 1 });
    queue.enqueue({ student_id: 2 });

    const peeked = queue.peek();
    expect(peeked).toHaveLength(2);
    expect(queue.size()).toBe(2); // Queue unchanged
  });

  it('dequeueAll on empty queue returns empty array', () => {
    const queue = new EventQueue();
    const events = queue.dequeueAll();
    expect(events).toEqual([]);
  });

  it('maintains chronological order after overflow', () => {
    const queue = new EventQueue(2);
    queue.enqueue({ ts: '2024-01-01T01:00:00Z' });
    queue.enqueue({ ts: '2024-01-01T02:00:00Z' });
    queue.enqueue({ ts: '2024-01-01T03:00:00Z' });

    const events = queue.dequeueAll();
    expect(events[0].ts).toBe('2024-01-01T02:00:00Z');
    expect(events[1].ts).toBe('2024-01-01T03:00:00Z');
  });
});
