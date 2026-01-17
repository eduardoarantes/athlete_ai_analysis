# Port Configuration

This project uses a `.env` file to configure all service ports. This allows you to:
- Avoid port conflicts with other services
- Run instances on different machines without conflicts
- Easily change ports for different environments

## Quick Start

1. **Edit `.env` file** with your desired ports
2. **Run `make start`**

That's it!

## Default Ports

The default configuration in `.env`:

```bash
# Application Ports
API_PORT=8000
WEB_PORT=3000

# Supabase Ports
SUPABASE_API_PORT=54321
SUPABASE_DB_PORT=54322
SUPABASE_STUDIO_PORT=54323
SUPABASE_INBUCKET_PORT=54324
SUPABASE_POOLER_PORT=54329
```

## Changing Ports

If you have port conflicts (e.g., another service is using port 8000), simply edit `.env`:

```bash
# Example: If ports 8000 and 3000 are taken
API_PORT=9000
WEB_PORT=4000

# Supabase ports can stay the same unless also conflicting
SUPABASE_API_PORT=54321
SUPABASE_DB_PORT=54322
SUPABASE_STUDIO_PORT=54323
SUPABASE_INBUCKET_PORT=54324
SUPABASE_POOLER_PORT=54329
```

Then just run:
```bash
make start
```

## Port Allocation Strategy

### Default Instance (INSTANCE_NAME=default)
- **API:** 8000
- **Web:** 3000
- **Supabase API:** 54321
- **Supabase DB:** 54322
- **Supabase Studio:** 54323
- **Supabase Inbucket:** 54324
- **Supabase Pooler:** 54329

### Instance 2 (INSTANCE_NAME=dev2)
- **API:** 8001 (+1)
- **Web:** 3001 (+1)
- **Supabase API:** 54331 (+10)
- **Supabase DB:** 54332 (+10)
- **Supabase Studio:** 54333 (+10)
- **Supabase Inbucket:** 54334 (+10)
- **Supabase Pooler:** 54339 (+10)

### Instance 3 (INSTANCE_NAME=dev3)
- **API:** 8002 (+2)
- **Web:** 3002 (+2)
- **Supabase API:** 54341 (+20)
- **Supabase DB:** 54342 (+20)
- **Supabase Studio:** 54343 (+20)
- **Supabase Inbucket:** 54344 (+20)
- **Supabase Pooler:** 54349 (+20)

## Available Commands

All standard commands work with instance configuration:

```bash
# Status (all services)
make status

# Individual service status
make api-status
make web-status
make db-status

# Start services
make start              # All services
make api-start          # Just API
make web-start          # Just Web
make db-start           # Just Supabase

# Stop services
make stop               # All services
make api-stop           # Just API
make web-stop           # Just Web
make db-stop            # Just Supabase

# Restart
make restart
make api-restart
make web-restart
make db-restart

# View logs
make api-logs
make web-logs
make db-logs

# Database operations
make db-studio          # Open Supabase Studio
make db-migrations      # Show migration status
make db-reset          # Reset database (WARNING: destroys data!)
```

## Managing Multiple Instances

### Using Shell Scripts

Create helper scripts for each instance:

**start-default.sh:**
```bash
#!/bin/bash
make start
```

**start-dev2.sh:**
```bash
#!/bin/bash
set -a
source .env.instance2
set +a
make start
```

**stop-all-instances.sh:**
```bash
#!/bin/bash
# Stop default
make stop

# Stop dev2
INSTANCE_NAME=dev2 make stop

# Stop dev3
INSTANCE_NAME=dev3 make stop
```

### Using tmux/Terminal Multiplexer

```bash
# Create a tmux session with multiple panes
tmux new-session -d -s cycling-ai

# Default instance (pane 0)
tmux send-keys -t cycling-ai:0.0 'make start' C-m

# Split and start instance2 (pane 1)
tmux split-window -h -t cycling-ai:0
tmux send-keys -t cycling-ai:0.1 'set -a && source .env.instance2 && set +a && make start' C-m

# Attach to session
tmux attach -t cycling-ai
```

## Docker Networks

Each instance creates its own Docker network to isolate Supabase containers:
- **default:** `supabase_network_default`
- **dev2:** `supabase_network_dev2`
- **dev3:** `supabase_network_dev3`

This prevents port conflicts and container name collisions.

### Viewing Docker Networks

