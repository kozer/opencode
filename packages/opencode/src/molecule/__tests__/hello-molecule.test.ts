import { describe, expect, test } from "bun:test"
import path from "path"
import { BashTool } from "../../tool/bash"
import { WriteTool } from "../../tool/write"
import { Log } from "../../util/log"
import { Instance } from "../../project/instance"
import { Executor } from "../executor"
import type { Molecule } from "../types"

const projectRoot = path.join(__dirname, "../..")
Log.init({ print: false })

describe("molecule.poc", () => {
  test("hello molecule - basic execution", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const toolRegistry = new Map()
        toolRegistry.set("bash", BashTool)
        toolRegistry.set("write", WriteTool)

        const spec: Molecule.Spec = {
          id: "hello-world",
          description: "Write hello.txt",
          actions: [
            {
              toolID: "write",
              params: {
                filePath: path.join(projectRoot, "test-hello.txt"),
                content: "Hello, Molecules!",
              },
            },
          ],
          oracles: [
            {
              type: "bash",
              check: `test -d ${projectRoot}`,
            },
          ],
        }

        const ctx: Executor.Context = {
          sessionID: "test-session",
          messageID: "test-message",
          agent: "build",
          toolRegistry,
        }

        const result = await Executor.execute(spec, ctx)

        expect(result.success).toBe(true)
        expect(result.attestation.moleculeID).toBe("hello-world")
        expect(result.attestation.inputHash).toBeTruthy()
        expect(result.attestation.outputHash).toBeTruthy()
        expect(result.attestation.oracleResults).toHaveLength(1)
        expect(result.attestation.oracleResults[0].passed).toBe(true)

        await Bun.write(path.join(projectRoot, "test-hello.txt"), "")
      },
    })
  })

  test("hello molecule - determinism check", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const toolRegistry = new Map()
        toolRegistry.set("bash", BashTool)
        toolRegistry.set("write", WriteTool)

        const spec: Molecule.Spec = {
          id: "hello-determinism",
          description: "Test deterministic execution",
          actions: [
            {
              toolID: "write",
              params: {
                filePath: path.join(projectRoot, "test-determinism.txt"),
                content: "Deterministic content",
              },
            },
          ],
          oracles: [],
        }

        const ctx: Executor.Context = {
          sessionID: "test-session",
          messageID: "test-message",
          agent: "build",
          toolRegistry,
        }

        const result1 = await Executor.execute(spec, ctx)

        expect(result1.success).toBe(true)

        await Bun.write(path.join(projectRoot, "test-determinism.txt"), "")
      },
    })
  })
})
