import { createHash } from "crypto"
import type { Tool } from "../tool/tool.js"
import type { Molecule } from "./types.js"

export namespace Executor {
  export interface Context {
    sessionID: string
    messageID: string
    agent: string
    toolRegistry: Map<string, Tool.Info>
  }

  export interface ExecutionResult {
    success: boolean
    attestation: Molecule.Attestation
    outputs: Map<string, any>
    errors?: Error[]
  }

  function hash(content: string): string {
    return createHash("sha256").update(content).digest("hex")
  }

  export async function execute(spec: Molecule.Spec, ctx: Context): Promise<ExecutionResult> {
    const outputs = new Map<string, any>()
    const errors: Error[] = []
    const oracleResults: Molecule.OracleResult[] = []

    const inputHash = hash(JSON.stringify({ spec, timestamp: Date.now() }))

    for (const oracle of spec.oracles.filter((o) => o.type === "bash")) {
      const result = await runBashOracle(oracle, ctx)
      oracleResults.push(result)

      if (!result.passed) {
        errors.push(new Error(`Pre-oracle failed: ${oracle.check}`))
        return {
          success: false,
          attestation: {
            moleculeID: spec.id,
            timestamp: Date.now(),
            inputHash,
            outputHash: "",
            oracleResults,
            success: false,
          },
          outputs,
          errors,
        }
      }
    }

    for (const action of spec.actions) {
      const tool = ctx.toolRegistry.get(action.toolID)
      if (!tool) {
        errors.push(new Error(`Tool not found: ${action.toolID}`))
        continue
      }

      const toolImpl = await tool.init()
      const result = await toolImpl.execute(action.params, {
        sessionID: ctx.sessionID,
        messageID: ctx.messageID,
        agent: ctx.agent,
        abort: new AbortController().signal,
        metadata: () => {},
      })

      outputs.set(action.toolID, result)
    }

    const outputHash = hash(
      JSON.stringify({
        outputs: Array.from(outputs.entries()),
        timestamp: Date.now(),
      }),
    )

    const attestation: Molecule.Attestation = {
      moleculeID: spec.id,
      timestamp: Date.now(),
      inputHash,
      outputHash,
      oracleResults,
      success: errors.length === 0,
    }

    return {
      success: errors.length === 0,
      attestation,
      outputs,
      errors: errors.length > 0 ? errors : undefined,
    }
  }

  async function runBashOracle(oracle: Molecule.OracleRef, ctx: Context): Promise<Molecule.OracleResult> {
    const bashTool = ctx.toolRegistry.get("bash")
    if (!bashTool) {
      return {
        oracle,
        passed: false,
        output: "Bash tool not available",
      }
    }

    const toolImpl = await bashTool.init()
    const result = await toolImpl.execute(
      { command: oracle.check, description: "Oracle check" },
      {
        sessionID: ctx.sessionID,
        messageID: ctx.messageID,
        agent: ctx.agent,
        abort: new AbortController().signal,
        metadata: () => {},
      },
    )

    return {
      oracle,
      passed: result.metadata?.["exit"] === 0,
      output: result.output,
    }
  }
}
