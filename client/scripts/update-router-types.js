// One-off script to inject the new routes we added into the
// auto-generated expo-router type manifest. Running `expo start` would
// regenerate this automatically, but we can't spin up Metro here, so we
// patch the existing file instead.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '.expo', 'types', 'router.d.ts');
let s = fs.readFileSync(file, 'utf8');

const urlParams = "${`?${string}` | `#${string}` | ''}";

// Static /settings/account/* routes we added.
const accountRoutes = [
  '/settings/account/change-email',
  '/settings/account/passkeys',
  '/settings/account/remove-account',
  '/settings/account/request-data',
  '/settings/account/security-notifications',
  '/settings/account/two-factor',
];

function staticInputObj(r) {
  return `| { pathname: \`${r}\`; params?: Router.UnknownInputParams; }`;
}
function staticOutputObj(r) {
  return `| { pathname: \`${r}\`; params?: Router.UnknownOutputParams; }`;
}
function staticStr(r) {
  return `| \`${r}${urlParams}\``;
}

// /(auth)/two-factor uses the dual-alias pattern of existing /(auth)/* routes.
const authRoute = 'two-factor';
function authInputObj() {
  return `| { pathname: \`\${'/(auth)'}/${authRoute}\` | \`/${authRoute}\`; params?: Router.UnknownInputParams; }`;
}
function authOutputObj() {
  return `| { pathname: \`\${'/(auth)'}/${authRoute}\` | \`/${authRoute}\`; params?: Router.UnknownOutputParams; }`;
}
function authStr() {
  return `| \`\${'/(auth)'}/${authRoute}${urlParams}\` | \`/${authRoute}${urlParams}\``;
}

const addInput = accountRoutes.map(staticInputObj).join(' ') + ' ' + authInputObj();
const addOutput = accountRoutes.map(staticOutputObj).join(' ') + ' ' + authOutputObj();
const addStr = accountRoutes.map(staticStr).join(' ') + ' ' + authStr();

// Anchors: first dynamic-route entry (same in all three unions).
const ANCHOR_IN = '| { pathname: `/chat/[id]`, params: Router.UnknownInputParams';
const ANCHOR_OUT = '| { pathname: `/chat/[id]`, params: Router.UnknownOutputParams';
const ANCHOR_STR = '| `/chat/${Router.SingleRoutePart<T>}';

function replaceOnce(haystack, needle, replacement) {
  const idx = haystack.indexOf(needle);
  if (idx === -1) throw new Error(`Anchor not found: ${needle.slice(0, 40)}...`);
  return haystack.slice(0, idx) + replacement + haystack.slice(idx);
}

// hrefInputParams
s = replaceOnce(s, ANCHOR_IN, addInput + ' ');
// hrefOutputParams
s = replaceOnce(s, ANCHOR_OUT, addOutput + ' ');
// href: string-template form, then input-object form (which re-appears inside the href union)
s = replaceOnce(s, ANCHOR_STR, addStr + ' ');
s = replaceOnce(s, ANCHOR_IN, addInput + ' ');

fs.writeFileSync(file, s);
console.log('Updated ' + file);
