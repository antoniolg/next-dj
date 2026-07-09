# Security Policy

## Supported Versions

Security fixes are handled on the default branch until the project publishes
stable release lines.

## Reporting A Vulnerability

Please report suspected vulnerabilities privately by email:

antonio@devexperto.com

Include the affected version or commit, reproduction steps, expected impact,
and any relevant logs. Please do not open a public issue for a vulnerability
until it has been reviewed.

## Scope

The public repository ships a neutral playlist import provider API. Third-party
providers run in the Electron main process and are responsible for their own
security posture, legal compliance, and input validation.
