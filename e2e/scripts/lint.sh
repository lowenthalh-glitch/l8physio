#!/usr/bin/env bash
# Guideline checks: no fixed sleeps, no committed debug specs.
cd "$(dirname "$0")/.."
fail=0
if grep -rnE 'waitForTimeout\(|(^|[^.[:alnum:]_])setTimeout\(' tests pages fixtures; then echo "fixed sleeps found: wait on app state instead"; fail=1; fi
if [ -n "$(find tests -name 'zzz-*')" ]; then find tests -name 'zzz-*'; echo "debug specs found"; fail=1; fi
exit $fail