```bash
# List all networks
docker network ls | grep supabase

# Inspect a network
docker network inspect supabase_network_default
```

## Troubleshooting

### Port Already in Use

If you see "port already in use" errors:

1. Check what's using the port:
   ```bash
   lsof -i :8000
   lsof -i :54321
   ```

2. Stop conflicting processes:
   ```bash
   # Stop by instance name
   INSTANCE_NAME=dev2 make stop

   # Or kill by port
   lsof -ti :8000 | xargs kill -9
   ```

### Supabase Won't Start

1. Check Docker is running:
   ```bash
   docker ps
   ```

2. Clean up old containers:
   ```bash
   docker ps -a | grep supabase
   docker rm -f $(docker ps -a -q --filter name=supabase)
   ```

3. Remove networks:
   ```bash
   docker network rm supabase_network_default
   docker network rm supabase_network_dev2
   ```

4. Try again:
   ```bash
   make db-start
   ```

### Configuration Not Loading

Ensure you're sourcing the environment correctly:

```bash
# WRONG - doesn't export variables to make
source .env.instance2
make start

# CORRECT - exports variables before make
set -a && source .env.instance2 && set +a && make start

# ALTERNATIVE - pass variables inline
INSTANCE_NAME=dev2 API_PORT=8001 WEB_PORT=3001 make start
```

### Database Migrations

Each instance has its own database. After starting a new instance:

1. Check migration status:
   ```bash
   make db-migrations
   ```

2. If migrations aren't applied:
   ```bash
   cd web
   npx supabase db reset
   ```

## Best Practices

### 1. Use Consistent Naming
- `default` - Main development instance
- `dev2`, `dev3` - Additional dev instances
- `test` - Testing/CI instance
- `staging` - Staging instance (if running locally)

### 2. Document Your Instances

Create a `.instances` file in your project:
```
# Active Instances
default - Main development (ports 8000/3000/54321-54324)
dev2    - Feature testing (ports 8001/3001/54331-54334)
```

### 3. Clean Up Unused Instances

Regularly stop and remove unused instances:
```bash
# Stop all instances
make stop
INSTANCE_NAME=dev2 make stop
INSTANCE_NAME=dev3 make stop

# Clean up Docker networks
docker network prune
```

### 4. Use .env Files for Persistence

Don't rely on inline environment variables for long-running instances. Create dedicated `.env.dev2`, `.env.test` files.

### 5. Backup Databases Before Cleanup

```bash
# Export database for instance
cd web
npx supabase db dump --local -f backup-default.sql

# For specific instance (requires network flag)
docker exec supabase_db_dev2 pg_dump -U postgres postgres > backup-dev2.sql
```

## Example Workflows

### Frontend Developer Working on Two Features

```bash
# Terminal 1: Main feature
make start
# Work on main feature at localhost:3000

# Terminal 2: Experimental feature
set -a && source .env.instance2 && set +a
make start
# Work on experimental at localhost:3001
```

### Testing Database Migrations

```bash
# Instance 1: Current migration state
make start

# Instance 2: Test new migrations
set -a && source .env.instance2 && set +a
make start
cd web
npx supabase migration new test_migration
# Edit migration...
npx supabase db reset
# Test migration applies correctly
```

### API Versioning

```bash
# Instance 1: v1 API
export API_VERSION=v1
make start

# Instance 2: v2 API
export API_VERSION=v2
set -a && source .env.instance2 && set +a
make start
```

## Environment Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `INSTANCE_NAME` | `default` | Unique instance identifier |
| `API_PORT` | `8000` | FastAPI server port |
| `WEB_PORT` | `3000` | Next.js server port |
| `SUPABASE_API_PORT` | `54321` | PostgREST API port |
| `SUPABASE_DB_PORT` | `54322` | PostgreSQL port |
| `SUPABASE_STUDIO_PORT` | `54323` | Supabase Studio port |
| `SUPABASE_INBUCKET_PORT` | `54324` | Email testing port |
| `SUPABASE_POOLER_PORT` | `54329` | Connection pooler port |

## Tips

- Use `make help` to see all available commands with current port configuration
- Each instance's Supabase Studio is independent - data won't be shared
- Log files are instance-specific (`.api.log`, `web/.dev.log`)
- Increment Supabase ports by 10 to avoid conflicts (54321 → 54331 → 54341)
- Increment app ports by 1 (8000 → 8001 → 8002)
