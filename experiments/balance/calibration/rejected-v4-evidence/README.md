# Reviewed calibration evidence

The JSON files in this directory are readable, normalized copies of complete experiment evidence, decisions and audits. Original bytes remain under ignored `artifacts/balance/` and the local task archive; the final index records original and committed SHA-256 values and semantic equality. Normalizing JSON does not change the outcomes or their sample denominators. Raw manifests, profile snapshots and complete run JSONL are identified by the phase evidence's embedded digests.

`candidate-freeze.json` records the selected diagnostic variant. `selection-decision.json` was saved after the complete selection audit and before any outcome from master 20261027 was inspected. Neither document claims final adoption. The earlier rejected candidates, consumed validation protocols and diagnostic probes remain in the parent directory.

`local-verification.json` and `local-static-browser.json` describe local checks and their exact profile/source identities. The static PRE check uses a manual stage jump to verify configuration. Earlier natural browser reward-carry/defeat/restart evidence covers unchanged first-stage success/failure, reward carry-over and entry into stage two. These checks do not establish a fresh complete browser-suite pass, physical-device comfort, Wiki publication or a Cloudflare deployment.

See the [calibration report](../../../../docs/balance-calibration-2026-10-22.md) for parameter rationale, confidence intervals, soft deviations and retained regressions. Full source identity is determined by the content fingerprint and per-file hashes; the numerical runs record the pre-commit working tree, so their original Git commit field differs from the later reviewed merge commit.
