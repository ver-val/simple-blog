#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

RESULTS_DIR="tests/dast/results"
mkdir -p "$RESULTS_DIR"

BASE_URL="${DAST_BASE_URL:-http://localhost:8080}"
ZAP_TARGET_PUBLIC="${ZAP_TARGET_PUBLIC:-$BASE_URL/health}"
ZAP_TARGET_AUTH="${ZAP_TARGET_AUTH:-$BASE_URL/api/profile/me}"

python3 - <<'PY' > "$RESULTS_DIR/.zap-auth.json"
import json
import time
import urllib.request

base = "http://localhost:8080/api/auth"
run_id = str(int(time.time()))
email = f"zap+{run_id}@example.com"
display = f"zap_{run_id}"
password = "Asdf@1234"

register_payload = {"email": email, "password": password, "displayName": display}
login_payload = {"username": display, "password": password}

for path, payload in [("/register", register_payload), ("/login", login_payload)]:
    req = urllib.request.Request(
        base + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        if path == "/login":
            token = data["token"]
            user = data["user"]

post_req = urllib.request.Request(
    "http://localhost:8080/api/posts",
    data=json.dumps({
        "title": f"zap post {run_id}",
        "description": "zap generated description",
        "body": "zap generated body"
    }).encode(),
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    },
)
with urllib.request.urlopen(post_req) as resp:
    post = json.loads(resp.read().decode())

print(json.dumps({
    "token": token,
    "email": email,
    "password": password,
    "displayName": display,
    "userId": user["id"],
    "postId": post["id"],
    "publicEmail": f"zap-public-{run_id}@example.com",
    "publicDisplayName": f"zap_public_{run_id}",
    "publicPassword": password,
}))
PY

JWT_TOKEN="$(python3 - <<'PY'
import json
with open("tests/dast/results/.zap-auth.json", "r", encoding="utf-8") as fh:
    print(json.load(fh)["token"])
PY
)"

AUTH_USER_ID="$(python3 - <<'PY'
import json
with open("tests/dast/results/.zap-auth.json", "r", encoding="utf-8") as fh:
    print(json.load(fh)["userId"])
PY
)"

AUTH_POST_ID="$(python3 - <<'PY'
import json
with open("tests/dast/results/.zap-auth.json", "r", encoding="utf-8") as fh:
    print(json.load(fh)["postId"])
PY
)"

AUTH_EMAIL="$(python3 - <<'PY'
import json
with open("tests/dast/results/.zap-auth.json", "r", encoding="utf-8") as fh:
    print(json.load(fh)["email"])
PY
)"

AUTH_DISPLAY_NAME="$(python3 - <<'PY'
import json
with open("tests/dast/results/.zap-auth.json", "r", encoding="utf-8") as fh:
    print(json.load(fh)["displayName"])
PY
)"

AUTH_PASSWORD="$(python3 - <<'PY'
import json
with open("tests/dast/results/.zap-auth.json", "r", encoding="utf-8") as fh:
    print(json.load(fh)["password"])
PY
)"

PUBLIC_EMAIL="$(python3 - <<'PY'
import json
with open("tests/dast/results/.zap-auth.json", "r", encoding="utf-8") as fh:
    print(json.load(fh)["publicEmail"])
PY
)"

PUBLIC_DISPLAY_NAME="$(python3 - <<'PY'
import json
with open("tests/dast/results/.zap-auth.json", "r", encoding="utf-8") as fh:
    print(json.load(fh)["publicDisplayName"])
PY
)"

PUBLIC_PASSWORD="$(python3 - <<'PY'
import json
with open("tests/dast/results/.zap-auth.json", "r", encoding="utf-8") as fh:
    print(json.load(fh)["publicPassword"])
PY
)"

AUTH_USER_ID="$AUTH_USER_ID" AUTH_POST_ID="$AUTH_POST_ID" AUTH_EMAIL="$AUTH_EMAIL" AUTH_DISPLAY_NAME="$AUTH_DISPLAY_NAME" AUTH_PASSWORD="$AUTH_PASSWORD" PUBLIC_EMAIL="$PUBLIC_EMAIL" PUBLIC_DISPLAY_NAME="$PUBLIC_DISPLAY_NAME" PUBLIC_PASSWORD="$PUBLIC_PASSWORD" python3 - <<'PY'
import os
from pathlib import Path

results_dir = Path("tests/dast/results")

