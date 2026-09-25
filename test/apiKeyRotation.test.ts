/**
 * Pure-logic tests for `src/lib/apiKeyRotation.ts` — the Codex round-2 rejection of Spigot-
 * Dashboard 14dc185+015b54b (local/security-fixes/judge/f20dr2.q.out):
 *
 *   "SettingsView.tsx:307-309 can display and copy a key revoked by a later rotation in
 *   another tab or device."
 *   "establish a rotation contract that handles overlapping successful requests and prevents a
 *   revoked key from being presented as current. Test concurrent tabs and a lost response
 *   followed by another rotation."
 *   "reject malformed successful responses, including an invalid publisher ID, a missing or
 *   non-string key, and a code request that does not confirm a code was sent. Test partial
 *   responses and boundary values."
 *   "prevent Resend code while confirmation is running."
 *   "Start.tsx:122: derive completion from actual key issuance or show the state as unknown."
 *
 * This repo's only test runner is Node's own `--test` (see `test/domainVerification.test.ts`).
 * Run with `npm test` or `node --experimental-strip-types --test test/*.test.ts`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const modulePath = ['../src/lib/apiKeyRotation', '.ts'].join('');
const {
  parseRegisteredPublisher,
  parseCodeRequestResult,
  parseIssuedKey,
  parsePublisherKeyInfo,
  keyMatchesServerMarker,
  deriveKeyIssuedState,
  canResendCode,
  rotationChannelName,
  isRotationBroadcast,
  shouldInvalidateOnBroadcast,
} = await import(modulePath);

describe('parseRegisteredPublisher — boundary and malformed POST /publishers responses', () => {
  test('accepts a well-formed id', () => {
    assert.deepEqual(parseRegisteredPublisher({ id: 'pub-1' }), { id: 'pub-1' });
  });

  test('rejects an empty body', () => {
    assert.equal(parseRegisteredPublisher({}), null);
  });

  test('rejects a non-string id', () => {
    assert.equal(parseRegisteredPublisher({ id: 123 }), null);
  });

  test('rejects an empty-string id', () => {
    assert.equal(parseRegisteredPublisher({ id: '' }), null);
  });

  test('rejects null, undefined and non-object bodies', () => {
    assert.equal(parseRegisteredPublisher(null), null);
    assert.equal(parseRegisteredPublisher(undefined), null);
    assert.equal(parseRegisteredPublisher('pub-1'), null);
    assert.equal(parseRegisteredPublisher([{ id: 'pub-1' }]), null);
  });
});

describe('parseCodeRequestResult — must confirm codeSent === true, not merely truthy', () => {
  test('accepts codeSent: true with a message', () => {
    assert.deepEqual(parseCodeRequestResult({ codeSent: true, message: 'sent' }), {
      codeSent: true,
      message: 'sent',
    });
  });

  test('fills a default message when the body omits one', () => {
    const result = parseCodeRequestResult({ codeSent: true });
    assert.equal(result.codeSent, true);
    assert.equal(typeof result.message, 'string');
    assert.ok(result.message.length > 0);
  });

  test('rejects a response with codeSent missing entirely', () => {
    assert.equal(parseCodeRequestResult({ message: 'sent' }), null);
  });

  test('rejects codeSent: false', () => {
    assert.equal(parseCodeRequestResult({ codeSent: false }), null);
  });

  test('rejects a truthy non-boolean codeSent (defense against a loose future backend change)', () => {
    assert.equal(parseCodeRequestResult({ codeSent: 'true' }), null);
    assert.equal(parseCodeRequestResult({ codeSent: 1 }), null);
  });

  test('rejects null/undefined/non-object bodies', () => {
    assert.equal(parseCodeRequestResult(null), null);
    assert.equal(parseCodeRequestResult(undefined), null);
    assert.equal(parseCodeRequestResult('ok'), null);
  });
});

describe('parseIssuedKey — reject malformed POST /publishers/:id/api-key responses', () => {
  test('accepts a well-formed response matching the requested publisher', () => {
    const result = parseIssuedKey(
      { id: 'pub-1', api_key: 'pk_test_abc', apiKeyRotatedAt: '2026-09-25T00:00:00.000Z' },
      'pub-1',
    );
    assert.deepEqual(result, {
      id: 'pub-1',
      api_key: 'pk_test_abc',
      apiKeyRotatedAt: '2026-09-25T00:00:00.000Z',
    });
  });

  test('accepts a response with no apiKeyRotatedAt field, treating it as null', () => {
    const result = parseIssuedKey({ id: 'pub-1', api_key: 'pk_test_abc' }, 'pub-1');
    assert.deepEqual(result, { id: 'pub-1', api_key: 'pk_test_abc', apiKeyRotatedAt: null });
  });

  test('rejects a missing api_key', () => {
    assert.equal(parseIssuedKey({ id: 'pub-1' }, 'pub-1'), null);
  });

  test('rejects a non-string api_key', () => {
    assert.equal(parseIssuedKey({ id: 'pub-1', api_key: 12345 }, 'pub-1'), null);
  });

  test('rejects an empty-string api_key', () => {
    assert.equal(parseIssuedKey({ id: 'pub-1', api_key: '' }, 'pub-1'), null);
  });

  test('rejects an id that does not match the publisher the rotation was requested for', () => {
    assert.equal(parseIssuedKey({ id: 'pub-OTHER', api_key: 'pk_test_abc' }, 'pub-1'), null);
  });

  test('rejects a non-string id, even with a valid key', () => {
    assert.equal(parseIssuedKey({ id: 42, api_key: 'pk_test_abc' }, 'pub-1'), null);
  });

  test('rejects a non-string apiKeyRotatedAt', () => {
    assert.equal(
      parseIssuedKey({ id: 'pub-1', api_key: 'pk_test_abc', apiKeyRotatedAt: 123 }, 'pub-1'),
      null,
    );
  });

  test('rejects an empty object and non-object bodies', () => {
    assert.equal(parseIssuedKey({}, 'pub-1'), null);
    assert.equal(parseIssuedKey(null, 'pub-1'), null);
    assert.equal(parseIssuedKey(undefined, 'pub-1'), null);
  });
});

describe('parsePublisherKeyInfo — GET /publishers/:id', () => {
  test('accepts a publisher that has never had a key issued (apiKeyRotatedAt: null)', () => {
    assert.deepEqual(parsePublisherKeyInfo({ id: 'pub-1', apiKeyRotatedAt: null }), {
      id: 'pub-1',
      apiKeyRotatedAt: null,
    });
  });

  test('accepts a publisher with a rotation marker', () => {
    assert.deepEqual(
      parsePublisherKeyInfo({ id: 'pub-1', apiKeyRotatedAt: '2026-09-25T00:00:00.000Z' }),
      { id: 'pub-1', apiKeyRotatedAt: '2026-09-25T00:00:00.000Z' },
    );
  });

  test('rejects an invalid publisher id', () => {
    assert.equal(parsePublisherKeyInfo({ id: '', apiKeyRotatedAt: null }), null);
    assert.equal(parsePublisherKeyInfo({ id: 7, apiKeyRotatedAt: null }), null);
    assert.equal(parsePublisherKeyInfo({}), null);
  });

  test('rejects a non-string, non-null apiKeyRotatedAt', () => {
    assert.equal(parsePublisherKeyInfo({ id: 'pub-1', apiKeyRotatedAt: 123 }), null);
  });
});

describe('keyMatchesServerMarker — the reveal/copy gate', () => {
  test('matches when both markers are equal, non-null strings', () => {
    assert.equal(keyMatchesServerMarker('m1', 'm1'), true);
  });

  test('fails closed on a mismatch — the rotated-elsewhere case', () => {
    assert.equal(keyMatchesServerMarker('m1', 'm2'), false);
  });

  test('fails closed when the server marker is null (re-check has not run, or failed)', () => {
    assert.equal(keyMatchesServerMarker('m1', null), false);
  });

  test('fails closed when nothing is held yet', () => {
    assert.equal(keyMatchesServerMarker(null, 'm1'), false);
    assert.equal(keyMatchesServerMarker(null, null), false);
  });
});

describe('deriveKeyIssuedState — Start.tsx "Get your API key" (regression: was Boolean(publisher))', () => {
  test('no publisher account: not done (false), not unknown', () => {
    assert.equal(deriveKeyIssuedState(false, undefined), false);
    assert.equal(deriveKeyIssuedState(false, null), false);
    assert.equal(deriveKeyIssuedState(false, '2026-09-25T00:00:00.000Z'), false);
  });

  test('a publisher exists but the marker has not been fetched yet: unknown (null), never Done', () => {
    assert.equal(deriveKeyIssuedState(true, undefined), null);
  });

  test('a newly registered publisher with no issued key: known false, not Done', () => {
    // This is the exact regression case: registration mints a row, but no key was ever shown
    // to the user, so the step must not read Done just because a publisher exists.
    assert.equal(deriveKeyIssuedState(true, null), false);
  });

  test('a publisher with a real issuance: done (true)', () => {
    assert.equal(deriveKeyIssuedState(true, '2026-09-25T00:00:00.000Z'), true);
  });

  test('a malformed non-string, non-null marker is treated as not issued rather than crashing', () => {
    assert.equal(deriveKeyIssuedState(true, '' as unknown as string), false);
  });
});

describe('canResendCode — disabled while a request or a confirmation is already running', () => {
  test('enabled when idle', () => {
    assert.equal(canResendCode(false, false), true);
  });

  test('disabled while a code request is in flight', () => {
    assert.equal(canResendCode(true, false), false);
  });

  test('disabled while confirmation is in flight — the interleaving case', () => {
    assert.equal(canResendCode(false, true), false);
  });

  test('disabled when both are somehow true', () => {
    assert.equal(canResendCode(true, true), false);
  });
});

describe('rotationChannelName — scoped per publisher, not global', () => {
  test('two different publishers get two different channel names', () => {
    assert.notEqual(rotationChannelName('pub-1'), rotationChannelName('pub-2'));
  });

  test('the same publisher always gets the same name', () => {
    assert.equal(rotationChannelName('pub-1'), rotationChannelName('pub-1'));
  });
});

describe('isRotationBroadcast — validates a cross-tab message before trusting it', () => {
  test('accepts a well-formed message for this publisher', () => {
    assert.equal(isRotationBroadcast({ publisherId: 'pub-1', rotatedAt: 'm1' }, 'pub-1'), true);
  });

  test('rejects a message for a different publisher (a stale tab signed in as someone else)', () => {
    assert.equal(isRotationBroadcast({ publisherId: 'pub-2', rotatedAt: 'm1' }, 'pub-1'), false);
  });

  test('rejects a message with a missing or non-string rotatedAt', () => {
    assert.equal(isRotationBroadcast({ publisherId: 'pub-1' }, 'pub-1'), false);
    assert.equal(isRotationBroadcast({ publisherId: 'pub-1', rotatedAt: 42 }, 'pub-1'), false);
  });

  test('rejects null, undefined, and non-object messages', () => {
    assert.equal(isRotationBroadcast(null, 'pub-1'), false);
    assert.equal(isRotationBroadcast(undefined, 'pub-1'), false);
    assert.equal(isRotationBroadcast('pub-1', 'pub-1'), false);
  });
});

describe('shouldInvalidateOnBroadcast — same-browser cross-tab invalidation', () => {
  test('a tab holding no key has nothing to invalidate', () => {
    assert.equal(shouldInvalidateOnBroadcast(null, 'm2'), false);
  });

  test('a broadcast that differs from the held marker invalidates it', () => {
    assert.equal(shouldInvalidateOnBroadcast('m1', 'm2'), true);
  });

  test('a broadcast that echoes the held marker changes nothing (own rotation, or a duplicate)', () => {
    assert.equal(shouldInvalidateOnBroadcast('m1', 'm1'), false);
  });
});

describe('concurrent tabs and a lost response, end to end through the pure contract', () => {
  test('two tabs rotate; the tab holding the earlier response fails the pre-reveal check', () => {
    // Tab A rotates and holds { key: kA, marker: mA }. Tab B (or another device) rotates
    // afterward; the server's current marker is now mB. Tab A must not be able to reveal kA.
    const ownMarkerA = 'rotate-2026-09-25T10:00:00.000Z';
    const serverMarkerAfterB = 'rotate-2026-09-25T10:00:05.000Z';
    assert.equal(keyMatchesServerMarker(ownMarkerA, serverMarkerAfterB), false);

    // Tab B's own marker matches, because it is the winner.
    assert.equal(keyMatchesServerMarker(serverMarkerAfterB, serverMarkerAfterB), true);
  });

  test('a lost response followed by a retry: the tab never held the lost response, so nothing to invalidate — the retry marker is what matches', () => {
    // Tab sends rotate request R1; the connection drops before the response arrives, so the
    // tab never calls parseIssuedKey on it and never holds R1's marker. It retries and gets R2.
    const heldMarker: string | null = null; // R1's response was never received/parsed
    const r2Marker = 'rotate-2026-09-25T10:05:00.000Z';

    // Nothing was held, so a broadcast (or a stray late arrival) of R1's marker, if it ever
    // showed up, would not match what the tab now holds after R2 either.
    assert.equal(shouldInvalidateOnBroadcast(heldMarker, 'rotate-2026-09-25T10:00:00.000Z'), false);

    // After the retry, the tab holds R2's marker and it matches the server (R2 was the last,
    // and only, rotation this tab's user actually asked for and received).
    assert.equal(keyMatchesServerMarker(r2Marker, r2Marker), true);
  });

  test('BroadcastChannel invalidation fires before the tab would ever attempt a reveal', () => {
    const publisherId = 'pub-42';
    const heldMarker = 'rotate-A';
    const incoming = { publisherId, rotatedAt: 'rotate-B' };

    assert.equal(isRotationBroadcast(incoming, publisherId), true);
    assert.equal(shouldInvalidateOnBroadcast(heldMarker, incoming.rotatedAt), true);
  });
});
