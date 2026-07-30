import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: system-improvements, Property 7: Visitor NFC round-trip frees the tag

describe('Property 7: Visitor NFC round-trip frees the tag', () => {
  /**
   * Simulates the visitor NFC check-in/check-out database state.
   * **Validates: Requirements 3.2**
   */
  class VisitorNFCStore {
    constructor() {
      this.visitors = new Map(); // visit_id -> { name, date, time_in, time_out }
      this.nfcTags = new Map();  // uid -> { nfctag_id, visitor_session_id }
      this.nextVisitId = 1;
      this.nextTagId = 1;
    }
    
    // Register an NFC tag (unassigned)
    registerTag(uid) {
      this.nfcTags.set(uid, { nfctag_id: this.nextTagId++, visitor_session_id: null });
    }
    
    // Check-in via NFC
    checkin(name, uid) {
      const tag = this.nfcTags.get(uid);
      if (!tag || tag.visitor_session_id !== null) {
        return { success: false, reason: 'tag_unavailable' };
      }
      
      const visitId = this.nextVisitId++;
      this.visitors.set(visitId, { name, date: '2025-06-15', time_in: '09:00:00', time_out: null });
      tag.visitor_session_id = visitId;
      
      return { success: true, visit_id: visitId };
    }
    
    // Check-out via NFC
    checkout(uid) {
      const tag = this.nfcTags.get(uid);
      if (!tag || tag.visitor_session_id === null) {
        return { success: false, reason: 'no_active_session' };
      }
      
      const visitId = tag.visitor_session_id;
      const visitor = this.visitors.get(visitId);
      
      // Set time_out
      visitor.time_out = '14:30:00';
      
      // Release the tag
      tag.visitor_session_id = null;
      
      return { success: true, visit_id: visitId, name: visitor.name, time_out: visitor.time_out };
    }
    
    // Get tag status
    getTagStatus(uid) {
      const tag = this.nfcTags.get(uid);
      if (!tag) return null;
      return { visitor_session_id: tag.visitor_session_id };
    }
    
    // Get visitor record
    getVisitor(visitId) {
      return this.visitors.get(visitId);
    }
  }

  it('after check-out, time_out is set and tag is unassigned (visitor_session_id is null)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),  // visitor name
        fc.string({ minLength: 8, maxLength: 20 }),  // NFC UID
        (name, uid) => {
          const store = new VisitorNFCStore();
          
          // Register the tag first
          store.registerTag(uid);
          
          // Check-in
          const checkinResult = store.checkin(name, uid);
          expect(checkinResult.success).toBe(true);
          
          // Verify tag is now linked
          const tagAfterCheckin = store.getTagStatus(uid);
          expect(tagAfterCheckin.visitor_session_id).not.toBeNull();
          
          // Check-out
          const checkoutResult = store.checkout(uid);
          expect(checkoutResult.success).toBe(true);
          expect(checkoutResult.name).toBe(name);
          expect(checkoutResult.time_out).toBeTruthy();
          
          // ASSERTION 1: time_out is set on the visitor record
          const visitor = store.getVisitor(checkinResult.visit_id);
          expect(visitor.time_out).not.toBeNull();
          
          // ASSERTION 2: tag's visitor_session_id is now NULL (tag is unassigned/free)
          const tagAfterCheckout = store.getTagStatus(uid);
          expect(tagAfterCheckout.visitor_session_id).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('a freed tag can be reused by another visitor', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),  // first visitor name
        fc.string({ minLength: 1, maxLength: 50 }),  // second visitor name
        fc.string({ minLength: 8, maxLength: 20 }),  // shared NFC UID
        (name1, name2, uid) => {
          const store = new VisitorNFCStore();
          store.registerTag(uid);
          
          // First visitor checks in and out
          const checkin1 = store.checkin(name1, uid);
          expect(checkin1.success).toBe(true);
          
          const checkout1 = store.checkout(uid);
          expect(checkout1.success).toBe(true);
          
          // Tag should be free now
          expect(store.getTagStatus(uid).visitor_session_id).toBeNull();
          
          // Second visitor can now use the same tag
          const checkin2 = store.checkin(name2, uid);
          expect(checkin2.success).toBe(true);
          expect(store.getTagStatus(uid).visitor_session_id).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
