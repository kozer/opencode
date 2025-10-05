# Agentic Molecules

Molecules are atomic, auditable work units for the OpenCode CLI. They provide deterministic execution with oracle-validated constraints.

## Quick Start

Execute a molecule from a spec file:

```bash
opencode molecule run <spec-file>
```

Validate a spec without execution:

```bash
opencode molecule run <spec-file> --dry-run
```

## Molecule Spec Format

Molecules are defined in JSON, TypeScript, or JavaScript files:

```json
{
  "id": "unique-molecule-id",
  "description": "What this molecule does",
  "actions": [
    {
      "toolID": "write",
      "params": {
        "filePath": "path/to/file.txt",
        "content": "File content"
      }
    }
  ],
  "oracles": [
    {
      "type": "bash",
      "check": "test -d path/to"
    }
  ]
}
```

### Spec Components

- **id**: Unique identifier for the molecule
- **description**: Human-readable description
- **actions**: Array of tool invocations to execute
- **oracles**: Array of pre-execution validation checks

## Available Tools

- `bash` - Execute shell commands
- `write` - Create or overwrite files
- `edit` - Modify existing files
- `read` - Read file contents
- `grep` - Search file contents
- `glob` - Find files by pattern
- `list` - List directory contents

## Oracles

Oracles are bash commands that must succeed (exit code 0) before execution:

```json
{
  "type": "bash",
  "check": "test -d /required/directory"
}
```

If any oracle fails, the molecule aborts and no actions are executed.

## Attestations

Every molecule execution produces an attestation containing:

- Input hash (deterministic based on spec)
- Output hash (based on action results)
- Oracle results (passed/failed with output)
- Success status
- Timestamp

## Examples

See `examples/molecules/` for sample molecule specs:

- `hello-world.json` - Simple file creation
- `create-readme.json` - File creation with oracle validation
- `oracle-failure-test.json` - Oracle failure blocking execution
- `multi-action.json` - Multiple bash and write actions

## Implementation Status

✅ **Completed:**

- Core executor with pre-oracle validation
- CLI command integration (`opencode molecule run`)
- Deterministic input/output hashing
- Attestation generation
- Tool registry (bash, write, edit, read, grep, glob, list)
- Tests validating execution and determinism

🚧 **Future Enhancements:**

- Post-oracles (validate after execution)
- Rollback on failure
- CAS (Content-Addressable Storage) for attestations
- Ledger for querying execution history
- Additional oracle types (test, lint, policy)
- Molecule chaining and composition

## Architecture

```
Molecule Spec (JSON/TS/JS)
    ↓
Executor.execute()
    ↓
1. Hash inputs (spec + timestamp)
2. Run pre-oracles (must pass)
3. Execute actions (using tool registry)
4. Hash outputs (action results + timestamp)
5. Create attestation
    ↓
ExecutionResult { success, attestation, outputs, errors }
```

## Design Principles

1. **Deterministic** - Same spec → same hashes (mostly, timestamps differ)
2. **Oracle-first** - Pre-execution validation blocks bad changes
3. **Auditable** - Every execution produces an attestation
4. **Tool-based** - Reuses OpenCode's existing tool infrastructure
5. **Minimal** - ~150 LOC for core implementation

## Development

Run tests:

```bash
cd packages/opencode
bun test src/molecule/__tests__/
```

Test CLI locally:

```bash
cd packages/opencode
bun dev molecule run ../../examples/molecules/hello-world.json
```
