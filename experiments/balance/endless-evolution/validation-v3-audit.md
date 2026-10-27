# V3 validation final audit

Complete600 strict native records: 301 victories, 299 natural deaths,0 unresolved. All6 planned group denominators are retained.

| Strategy | Width | Wins / planned | Deaths | Successful n | Successful P50 seconds | Normal480–720 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| random-auto | 450 | 39 / 100 | 61 | 39 | 539.1500 | not applicable |
| random-auto | 1600 | 27 / 100 | 73 | 27 | 531.4917 | not applicable |
| build-auto | 450 | 61 / 100 | 39 | 61 | 506.5417 | pass |
| build-auto | 1600 | 56 / 100 | 44 | 56 | 505.7708 | pass |
| build-active | 450 | 60 / 100 | 40 | 60 | 505.5167 | pass |
| build-active | 1600 | 58 / 100 | 42 | 58 | 509.6250 | pass |

Successful P50 uses wins only. TTK means use defeated entities only; no human rate or damage-versus-hit interrupt cause is inferred. Full original audit/index/native files are preserved.

Limitations:

- All group denominators include deaths and nonentrants. Successful duration quantiles use wins only, never deaths/all runs.
- Death-star/finite-credit TTK counts defeated entities only; fusion donors and living units are censored. <=1second lifetimes do not establish a single hit.
- Native public observation records interruption, but not its damage-versus-hit cause. No cause is inferred.
- Fresh V3 seeds differ from V1/V2. Historical comparisons are unpaired unless both sides really share policy and exact seed/config sets.
- Engineering/strict recording acceptance does not establish sustained challenge, human survival, browser acceptance or deployment.
- Native maximum1second HP/source aggregates do not prove a specific human reaction or per-cast causality. A single authored slam cap does not cap combined damage from all sources.
- All exact cases/native sidecar hash rows remain in ignored NFS evidence; this compact summary binds their original hashes rather than copying large raw evidence into Git.