def write_plan(targets: list[str], prefix: str, requestor_requests: list[str]) -> None:
    urls = "\n".join(f"    - {target}" for target in targets)
    spider_jobs = "\n".join(
        f"""- parameters:
    maxDuration: 1
    url: {target}
  type: spider"""
        for target in targets
    )
    requestor_job = ""
    if requestor_requests:
        requestor_job = "\n".join(
            [
                "- type: requestor",
                "  requests:",
                *requestor_requests,
            ]
        )
    plan = f"""env:
  contexts:
  - excludePaths: []
    name: {prefix}
    urls:
{urls}
  parameters:
    failOnError: true
    progressToStdout: true
jobs:
{spider_jobs}
{requestor_job}
- parameters:
    maxDuration: 2
  type: passiveScan-wait
- parameters:
    reportDescription: ''
    reportDir: /zap/wrk
    reportFile: {prefix}-zap.html
    reportTitle: ZAP Scanning Report ({prefix})
    template: traditional-html
  type: report
- parameters:
    reportDescription: ''
    reportDir: /zap/wrk
    reportFile: {prefix}-zap.md
    reportTitle: ZAP Scanning Report ({prefix})
    template: traditional-md
  type: report
- parameters:
    reportDescription: ''
    reportDir: /zap/wrk
    reportFile: {prefix}-zap.json
    reportTitle: ZAP Scanning Report ({prefix})
    template: traditional-json
  type: report
"""
    (results_dir / f"{prefix}-zap.yaml").write_text(plan, encoding="utf-8")

write_plan(
    [
        "http://host.docker.internal:8080/health",
    ],
    "public",
    [
        f"""    - url: http://host.docker.internal:8080/api/auth/register
      name: register
      method: POST
      headers:
        - "Content-Type:application/json"
      data: '{{"email":"{os.environ["PUBLIC_EMAIL"]}","password":"{os.environ["PUBLIC_PASSWORD"]}","displayName":"{os.environ["PUBLIC_DISPLAY_NAME"]}"}}'
      responseCode: 201""",
        f"""    - url: http://host.docker.internal:8080/api/auth/login
      name: login
      method: POST
      headers:
        - "Content-Type:application/json"
      data: '{{"username":"{os.environ["AUTH_DISPLAY_NAME"]}","password":"{os.environ["AUTH_PASSWORD"]}"}}'
      responseCode: 200""",
        f"""    - url: http://host.docker.internal:8080/api/auth/forgot-password
      name: forgot-password
      method: POST
      headers:
        - "Content-Type:application/json"
      data: '{{"email":"{os.environ["AUTH_EMAIL"]}"}}'
      responseCode: 200""",
        """    - url: http://host.docker.internal:8080/api/auth/reset-password
      name: reset-password
      method: POST
      headers:
        - "Content-Type:application/json"
      data: '{"token":"invalid-token","password":"Asdf@1234"}'
      responseCode: 400""",
    ],
)
write_plan(
    [
        "http://host.docker.internal:8080/api/profile/me",
        "http://host.docker.internal:8080/api/posts",
        f"http://host.docker.internal:8080/api/posts/{os.environ['AUTH_POST_ID']}",
        f"http://host.docker.internal:8080/api/posts/{os.environ['AUTH_POST_ID']}/comments",
        f"http://host.docker.internal:8080/api/users/{os.environ['AUTH_USER_ID']}/posts",
    ],
    "auth",
    [
        f"""    - url: http://host.docker.internal:8080/api/posts
      name: create-post
      method: POST
      headers:
        - "Content-Type:application/json"
      data: '{{"title":"zap auth title","description":"zap auth description","body":"zap auth body"}}'
      responseCode: 201""",
        f"""    - url: http://host.docker.internal:8080/api/posts/{os.environ["AUTH_POST_ID"]}/comments
      name: create-comment
      method: POST
      headers:
        - "Content-Type:application/json"
      data: '{{"name":"{os.environ["AUTH_DISPLAY_NAME"]}","message":"zap auth comment"}}'
      responseCode: 201""",
    ],
)
PY

echo "[zap] Running public scan against $ZAP_TARGET_PUBLIC"
docker run --rm \
  --name automation-testing-zap-public \
  --label com.docker.compose.project=automation-testing \
  --label com.docker.compose.service=zap-public \
  --add-host host.docker.internal:host-gateway \
  -v "$PWD/$RESULTS_DIR:/zap/wrk" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap.sh \
  -cmd \
  -host 0.0.0.0 \
  -port 8090 \
  -config api.disablekey=true \
  -autorun /zap/wrk/public-zap.yaml

echo "[zap] Running authenticated scan against $ZAP_TARGET_AUTH"
docker run --rm \
  --name automation-testing-zap-auth \
  --label com.docker.compose.project=automation-testing \
  --label com.docker.compose.service=zap-auth \
  --add-host host.docker.internal:host-gateway \
  -v "$PWD/$RESULTS_DIR:/zap/wrk" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap.sh \
  -cmd \
  -host 0.0.0.0 \
  -port 8090 \
  -config api.disablekey=true \
  -config "replacer.full_list(0).description=auth" \
  -config "replacer.full_list(0).enabled=true" \
  -config "replacer.full_list(0).matchtype=REQ_HEADER" \
  -config "replacer.full_list(0).matchstr=Authorization" \
  -config "replacer.full_list(0).regex=false" \
  -config "replacer.full_list(0).replacement=Bearer ${JWT_TOKEN}" \
  -autorun /zap/wrk/auth-zap.yaml

rm -f \
  "$RESULTS_DIR/.zap-auth.json" \
  "$RESULTS_DIR/public-zap.yaml" \
  "$RESULTS_DIR/auth-zap.yaml"

echo "[zap] Reports generated in $RESULTS_DIR"
