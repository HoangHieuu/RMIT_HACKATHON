#!/bin/bash
# retry-init.sh — rerun the bootstrap while Tide's licensing service (Midgard FinalizeWallet) is
# returning transient 5xx errors. Each attempt reuses the running container and recreates the realm.
cd "$(dirname "$0")/.."
for attempt in $(seq 1 ${ATTEMPTS:-12}); do
  echo "===== attempt $attempt $(date +%H:%M:%S) =====" >> data/init-attempts.log
  KEEP_CONTAINER=1 bash scripts/init-veil.sh > data/init.log 2>&1
  rc=$?
  tail -3 data/init.log >> data/init-attempts.log
  if [ $rc -eq 0 ]; then echo "SUCCESS" >> data/init-attempts.log; exit 0; fi
  if ! grep -q "setUpTideRealm failed" data/init.log; then echo "STOPPED: non-licensing failure" >> data/init-attempts.log; exit $rc; fi
  sleep ${WAIT:-45}
done
echo "GAVE UP" >> data/init-attempts.log
