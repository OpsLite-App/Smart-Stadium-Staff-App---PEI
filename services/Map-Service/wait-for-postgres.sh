#!/bin/sh
set -e

host="$1"
shift
postgres_user="${POSTGRES_USER:-postgres}"

until pg_isready -h "$host" -U "$postgres_user"; do
  echo "Waiting for postgres at $host..."
  sleep 2
done

exec "$@"
