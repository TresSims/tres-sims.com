---
title: 'Managing Home Lab DNS and Ad-Blocking with Technitium dns-server'
date: 2026-07-20
description: "Full home Ad-Blocking and Home Lab DNS Management."
thumbnail: /Technitium/thumbnail.png
tags: ["Software_Engineer"]
---

I've use [Pi-hole](https://pi-hole.net/) for a long time to manage dns blacklists. It's 
an absolutely briliany project, and I highly recommend it. But as my homelab grew, I 
realized I wanted to have more control over DNS resolution in my home network. I have a 
handful of domains that I use to point to various services in my lab. Originally, I followed 
[this](https://www.aricodes.net/posts/unbound-authoritative-zone/) wonderful article by 
a dear friend of mine which got me started, but I hated writing DNS records by hand and 
wanted an all in one solution to manage my DNS black-hole and my local DNS zones. Enter 
[Technitium dns-server](https://technitium.com/dns/).

Technitium dns-server has the same ad-blocking capabilities as Pi-hole, and built in tools 
for managing custom DNS zones, all wrapped with a nice web ui. Now, I've been pushing to 
get as much of my lab to run as code, and on Kubernetes as possible. I really appreciate 
the simplicity that GitOps affords, and having my lab's state as code helps scratch the 
organizational itch that drives me. But since most services designed for homelabs are designed 
for running on docker hosts. Which is great! Because Kubernetes orchestrates docker containers. 
But it's also not great, because that means they generally don't have helm charts ready 
to go. Good thing I'm a platform engineer.

## Deployment

So, to get this deployed in my lab, there were a few things I knew I'd want.

1. A consistent ip that I can access over UDP to serve DNS traffic
2. A way to monitor metrics of my DNS server

Most of my services are deployed behind traefik ingress, which works great. It terminates 
the TCP traffic with a certificate provisioned by CertManager, and has all sorts of observability 
features. But I didn't want to do any of that for this, since DNS traffic is generally handled 
via UDP. I know you *can* do UDP routes with traefik, but still felt like the right answer 
would be a dedicated VIP. Fortunately, I have [MetalLB](https://metallb.io/) set up in my 
cluster so I decided to set up a LoadBalancer service that maps to the UDP and HTTP ports 
that the container exposes. Maybe in a future iteration I'll consider routing the web 
interface behing an http route, but for now this serves my needs sufficiently.

Okay, so that wasn't much of a decision, but the next part is equally important. I have 
an OTEL pipeline set up for metrics/log collection and alerting, and I definitely didn't 
want my DNS resolver to be a blind spot there. Here, the OpenSource community saves the 
day again. [technitium-dns-prometheus-exporter](https://github.com/brioche-works/technitium-dns-prometheus-exporter) 
does just that. Feed it an api key and your URL and it happily spits out prometheus metrics 
in a format that you can scrape.

After an afternoon of poking around, I ended up with [a helm chart](https://github.com/TresSims/deep-thonk-charts/tree/main/technitium) 
that spins up a new deployment and maps all of the ports to a LodaBalancer service, and 
run the prometheus exporter as a sidecar container to provide a constant stram of metrics. 
The final implemntation has a bit of a code smell, as it requires deploying the chart with 
metrics disabled, set up an api token, then enable metrics once the token is configured. 
Maybe one day I'll take another look at this and make a technitium operator to manage that 
stuff automatically.

To actually get applications onto my cluster, I utilize [flux](https://fluxcd.io/) to consistently 
enforce cluster state. I put the whole deployment into it's own namespace to enforce good 
application segmentation, and some external secrets configuration to push the api token 
into the namespace from my vault instance. The full configuration is in my repository 
[here](https://github.com/TresSims/deep-thonk-flux/tree/main/applications/technitium) but 
here's a sample deployment if you're just looking for the juicy bits.

```yaml
---
apiVersion: source.toolkit.fluxcd.io/v1
kind: OCIRepository
metadata:
  name: technitium-helm
  namespace: technitium
spec:
  interval: 5m0s
  url: oci://ghcr.io/tressims/charts/technitium
  layerSelector:
    mediaType: "application/vnd.cncf.helm.chart.content.v1.tar+gzip"
    operation: copy
  ref:
    semver: "15.4.0"
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: technitium
  namespace: technitium
spec:
  chartRef:
    kind: OCIRepository
    name: technitium-helm
  interval: 10m
  values:
    service:
      type: LoadBalancer
      loadBalancerIP: "192.168.1.53"
      dnsPort: 53
      httpPort: 5380
    persistence:
      enabled: true
      size: 1Gi
    metrics:
      enabled: true
```

Now, with everything deployed It's time to go in and configure everything. And the best 
part? I won't even have to click through any interfaces!

## Configuration

Since I'm already coasting on the wonderful work of the OpenSource community, I'm going 
to keep doing that. Stefano Bertelli has put together a [technitium terraform provider](https://github.com/bartei/terraform-provider-technitium) 
that covers all of the major pieces I want to configure! Since Technitium is a DNS resovler 
first, where Pi-hole is specifically designed as an ad blocker, we need to get a block list 
set up.

```terraform
locals {
  # HaGeZi's Pro DNS Blocklist - Ads, Affiliate, Tracking, Metrics, Telemetry,
  # Phishing, Malware, Scam, Fake, Cryptojacking, etc.
  # https://github.com/hagezi/dns-blocklists
  block_list_urls = [
    "https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/adblock/pro.txt",
  ]
}

resource "technitium_server_settings" "main" {
  log_queries = true

  enable_blocking = true
  block_list_urls = local.block_list_urls
}
```

A quick TF apply, update my router to use 192.168.1.53 as it's dns resolver and we're 
already blocking ads! But this was only one half of the equation. What about DNS records?

Well, it's just a few more lines of terraform! I have two zones in my homelab. One points 
to my SAN, which also happens to be a docker host that's running a bunch of services I 
deployed pre-kubernetes. And the other one points to my general k8s ingress vip. 

```terraform
resource "technitium_zone" "deep_thonk" {
  name = "deep-thonk.com"
  type = "Primary"
}

resource "technitium_record" "deep_thonk" {
  zone  = technitium_zone.deep_thonk.name
  name  = "deep-thonk.com"
  type  = "A"
  value = "192.168.1.25"
  ttl   = 300
}

resource "technitium_record" "star_deep_thonk" {
  zone  = technitium_zone.deep_thonk.name
  name  = "*.deep-thonk.com"
  type  = "CNAME"
  value = "deep-thonk.com"
  ttl   = 300
}

resource "technitium_zone" "k8s_deep_thonk" {
  name = "k8s.deep-thonk.com"
  type = "Primary"
}

resource "technitium_record" "k8s_deep_thonk" {
  zone  = technitium_zone.k8s_deep_thonk.name
  name  = "k8s.deep-thonk.com"
  type  = "A"
  value = "192.168.1.5"
  ttl   = 300
}

resource "technitium_record" "star_k8s_deep_thonk" {
  zone  = technitium_zone.k8s_deep_thonk.name
  name  = "*.k8s.deep-thonk.com"
  type  = "CNAME"
  value = "k8s.deep-thonk.com"
  ttl   = 300
}
```

Now, I've officialy replaced my old Pi-hole + Unbound stack, and everything is neatly 
managed as code. If you ignore the fact I had to create a few api keys after the initial 
deployment. Well, like I've said before there's always room for improvement. That leaves 
just one last piece to this puzzle, the whole reason I deployed the prometheus sidecar in 
the first place.

## Monitoring

This part is pretty simple. Technitium has a bunch of nice graphs in it's web UI, but I 
wanted that data to show up in my grafana instance. I also did not want to spend a whole 
lot of time meticulously digging through documentation and designing panels for a dashboard.
I don't pretend to be a monitoring expert, I've made my fair share of dashboards but I didn't 
feel like spending an afternoon meticulously troubleshooting metrics, but data aggregation 
tools have [come a long way](https://claude.ai/share/653835fb-bec7-4640-8381-d9d3054ff61e). 
Ultimately, I ended up with a sleek dashboard that surfaces all of the important information. 


## Outro

I've really enjoyed working on this project! It's super rewarding to tie together different 
components into a platform that works with my infrastructure and serves my needs. In the 
future I'd love to take a look at automating some of the intial account/secret provisioning, 
and getting TLS wrapped around the web UI. But those are challenges for future projects. 

