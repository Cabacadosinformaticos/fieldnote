# Network access: production design and proof of concept

## Question

How participants' phones and researchers' browsers should reach Fieldnote in a real deployment,
how they reach it in this course project, which is a proof of concept, and why the two answers are
different. The entry point is also part of the fault model: if it fails, nothing behind it matters.

## What a real deployment needs

In a real study the participants are members of the public. They install the app on their own
phones and use it anywhere, on mobile data or on any Wi-Fi. That sets the requirements for the
entry layer:

- A stable public HTTPS address on a domain owned by the research team or its institution, so the
  app can be published once and keep working for the whole study. Participants cannot be asked to
  change an address in the middle of a diary study.
- No software for the participant to install besides the app.
- Protection at the edge: TLS certificates renewed automatically, rate limiting, and absorption of
  abusive traffic before it reaches the servers.
- Redundancy of the entry point itself, so that losing one gateway does not take the platform
  offline.
- No inbound ports opened on the network where the servers run, or, in a data centre or cloud, only
  the ports the load balancer needs.
- Support for long-lived connections, because the dashboard receives new entries through
  server-sent events.

## Options for a real deployment

### Cloudflare Tunnel on a domain owned by the project

`cloudflared` runs on each gateway and opens outbound connections to Cloudflare. Cloudflare serves
the public hostname, terminates TLS and forwards the requests through the tunnel, so no port is
opened on the servers' network. Its documentation describes redundancy directly:

> "You can deploy additional instances of cloudflared for availability and failover. These
> instances are called replicas." (Cloudflare, tunnel availability)

> "All replicas point to the same tunnel, so if a single host running cloudflared goes down, the
> remaining replicas continue to serve traffic." (same page)

Each instance also "establishes four outbound-only connections" to servers "spread across at least
two distinct data centers", so the tunnel survives the loss of one Cloudflare location as well.
With one replica on each of Fieldnote's two gateways, the public address survives the loss of a
gateway, which matches the two-gateway design of the proof of concept.

The cost is a dependency on one company for the whole entry path, and an account and a domain that
belong to the project or the institution.

### Cloud load balancer in front of virtual machines

A managed load balancer with a public address and a certificate, forwarding to gateways in two or
more zones. It is the usual choice when the servers already run in a public cloud. It adds a
provider account and running costs, and it works against the reason file 00 gives for self-hosting.
We did not compare prices between providers.

### Router port forwarding with dynamic DNS

Open ports on the home or campus router and point a name at its public address. This is the
cheapest option and the worst: it exposes the internal network to the Internet, the address
changes, and the router becomes a single point of failure that the fault model cannot cover.

### Cloudflare Quick Tunnel

`cloudflared tunnel --url` without an account gives a random `trycloudflare.com` address. It is
tempting for a demonstration. The documentation rules it out:

> "Quick Tunnels are for testing and development. For production, create a Cloudflare Tunnel."
> (Cloudflare, Quick Tunnels)

It lists further limits: "Each Quick Tunnel supports up to 200 in-flight requests", "Quick Tunnels
have no uptime guarantee", "The hostname changes each time you create a Quick Tunnel", and "Quick
Tunnels do not support Server-Sent Events (SSE)". The last one alone excludes it: the dashboard's
real-time updates use server-sent events. Access can be restricted with an optional email one-time
code, but that does not change the conclusion.

### Tailscale Funnel

Funnel publishes one service of a device on the tailnet at a public address. Its documentation sets
the limits: "Funnel can only listen on ports 443, 8443, and 10000", "Funnel can only use DNS names
in your tailnet's domain (tailnet-name.ts.net)", "Traffic sent over a Funnel is subject to
non-configurable bandwidth limits", and "Tailscale Funnel is currently in beta". The address belongs
to Tailscale's domain, the bandwidth is limited for media uploads, and the feature is in beta. It
could serve a very small pilot, not a study.

### Summary

