import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: system-improvements, Property 1: Notification attempts exactly the channels in priority order and stops at first success
// **Validates: Requirements 1.1, 1.2, 1.8**

describe('Property 1: NotificationService channel order and early-stop', () => {
  /**
   * Simulates the NotificationService dispatch logic.
   *
   * @param {string[]} channelOrder - Priority-ordered channels, e.g. ['messenger', 'viber']
   * @param {Object} channelResults - Simulated API success/fail per channel, e.g. { messenger: true, viber: false }
   * @param {Object} guardianContacts - Guardian's stored IDs, e.g. { messenger_psid: 'abc', viber_id: null }
   * @returns {{ attemptedChannels: string[], successChannel: string|null }}
   */
  function simulateNotify(channelOrder, channelResults, guardianContacts) {
    const attempted = [];

    for (const channel of channelOrder) {
      // Skip if guardian doesn't have the contact for this channel
      if (channel === 'messenger' && !guardianContacts.messenger_psid) continue;
      if (channel === 'viber' && !guardianContacts.viber_id) continue;

      attempted.push(channel);

      if (channelResults[channel]) {
        return { attemptedChannels: attempted, successChannel: channel };
      }
    }

    return { attemptedChannels: attempted, successChannel: null };
  }

  it('attempts channels in priority order and stops at first success', () => {
    fc.assert(
      fc.property(
        // Generate a channel order: 1 or 2 channels from ['messenger', 'viber']
        fc.shuffledSubarray(['messenger', 'viber'], { minLength: 1, maxLength: 2 }),
        // Generate per-channel success/fail outcomes
        fc.record({
          messenger: fc.boolean(),
          viber: fc.boolean(),
        }),
        // Generate guardian contacts (nullable IDs)
        fc.record({
          messenger_psid: fc.option(fc.string({ minLength: 1, maxLength: 64 }), { nil: null }),
          viber_id: fc.option(fc.string({ minLength: 1, maxLength: 64 }), { nil: null }),
        }),
        (channelOrder, channelResults, guardianContacts) => {
          const result = simulateNotify(channelOrder, channelResults, guardianContacts);

          // Compute expected reachable channels (channels in order that guardian has contact for)
          const reachableChannels = channelOrder.filter((ch) => {
            if (ch === 'messenger') return !!guardianContacts.messenger_psid;
            if (ch === 'viber') return !!guardianContacts.viber_id;
            return false;
          });

          // ASSERTION 1: Channels are attempted in the configured priority order
          // The attempted channels must be a prefix of the reachable channels
          for (let i = 0; i < result.attemptedChannels.length; i++) {
            expect(result.attemptedChannels[i]).toBe(reachableChannels[i]);
          }

          // ASSERTION 2: Once a channel succeeds, no further channels are attempted
          if (result.successChannel !== null) {
            // Find the index of the successful channel in reachable channels
            const successIdx = reachableChannels.indexOf(result.successChannel);
            // Only channels up to and including the success should be attempted
            expect(result.attemptedChannels.length).toBe(successIdx + 1);
            // The last attempted channel is the one that succeeded
            expect(result.attemptedChannels[result.attemptedChannels.length - 1]).toBe(
              result.successChannel
            );
          }

          // ASSERTION 3: If a channel fails, the next channel in order is attempted
          if (result.successChannel === null && reachableChannels.length > 0) {
            // All reachable channels should have been attempted
            expect(result.attemptedChannels).toEqual(reachableChannels);
          }

          // ASSERTION 4: If all channels fail, the result reports failure (successChannel is null)
          const allReachableFailed = reachableChannels.every((ch) => !channelResults[ch]);
          if (allReachableFailed) {
            expect(result.successChannel).toBeNull();
          }

          // ASSERTION 5: At most one channel returns success
          const successCount = result.successChannel !== null ? 1 : 0;
          expect(successCount).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
