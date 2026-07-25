#!/usr/bin/env node
/*
 * Diagnostic: do review records and Netlify Blobs actually agree?
 *
 * A review row stores an `image_key`; the image bytes live in the
 * `customer-reviews` blob store under that exact key. Nothing else links them,
 * so this checks both directions:
 *
 *   dangling row  -- a review whose blob is missing, which renders as a card
 *                    with no photo
 *   orphan blob   -- stored bytes that no review points at, which is wasted
 *                    storage from a submission that failed midway
 *
 * For each record it also requests the image the way a browser does: through
 * the photo function, and again through the Image CDN transform the cards use.
 *
 * Usage:
 *   node scripts/check-review-blobs.mjs
 *   node scripts/check-review-blobs.mjs --url http://localhost:8889
 *
 * Records are read from the site's own /api/reviews endpoint, so no database
 * credentials are needed. Orphan detection additionally needs blob access and
 * is skipped with a note when it isn't available -- run under `netlify dev exec`
 * or set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN for the full report.
 */

const STORE_NAME = 'customer-reviews';
const PHOTO_PREFIX = '/api/reviews/photo/';

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
};

const baseUrl = argValue('--url', 'https://aaahandyman.services').replace(/\/+$/, '');

/** The public path the API hands the UI, reduced back to its blob key. */
const blobKeyOf = (review) => {
  const url = typeof review?.imageUrl === 'string' ? review.imageUrl.trim() : '';
  if (!url.startsWith(PHOTO_PREFIX) || url.length === PHOTO_PREFIX.length) return '';
  try {
    return decodeURIComponent(url.slice(PHOTO_PREFIX.length));
  } catch {
    return '';
  }
};

const photoUrl = (key) => `${baseUrl}${PHOTO_PREFIX}${encodeURIComponent(key)}`;
const transformUrl = (key) =>
  `${baseUrl}/.netlify/images?url=${encodeURIComponent(`${PHOTO_PREFIX}${key}`)}&w=800&fm=avif&q=80`;

const statusOf = async (url) => {
  try {
    const response = await fetch(url);
    // Drain the body so the socket is released before the next request.
    await response.arrayBuffer().catch(() => undefined);
    return response.status;
  } catch (error) {
    return `ERR ${error instanceof Error ? error.message : String(error)}`;
  }
};

const fetchReviews = async () => {
  const response = await fetch(`${baseUrl}/api/reviews`);
  if (!response.ok) throw new Error(`GET ${baseUrl}/api/reviews responded ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error('GET /api/reviews did not return an array');
  return body;
};

/**
 * Editing a review replaces its blob and deletes the old one, so a record read
 * a moment ago can already point at a key that no longer exists. Re-read the
 * record before calling it broken, otherwise routine activity on the site looks
 * like corruption.
 */
const stillFailing = async (id, key) => {
  const current = await fetchReviews().catch(() => null);
  if (!current) return true;
  const review = current.find((entry) => String(entry.id) === String(id));
  if (!review) return false;
  if (blobKeyOf(review) !== key) return false;
  return (await statusOf(transformUrl(key))) !== 200 || (await statusOf(photoUrl(key))) !== 200;
};

/** Returns every key in the store, or null when blob access isn't available. */
const listBlobKeys = async () => {
  try {
    const { getStore } = await import('@netlify/blobs');
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
    const token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_API_TOKEN;
    const options = { name: STORE_NAME, consistency: 'strong' };
    if (siteID && token) Object.assign(options, { siteID, token });

    const { blobs } = await getStore(options).list();
    return blobs.map((blob) => blob.key);
  } catch (error) {
    console.log(`  (skipped: ${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
};

const main = async () => {
  console.log(`Checking reviews against blob store "${STORE_NAME}" via ${baseUrl}\n`);

  const reviews = await fetchReviews();
  console.log(`Review records: ${reviews.length}\n`);

  const dangling = [];
  const missingKey = [];
  const transformFailures = [];
  const referencedKeys = new Set();

  for (const review of reviews) {
    const key = blobKeyOf(review);

    if (!key) {
      missingKey.push(review.id);
      console.log(`id=${String(review.id).padEnd(4)} NO KEY   imageUrl=${JSON.stringify(review.imageUrl)}`);
      continue;
    }

    referencedKeys.add(key);
    const direct = await statusOf(photoUrl(key));
    const transformed = await statusOf(transformUrl(key));

    if (direct === 200 && transformed === 200) {
      console.log(`id=${String(review.id).padEnd(4)} ok       blob=${direct} cdn=${transformed}  ${key}`);
      continue;
    }

    if (!(await stillFailing(review.id, key))) {
      console.log(`id=${String(review.id).padEnd(4)} ok       (was edited mid-check; re-read is healthy)  ${key}`);
      continue;
    }

    if (direct !== 200) dangling.push({ id: review.id, key, status: direct });
    if (transformed !== 200) transformFailures.push({ id: review.id, key, status: transformed });
    console.log(`id=${String(review.id).padEnd(4)} FAIL     blob=${direct} cdn=${transformed}  ${key}`);
  }

  console.log('\nOrphan blobs (stored bytes no review points at):');
  const allKeys = await listBlobKeys();
  let orphans = [];
  if (allKeys) {
    orphans = allKeys.filter((key) => !referencedKeys.has(key));
    console.log(orphans.length ? orphans.map((key) => `  ${key}`).join('\n') : '  none');
    console.log(`  (${allKeys.length} blobs in store, ${referencedKeys.size} referenced)`);
  }

  console.log('\nSummary');
  console.log(`  records:            ${reviews.length}`);
  console.log(`  records with a key: ${referencedKeys.size}`);
  console.log(`  missing key:        ${missingKey.length}`);
  console.log(`  blob not found:     ${dangling.length}`);
  console.log(`  transform failed:   ${transformFailures.length}`);
  console.log(`  orphan blobs:       ${allKeys ? orphans.length : 'not checked'}`);

  const broken = missingKey.length + dangling.length + transformFailures.length;
  if (broken > 0) {
    console.log(`\n${broken} review card(s) cannot render their photo.`);
    process.exitCode = 1;
    return;
  }
  console.log('\nEvery review record resolves to a readable blob.');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