| Option | No open ports | Stable address on own domain | Redundant entry | Server-sent events | Fit for a real study |
|---|---|---|---|---|---|
| Cloudflare Tunnel, two replicas | Yes | Yes | Yes | Yes | Yes |
| Cloud load balancer | Only the balancer's | Yes | Yes | Yes | Yes, with cloud costs |
| Port forwarding with dynamic DNS | No | No | No | Yes | No |
| Cloudflare Quick Tunnel | Yes | No | No | No | No (testing only) |
| Tailscale Funnel | Yes | No (`ts.net`) | No | Not checked | Small pilots only |

**Recommended production design.** A Cloudflare Tunnel on a domain dedicated to the project or the
institution, with one `cloudflared` replica on each of two gateways. Administration of the servers
stays on a private network (for example Tailscale) and is never exposed publicly. Behind the
gateways nothing changes: Traefik still routes `/api` to the API replicas and `/media` to object
storage.

## What this project does, and why

Fieldnote is built for a course. It is a proof of concept: there are no participants from the
public, the platform runs on a team member's home server or laptop, and what the course assesses is
the design, the fault tolerance demonstration and the security reasoning. Access therefore goes
only through Tailscale, a private network built on WireGuard:

- The only devices that need to reach the platform are the team's phones and computers, and those
  of anyone the team invites for a small test, all of which can join the project's Tailscale
  network.
- Nothing is exposed to the Internet. That removes a whole class of attacks from the security scope
  and keeps a proof of concept with test data off the public network.
- The only domain and Cloudflare account available belong to a team member's personal services.
  Using them would mix course work with personal infrastructure, and a real deployment should use
  a domain owned by the project or the institution anyway.
- It works the same way on the server and on the laptop fallback, which a tunnel bound to a fixed
  hostname would complicate.
- Entry redundancy is still demonstrated: two gateways, each with its own Tailscale address, and
  clients that switch to the second when the first fails.

### What the proof of concept gives up

| Property | Production design | Proof of concept |
|---|---|---|
| Who can connect | Anyone with the app | Only devices on the project's tailnet |
| Address | One public hostname | Two private addresses, one per gateway |
| Failover between gateways | Inside Cloudflare, invisible to the client | In the client, which retries on the second address |
| Edge protection against abuse | Cloudflare | Not needed without public exposure; rate limiting stays in Traefik |
| Dependency on an external service | Cloudflare for every request | Tailscale's coordination service to join devices; existing connections keep working if it is down |

Client-side failover is a weaker design than a single redundant address: every client must know
both addresses and implement the retry. For the course it has one advantage: the failover is
visible and can be demonstrated by stopping gateway 1 and watching the app switch.

The move to production is small by design: the gateways and everything behind them stay the same,
and only the entry changes from two Tailscale addresses to one public hostname served by two tunnel
replicas.

## How Fieldnote proceeds

| Finding | Decision | Status |
|---|---|---|
| Cloudflare Tunnel replicas give a redundant public entry | Recommended production design, documented | Adopted as the production path |
| Quick Tunnels are for testing and do not support server-sent events | Not used, not even for the demonstration | Adopted |
| Funnel is limited (ports, `ts.net` domain, bandwidth, beta) | Not used | Adopted |
| The course project has no participants from the public | Access only through Tailscale, two gateways, client-side failover | Adopted |
| Course work should not use personal infrastructure | No personal domain or account used | Adopted |

## Sources

- Cloudflare. Quick Tunnels (TryCloudflare).
  https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/
- Cloudflare. Tunnel availability and failover (replicas).
  https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-availability/
- Tailscale. Tailscale Funnel. https://tailscale.com/docs/features/tailscale-funnel

All sources accessed in September 2026.

## Limits

- Provider features and limits come from current documentation and change often; Funnel is in
  beta. The 200 in-flight request limit of Quick Tunnels was not measured.
- Cloud load balancer costs were not compared.
- Whether Funnel supports server-sent events was not checked, because the other limits already
  exclude it.
