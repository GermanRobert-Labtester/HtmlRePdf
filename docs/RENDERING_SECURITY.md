# Rendering profiles and security configuration

The server selects a profile from the source type. The HTTP request cannot
select Trusted local automation. Converter, print PDF and MCP screenshot use
the same source policy. Results include the active profile and blocked resource
reasons shown in the Studio UI.

| Profile | Source | Network access | Scripts |
| --- | --- | --- | --- |
| Local bundle | Raw HTML, uploaded ZIP/HTML, allowed local file | Bundled assets only; no external requests | Disabled |
| Public web | HTTP/HTTPS URL | Publicly routable HTTP(S) only, each hop and subresource checked | Enabled |
| Trusted local automation | Explicitly operator-enabled stdio MCP | HTTP(S), including local services, while local files remain root-bound | Enabled |

## Local input

Set RENDER_LOCAL_ROOTS to absolute directories separated by the operating
system path delimiter (":" on Linux, ";" on Windows). Uploaded bundles are
authorized automatically and referenced through /api/preview/<UUID>/<entry.html>.
The conversion engine loads local material from a virtual .invalid origin
instead of navigating to file:// or to its own localhost server. Encoded
traversal, double-encoding, out-of-root symlinks, ZIP symlinks, invalid
schemes and filesystem paths outside allowed roots are denied. Archive entry
count and expanded size are capped.

Local development uses STUDIO_BIND_HOST=127.0.0.1 and does not require an
API token unless one is configured. Use RENDER_TRUSTED_STDIO=true in a
trusted local operator environment to explicitly enable the expanded stdio
profile. Neither the REST request body nor an MCP tool argument can enable
this mode; hosted HTTP MCP is always untrusted.

## Hosted REST and SSE MCP

NODE_ENV=production or a non-loopback bind address requires one or both:
- STUDIO_API_TOKEN, passed by CLI/API callers in the HTTP Authorization
  Bearer header (never in query strings or exported projects).
- STUDIO_PROXY_AUTH_SECRET, added to the X-Studio-Proxy-Secret header only by
  a trusted identity-aware authenticated reverse proxy *after* it verifies
  user identity. The proxy must strip all inbound copies of that header.
  Restrict origin access to the proxy; do not expose the backend directly.

The browser Studio UI must be deployed behind such an authentication proxy;
putting an API token in frontend JavaScript would disclose it. The proxy
should also apply rate limits, input size limits and session controls.
Set APP_URL and STUDIO_ALLOWED_ORIGINS to exact front-end origins. CORS
does not replace authentication. PDF downloads, upload/preview routes,
health, REST endpoints, /mcp and /mcp/messages share the HTTP guard.

Uploaded HTML responses have CSP sandbox without allow-scripts or
allow-same-origin, deny script execution, network connections, embedded
frames and form submission, and disable content sniffing. Uploaded and
raw preview iframes also omit those sandbox permissions. Sandboxed
documents have opaque origins and cannot read the application's DOM,
storage or authenticated API responses. Keep this even if hosting previews
on a dedicated separate hostname (recommended for production). An external
URL's iframe is also opaque-origin sandboxed; external pages may require
scripts to render, but these do not gain the application's origin.

## Public-web egress policy is mandatory

Application-side SSRF defenses validate URL schemes and credentials,
classify literal IP addresses, resolve DNS, deny non-public answers, and
manually validate every redirect and subresource before fetching. Browser
routing does NOT prevent DNS rebinding or all browser-network bypasses:
the browser or transport may resolve a hostname again after checking,
and WebRTC and other network capabilities need OS/deployment isolation.

In production public-web rendering is disabled until the operator
configures a network-level egress firewall / namespace / VM / container
policy and sets STUDIO_PUBLIC_EGRESS_READY=true. This variable is an
operator acknowledgment, not a firewall or proof that one is enabled.
Deny loopback, RFC1918, CGNAT, link-local, metadata endpoints such as
169.254.169.254, IPv6 ULA, private VPC ranges, DNS answers for private
addresses, the application API, and all non-essential network protocols.
Permit only intended public HTTP(S) destinations. Enforce it for all
render worker sockets and DNS resolvers, including cross-origin redirects
and subresources. Do not expose a public render worker in a network with
privileged internal services until this network isolation is independently
verified. Limit Chromium process privileges, CPU, memory and filesystem
access, and run it inside an OS sandbox. Existing --no-sandbox Chromium
flags are not a security substitute.

## Verification

Run npm run lint, npm run build and npm run test:boundaries. The focused
suite checks address categorization, redirect-to-private rejection, path
traversal and symlinks, offline bundle rendering, public page rendering,
hosted REST/MCP credentials, ZIP traversal, and scriptless previews.
Install Chromium first using npx playwright install --with-deps chromium.
A live public-web smoke test requires external DNS and Internet access.
The CI workflow runs these checks on pull requests and pushes.
Successful tests do not certify external firewall implementation.
