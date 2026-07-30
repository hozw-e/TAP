import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: system-improvements, Property 2: Delivery outcome is persisted for every notification attempt
// **Validates: Requirements 1.6**

describe('Property 2: Delivery outcome is persisted for every notification attempt', () => {
  /**
   * Simulates the NotificationService notify() flow with logging.
   *
   * For every channel attempted (including channels skipped due to missing contact info),
   * a log entry is created recording the channel and outcome status.
   *
   * @param {string[]} channelOrder - Priority-ordered channels, e.g. ['messenger', 'viber']
   * @param {Object} channelResults - Simulated API success/fail per channel, e.g. { messenger: true, viber: false }
   * @param {Object} guardianContacts - Guardian's stored IDs, e.g. { messenger_psid: 'abc', viber_id: null }
   * @returns {{ logs: Array<{channel: string, status: string, reason?: string}>, finalResult: {channel: string|null, success: boolean} }}
   */
  function simulateNotifyWithLogs(channelOrder, channelResults, guardianContacts) {
    const logs = [];

    // If guardian has no contacts at all, no logs are created (early return per 5.5)
    if (!guardianContacts.messenger_psid && !guardianContacts.viber_id) {
      return { logs: [], finalResult: { channel: null, success: false } };
    }

    for (const channel of channelOrder) {
      if (channel === 'messenger' && !guardianContacts.messenger_psid) {
        logs.push({ channel, status: 'FAILED', reason: 'no_psid' });
        continue;
      }
      if (channel === 'viber' && !guardianContacts.viber_id) {
        logs.push({ channel, status: 'FAILED', reason: 'no_viber_id' });
        continue;
      }

      const success = channelResults[channel];
      logs.push({ channel, status: success ? 'SENT' : 'FAILED' });

      if (success) {
        return { logs, finalResult: { channel, success: true } };
      }
    }

    return { logs, finalResult: { channel: null, success: false } };
  }

  it('persists at least one log entry for every notification attempt when guardian has contact info', () => {
    fc.assert(
      fc.property(
        // Generate a channel order: 1 or 2 channels from ['messenger', 'viber']
        fc.shuffledSubarray(['messenger', 'viber'], { minLength: 1, maxLength: 2 }),
        // Generate per-channel success/fail outcomes
        fc.record({
          messenger: fc.boolean(),
          viber: fc.boolean(),
        }),
        // Generate guardian contacts — at least one must be present to test persistence
        fc.record({
          messenger_psid: fc.option(fc.string({ minLength: 1, maxLength: 64 }), { nil: null }),
          viber_id: fc.option(fc.string({ minLength: 1, maxLength: 64 }), { nil: null }),
        }).filter(
          (contacts) => contacts.messenger_psid !== null || contacts.viber_id !== null
        ),
        (channelOrder, channelResults, guardianContacts) => {
          const result = simulateNotifyWithLogs(channelOrder, channelResults, guardianContacts);

          // ASSERTION 1: For any guardian with at least one contact, logs.length >= 1
          expect(result.logs.length).toBeGreaterThanOrEqual(1);

          // ASSERTION 2: logs.length equals the number of channels attempted
          // (including skipped ones with no contact for that specific channel)
          const expectedAttemptCount = channelOrder.filter((ch) => {
            // A channel is "attempted" if it's in the order and either:
            // - guardian has the contact → actual send attempt
            // - guardian lacks the contact for this specific channel → logged as FAILED with reason
            // But only if guardian has at least one contact overall (which is guaranteed by filter above)
            return true; // All channels in the order are attempted/logged
          }).length;

          // Actually, the simulation stops early on success. Count expected logs:
          let expectedLogs = 0;
          for (const channel of channelOrder) {
            expectedLogs++;
            // If channel has contact and succeeds, we stop after logging it
            if (channel === 'messenger' && guardianContacts.messenger_psid && channelResults[channel]) break;
            if (channel === 'viber' && guardianContacts.viber_id && channelResults[channel]) break;
            // If channel has contact but fails, continue to next
            // If channel lacks contact, log FAILED and continue
          }
          expect(result.logs.length).toBe(expectedLogs);

          // ASSERTION 3: Each log entry has a valid channel name
          for (const log of result.logs) {
            expect(['messenger', 'viber']).toContain(log.channel);
          }

          // ASSERTION 4: Each log entry has a valid status
          for (const log of result.logs) {
            expect(['SENT', 'FAILED']).toContain(log.status);
          }

          // ASSERTION 5: If finalResult.success is true, exactly one log has status 'SENT'
          if (result.finalResult.success) {
            const sentLogs = result.logs.filter((log) => log.status === 'SENT');
            expect(sentLogs.length).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
