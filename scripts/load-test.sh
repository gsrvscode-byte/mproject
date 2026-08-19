#!/bin/bash

# =========================================================
# load-test.sh
#
# Sends fake traffic at the API through nginx, and tallies
# which "api" container handled each request using the
# X-Served-By response header. Useful for confirming the
# nginx load balancer is actually spreading requests across
# scaled replicas, not sticking to one.
#
# Usage:
#   ./load-test.sh [total_requests] [concurrency] [url]
#
# Examples:
#   ./load-test.sh                     # 100 requests, 10 at a time
#   ./load-test.sh 500 25              # 500 requests, 25 at a time
#   ./load-test.sh 200 10 http://localhost/api/products
# =========================================================

TOTAL="${1:-100}"
CONCURRENCY="${2:-10}"
URL="${3:-http://localhost/api/products}"

TMP_DIR=$(mktemp -d)
RESULTS_FILE="$TMP_DIR/results.txt"

echo "Target:       $URL"
echo "Requests:     $TOTAL"
echo "Concurrency:  $CONCURRENCY"
echo ""
echo "Firing requests..."

send_request() {

    local id=$1

    # -s silent, -o discard body, -w print status + custom
    # header + timing on one line. curl can't easily extract
    # a single response header directly in -w, so we grab
    # headers separately with -D.

    local header_file="$TMP_DIR/headers_$id.txt"

    local http_code
    http_code=$(curl -s -o /dev/null -D "$header_file" \
        -w "%{http_code}" \
        --max-time 5 \
        "$URL")

    local served_by
    served_by=$(grep -i "^x-served-by:" "$header_file" \
        | tr -d '\r' \
        | awk '{print $2}')

    served_by="${served_by:-unknown}"

    echo "$http_code $served_by" >> "$RESULTS_FILE"

    rm -f "$header_file"

}

export -f send_request
export URL TMP_DIR RESULTS_FILE

# Run requests with limited concurrency using xargs.
seq 1 "$TOTAL" | xargs -P "$CONCURRENCY" -I {} bash -c 'send_request "$@"' _ {}

echo ""
echo "========================================"
echo "RESULTS"
echo "========================================"

echo ""
echo "-- HTTP status codes --"
awk '{print $1}' "$RESULTS_FILE" | sort | uniq -c | sort -rn

echo ""
echo "-- Requests per container (X-Served-By) --"
awk '{print $2}' "$RESULTS_FILE" | sort | uniq -c | sort -rn

echo ""
TOTAL_SENT=$(wc -l < "$RESULTS_FILE")
FAILED=$(awk '$1 !~ /^2/' "$RESULTS_FILE" | wc -l)

echo "Total sent:   $TOTAL_SENT"
echo "Non-2xx:      $FAILED"

rm -rf "$TMP_DIR"
