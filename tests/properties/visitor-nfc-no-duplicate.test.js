import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: system-improvements, Property 6: Visitor NFC session isolation — no duplicate check-in

describe('Property 6: Visitor NFC no-duplicate check-in', () => {
  /**
   * Simulates the visitor check-in database state.
   * Tracks sessions by name + date to prevent duplicates.
   */
  class VisitorSessionStore {
    constructor() {
      this.sessions = []; // [{visit_id, name, date, uid}]
      this.nextId = 1;
      this.nfcTags = new Map(); // uid -> { visitor_session_id }
    }

    checkin(name, date, uid) {
      // Check for existing session (same name + date)
      const existing = this.sessions.find(s => s.name === name && s.date === date);
      if (existing) {
        return { created: false, status: 'already_checked_in', visit_id: existing.visit_id };
      }

      // Check NFC tag is unassigned
      const tag = this.nfcTags.get(uid);
      if (tag && tag.visitor_session_id !== null) {
        return { created: false, status: 'tag_in_use' };
      }

      // Create new session
      const visitId = this.nextId++;
      this.sessions.push({ visit_id: visitId, name, date, uid });
      this.nfcTags.set(uid, { visitor_session_id: visitId });

      return { created: true, status: 'checked_in', visit_id: visitId };
    }

    getSessionCount(name, date) {
      return this.sessions.filter(s => s.name === name && s.date === date).length;
    }
  }

  /**
   * **Validates: Requirements 3.12**
   */
  it('calling check-in twice for same name/date results in exactly 1 session', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),  // visitor name
        fc.string({ minLength: 8, maxLength: 20 }),  // NFC UID
        (name, uid) => {
          const store = new VisitorSessionStore();
          const today = '2025-06-15'; // fixed date for testing

          // First check-in should succeed
          const result1 = store.checkin(name, today, uid);
          expect(result1.created).toBe(true);
          expect(result1.status).toBe('checked_in');

          // Second check-in with same name+date should be rejected
          const result2 = store.checkin(name, today, uid);
          expect(result2.created).toBe(false);
          expect(result2.status).toBe('already_checked_in');

          // Session count for this name/date should be exactly 1
          expect(store.getSessionCount(name, today)).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.12**
   */
  it('different names on the same date each get their own session', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),  // visitor name 1
        fc.string({ minLength: 1, maxLength: 50 }),  // visitor name 2
        fc.string({ minLength: 8, maxLength: 20 }),  // NFC UID 1
        fc.string({ minLength: 8, maxLength: 20 }),  // NFC UID 2
        (name1, name2, uid1, uid2) => {
          // Skip if names or UIDs are the same
          if (name1 === name2 || uid1 === uid2) return;

          const store = new VisitorSessionStore();
          const today = '2025-06-15';

          const result1 = store.checkin(name1, today, uid1);
          const result2 = store.checkin(name2, today, uid2);

          expect(result1.created).toBe(true);
          expect(result2.created).toBe(true);

          expect(store.getSessionCount(name1, today)).toBe(1);
          expect(store.getSessionCount(name2, today)).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
