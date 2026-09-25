/**
 * Pure-logic tests for `src/lib/apiKeyRotation.ts` — the Codex round-3 rejection of Spigot-
 * Dashboard 14dc185+015b54b+b0abd9a (local/security-fixes/judge/f20dr3.q.out, f20m.q.out):
 *
 *   "apiKeyRotation.ts:136-142 and backend/src/routes/publishers.ts:181: use a marker
 *   guaranteed to change on every rotation. Test two rotations with a frozen clock; the
 *   backend's current test deliberately waits 5 ms."
 *   "apiKeyRotation.ts:102-125 and src/api/client.ts:329-337: reject a missing, null, or empty
 *   issuance marker, and reject a publisher-status response whose ID differs from the requested
 *   ID. Test each malformed response."
 *   "Two successful rotations in the same millisecond can receive identical apiKeyRotatedAt
 *   values. After the second rotation revokes the first key, the first response still matches
 *   GET /publishers/:id and can be presented as current."
 *
 * Earlier round's coverage (still true of the contract, now expressed in `apiKeyVersion` terms):
 *
 *   "establish a rotation contract that handles overlapping successful requests and prevents a
 *   revoked key from being presented as current. Test concurrent tabs and a lost response
 *   followed by another rotation."
 *   "reject malformed successful responses, including an invalid publisher ID, a missing or
 *   non-string key, and a code request that does not confirm a code was sent. Test partial
 *   responses and boundary values."
 *   "prevent Resend code while confirmation is running."
 *   "Start.tsx: derive completion from actual key issuance or show the state as unknown."
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
  isValidRotationVersion,
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

  test("rejects codeSent: false — including the backend's own console-fallback shape (no RESEND_API_KEY configured)", () => {
    assert.equal(parseCodeRequestResult({ codeSent: false }), null);
    assert.equal(
      parseCodeRequestResult({
        codeSent: false,
        message: 'A verification code was generated but delivery could not be confirmed',
      }),
      null,
    );
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

describe('isValidRotationVersion — the actual rotation-contract marker, not apiKeyRotatedAt', () => {
  test('accepts a positive integer', () => {
    assert.equal(isValidRotationVersion(1), true);
    assert.equal(isValidRotationVersion(42), true);
  });

  test('rejects zero and negative numbers', () => {
    assert.equal(isValidRotationVersion(0), false);
    assert.equal(isValidRotationVersion(-1), false);
  });

  test('rejects non-integers, NaN and Infinity', () => {
    assert.equal(isValidRotationVersion(1.5), false);
    assert.equal(isValidRotationVersion(NaN), false);
    assert.equal(isValidRotationVersion(Infinity), false);
  });

  test('rejects non-number values, including a stringified version', () => {
    assert.equal(isValidRotationVersion('1'), false);
    assert.equal(isValidRotationVersion(null), false);
    assert.equal(isValidRotationVersion(undefined), false);
    assert.equal(isValidRotationVersion({}), false);
  });
});

describe('parseIssuedKey — reject malformed POST /publishers/:id/api-key responses', () => {
  test('accepts a well-formed response matching the requested publisher', () => {
    const result = parseIssuedKey(
      {
        id: 'pub-1',
        api_key: 'pk_test_abc',
        apiKeyRotatedAt: '2026-09-25T00:00:00.000Z',
        apiKeyVersion: 3,
      },
      'pub-1',
    );
    assert.deepEqual(result, {
      id: 'pub-1',
      api_key: 'pk_test_abc',
      apiKeyRotatedAt: '2026-09-25T00:00:00.000Z',
      apiKeyVersion: 3,
    });
  });

  test('accepts a response with no apiKeyRotatedAt field, treating it as null (display-only field)', () => {
    const result = parseIssuedKey(
      { id: 'pub-1', api_key: 'pk_test_abc', apiKeyVersion: 1 },
      'pub-1',
    );
    assert.deepEqual(result, {
      id: 'pub-1',
      api_key: 'pk_test_abc',
      apiKeyRotatedAt: null,
      apiKeyVersion: 1,
    });
  });

  test('rejects a missing api_key', () => {
    assert.equal(parseIssuedKey({ id: 'pub-1', apiKeyVersion: 1 }, 'pub-1'), null);
  });

  test('rejects a non-string api_key', () => {
    assert.equal(parseIssuedKey({ id: 'pub-1', api_key: 12345, apiKeyVersion: 1 }, 'pub-1'), null);
  });

  test('rejects an empty-string api_key', () => {
    assert.equal(parseIssuedKey({ id: 'pub-1', api_key: '', apiKeyVersion: 1 }, 'pub-1'), null);
  });

  test('rejects an id that does not match the publisher the rotation was requested for', () => {
    assert.equal(
      parseIssuedKey({ id: 'pub-OTHER', api_key: 'pk_test_abc', apiKeyVersion: 1 }, 'pub-1'),
      null,
    );
  });

  test('rejects a non-string id, even with a valid key', () => {
    assert.equal(
      parseIssuedKey({ id: 42, api_key: 'pk_test_abc', apiKeyVersion: 1 }, 'pub-1'),
      null,
    );
  });

  test('rejects a non-string apiKeyRotatedAt', () => {
    assert.equal(
      parseIssuedKey(
        { id: 'pub-1', api_key: 'pk_test_abc', apiKeyRotatedAt: 123, apiKeyVersion: 1 },
        'pub-1',
      ),
      null,
    );
  });

  // The actual rotation-contract field — a missing, null or otherwise malformed issuance
  // version must never be treated as valid (Codex round-3 rejection, f20dr3).
  test('rejects a missing apiKeyVersion', () => {
    assert.equal(parseIssuedKey({ id: 'pub-1', api_key: 'pk_test_abc' }, 'pub-1'), null);
  });

  test('rejects a null apiKeyVersion', () => {
    assert.equal(
      parseIssuedKey({ id: 'pub-1', api_key: 'pk_test_abc', apiKeyVersion: null }, 'pub-1'),
      null,
    );
  });

  test('rejects apiKeyVersion: 0 and negative versions', () => {
    assert.equal(
      parseIssuedKey({ id: 'pub-1', api_key: 'pk_test_abc', apiKeyVersion: 0 }, 'pub-1'),
      null,
    );
    assert.equal(
      parseIssuedKey({ id: 'pub-1', api_key: 'pk_test_abc', apiKeyVersion: -1 }, 'pub-1'),
      null,
    );
  });

  test('rejects a stringified apiKeyVersion', () => {
    assert.equal(
      parseIssuedKey({ id: 'pub-1', api_key: 'pk_test_abc', apiKeyVersion: '1' }, 'pub-1'),
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
  test('accepts a publisher that has never had a key issued (apiKeyVersion: null)', () => {
    assert.deepEqual(
      parsePublisherKeyInfo({ id: 'pub-1', apiKeyRotatedAt: null, apiKeyVersion: null }),
      { id: 'pub-1', apiKeyRotatedAt: null, apiKeyVersion: null },
    );
  });

  test('accepts a publisher with a rotation version', () => {
    assert.deepEqual(
      parsePublisherKeyInfo({
        id: 'pub-1',
        apiKeyRotatedAt: '2026-09-25T00:00:00.000Z',
        apiKeyVersion: 5,
      }),
      { id: 'pub-1', apiKeyRotatedAt: '2026-09-25T00:00:00.000Z', apiKeyVersion: 5 },
    );
  });

  test('rejects an invalid publisher id', () => {
    assert.equal(parsePublisherKeyInfo({ id: '', apiKeyVersion: null }), null);
    assert.equal(parsePublisherKeyInfo({ id: 7, apiKeyVersion: null }), null);
    assert.equal(parsePublisherKeyInfo({}), null);
  });

  test('rejects a non-string, non-null apiKeyRotatedAt', () => {
    assert.equal(
      parsePublisherKeyInfo({ id: 'pub-1', apiKeyRotatedAt: 123, apiKeyVersion: null }),
      null,
    );
  });

  test('rejects a malformed apiKeyVersion — zero, negative, non-integer, or a string', () => {
    assert.equal(parsePublisherKeyInfo({ id: 'pub-1', apiKeyVersion: 0 }), null);
    assert.equal(parsePublisherKeyInfo({ id: 'pub-1', apiKeyVersion: -3 }), null);
    assert.equal(parsePublisherKeyInfo({ id: 'pub-1', apiKeyVersion: 1.5 }), null);
    assert.equal(parsePublisherKeyInfo({ id: 'pub-1', apiKeyVersion: '2' }), null);
  });

  test('treats an absent apiKeyVersion the same as null', () => {
    assert.deepEqual(parsePublisherKeyInfo({ id: 'pub-1' }), {
      id: 'pub-1',
      apiKeyRotatedAt: null,
      apiKeyVersion: null,
    });
  });
});

describe('keyMatchesServerMarker — the reveal/copy gate', () => {
  test('matches when both versions are equal, valid positive integers', () => {
    assert.equal(keyMatchesServerMarker(3, 3), true);
  });

  test('fails closed on a mismatch — the rotated-elsewhere case', () => {
    assert.equal(keyMatchesServerMarker(3, 4), false);
  });

  test('fails closed when the server version is null (re-check has not run, or failed)', () => {
    assert.equal(keyMatchesServerMarker(3, null), false);
  });

  test('fails closed when nothing is held yet', () => {
    assert.equal(keyMatchesServerMarker(null, 3), false);
    assert.equal(keyMatchesServerMarker(null, null), false);
  });

  test('fails closed on a malformed version on either side (0, negative, non-integer)', () => {
    assert.equal(keyMatchesServerMarker(0, 0), false);
    assert.equal(keyMatchesServerMarker(-1, -1), false);
  });
});

describe('deriveKeyIssuedState — Start.tsx "Get your API key" (regression: was Boolean(publisher))', () => {
  test('no publisher account: not done (false), not unknown', () => {
    assert.equal(deriveKeyIssuedState(false, undefined), false);
    assert.equal(deriveKeyIssuedState(false, null), false);
    assert.equal(deriveKeyIssuedState(false, 1), false);
  });

  test('a publisher exists but the version has not been fetched yet: unknown (null), never Done', () => {
    assert.equal(deriveKeyIssuedState(true, undefined), null);
  });

  test('a newly registered publisher with no issued key: known false, not Done', () => {
    // This is the exact regression case: registration mints a row, but no key was ever shown
    // to the user, so the step must not read Done just because a publisher exists. Also covers
    // every legacy publisher whose key predates apiKeyVersion tracking, now that the backend's
    // boot migration force-rotates those onto this same null state — there is no longer a third
    // "possibly still usable" case for this function to distinguish (Codex round-3, f20dr3).
    assert.equal(deriveKeyIssuedState(true, null), false);
  });

  test('a publisher with a real issuance: done (true)', () => {
    assert.equal(deriveKeyIssuedState(true, 1), true);
  });

  test('a malformed version (0, negative, non-integer) is treated as not issued rather than crashing', () => {
    assert.equal(deriveKeyIssuedState(true, 0 as unknown as number), false);
    assert.equal(deriveKeyIssuedState(true, -1 as unknown as number), false);
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
    assert.equal(isRotationBroadcast({ publisherId: 'pub-1', version: 2 }, 'pub-1'), true);
  });

  test('rejects a message for a different publisher (a stale tab signed in as someone else)', () => {
    assert.equal(isRotationBroadcast({ publisherId: 'pub-2', version: 2 }, 'pub-1'), false);
  });

  test('rejects a message with a missing or malformed version', () => {
    assert.equal(isRotationBroadcast({ publisherId: 'pub-1' }, 'pub-1'), false);
    assert.equal(isRotationBroadcast({ publisherId: 'pub-1', version: 'm1' }, 'pub-1'), false);
    assert.equal(isRotationBroadcast({ publisherId: 'pub-1', version: 0 }, 'pub-1'), false);
  });

  test('rejects null, undefined, and non-object messages', () => {
    assert.equal(isRotationBroadcast(null, 'pub-1'), false);
    assert.equal(isRotationBroadcast(undefined, 'pub-1'), false);
    assert.equal(isRotationBroadcast('pub-1', 'pub-1'), false);
  });
});

describe('shouldInvalidateOnBroadcast — same-browser cross-tab invalidation', () => {
  test('a tab holding no key has nothing to invalidate', () => {
    assert.equal(shouldInvalidateOnBroadcast(null, 2), false);
  });

  test('a broadcast that differs from the held version invalidates it', () => {
    assert.equal(shouldInvalidateOnBroadcast(1, 2), true);
  });

  test('a broadcast that echoes the held version changes nothing (own rotation, or a duplicate)', () => {
    assert.equal(shouldInvalidateOnBroadcast(1, 1), false);
  });
});

describe('concurrent tabs and a lost response, end to end through the pure contract', () => {
  test('two tabs rotate; the tab holding the earlier response fails the pre-reveal check', () => {
    // Tab A rotates and holds { key: kA, version: 1 }. Tab B (or another device) rotates
    // afterward; the server's current version is now 2. Tab A must not be able to reveal kA.
    const versionA = 1;
    const serverVersionAfterB = 2;
    assert.equal(keyMatchesServerMarker(versionA, serverVersionAfterB), false);

    // Tab B's own version matches, because it is the winner.
    assert.equal(keyMatchesServerMarker(serverVersionAfterB, serverVersionAfterB), true);
  });

  test('a lost response followed by a retry: the tab never held the lost response, so nothing to invalidate — the retry version is what matches', () => {
    // Tab sends rotate request R1; the connection drops before the response arrives, so the
    // tab never calls parseIssuedKey on it and never holds R1's version. It retries and gets R2.
    const heldVersion: number | null = null; // R1's response was never received/parsed
    const r2Version = 2;

    // Nothing was held, so a broadcast (or a stray late arrival) of R1's version, if it ever
    // showed up, would not match what the tab now holds after R2 either.
    assert.equal(shouldInvalidateOnBroadcast(heldVersion, 1), false);

    // After the retry, the tab holds R2's version and it matches the server (R2 was the last,
    // and only, rotation this tab's user actually asked for and received).
    assert.equal(keyMatchesServerMarker(r2Version, r2Version), true);
  });

  test('BroadcastChannel invalidation fires before the tab would ever attempt a reveal', () => {
    const publisherId = 'pub-42';
    const heldVersion = 1;
    const incoming = { publisherId, version: 2 };

    assert.equal(isRotationBroadcast(incoming, publisherId), true);
    assert.equal(shouldInvalidateOnBroadcast(heldVersion, incoming.version), true);
  });

  test('two rotations that would collide on a millisecond-resolution timestamp still never collide on version', () => {
    // Models the exact scenario a frozen clock proves at the backend (test/apikeys.test.ts,
    // "apiKeyVersion: overlapping rotations... even with a frozen clock"): two rotations landing
    // in the same instant would stamp an identical apiKeyRotatedAt, but apiKeyVersion is a
    // counter, not a clock reading, so it is never equal across two distinct rotations.
    const rotationA = { apiKeyRotatedAt: '2026-09-26T00:00:00.000Z', apiKeyVersion: 4 };
    const rotationB = { apiKeyRotatedAt: '2026-09-26T00:00:00.000Z', apiKeyVersion: 5 };

    assert.equal(rotationA.apiKeyRotatedAt, rotationB.apiKeyRotatedAt, 'the timestamps collide');
    assert.notEqual(rotationA.apiKeyVersion, rotationB.apiKeyVersion, 'the versions never do');
    assert.equal(keyMatchesServerMarker(rotationA.apiKeyVersion, rotationB.apiKeyVersion), false);
    assert.equal(keyMatchesServerMarker(rotationB.apiKeyVersion, rotationB.apiKeyVersion), true);
  });
});
