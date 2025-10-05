import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import { Executor } from "../../molecule/executor"
import type { Molecule } from "../../molecule/types"
import { BashTool } from "../../tool/bash"
import { WriteTool } from "../../tool/write"
import { EditTool } from "../../tool/edit"
import { ReadTool } from "../../tool/read"
import { GrepTool } from "../../tool/grep"
import { GlobTool } from "../../tool/glob"
import { ListTool } from "../../tool/ls"

export const MoleculeCommand = cmd({
  command: "molecule",
  describe: "Execute molecules - atomic, auditable work units",
  builder: (yargs: Argv) => {
    return yargs.command(
      "run <spec-file>",
      "Execute a molecule from spec file",
      (yargs) => {
        return yargs
          .positional("spec-file", {
            describe: "Path to molecule spec file (JSON or TypeScript)",
            type: "string",
            demandOption: true,
          })
          .option("dry-run", {
            describe: "Validate without executing",
            type: "boolean",
            default: false,
          })
      },
      async (args) => {
        const specFile = args["spec-file"] as string

        await bootstrap(process.cwd(), async () => {
          const file = Bun.file(specFile)
          if (!(await file.exists())) {
            UI.error(`Spec file not found: ${specFile}`)
            process.exit(1)
          }

          const content = await file.text()
          let spec: Molecule.Spec

          if (specFile.endsWith(".json")) {
            spec = JSON.parse(content)
          } else if (specFile.endsWith(".ts") || specFile.endsWith(".js")) {
            const module = await import(specFile)
            spec = module.default || module.spec
          } else {
            UI.error("Spec file must be .json, .ts, or .js")
            process.exit(1)
          }

          if (args["dry-run"]) {
            UI.println(UI.Style.TEXT_SUCCESS_BOLD + "✓  Spec is valid")
            UI.println(UI.Style.TEXT_NORMAL + "   ID: " + spec.id)
            UI.println(UI.Style.TEXT_NORMAL + "   Description: " + spec.description)
            UI.println(UI.Style.TEXT_NORMAL + "   Actions: " + spec.actions.length)
            UI.println(UI.Style.TEXT_NORMAL + "   Oracles: " + spec.oracles.length)
            return
          }

          const toolRegistry = new Map()
          toolRegistry.set("bash", BashTool)
          toolRegistry.set("write", WriteTool)
          toolRegistry.set("edit", EditTool)
          toolRegistry.set("read", ReadTool)
          toolRegistry.set("grep", GrepTool)
          toolRegistry.set("glob", GlobTool)
          toolRegistry.set("list", ListTool)

          const ctx: Executor.Context = {
            sessionID: "molecule-" + Date.now(),
            messageID: "msg-" + Date.now(),
            agent: "build",
            toolRegistry,
          }

          UI.println(UI.Style.TEXT_INFO_BOLD + "▸  Executing molecule: " + spec.id)
          UI.println(UI.Style.TEXT_DIM + "   " + spec.description)

          const startTime = Date.now()
          const result = await Executor.execute(spec, ctx)
          const duration = Date.now() - startTime

          if (result.success) {
            UI.println(UI.Style.TEXT_SUCCESS_BOLD + "✓  Success" + UI.Style.TEXT_DIM + ` (${duration}ms)`)
            UI.println(UI.Style.TEXT_NORMAL + "   Input hash:  " + result.attestation.inputHash.slice(0, 16) + "...")
            UI.println(UI.Style.TEXT_NORMAL + "   Output hash: " + result.attestation.outputHash.slice(0, 16) + "...")

            if (result.attestation.oracleResults.length > 0) {
              UI.println(UI.Style.TEXT_INFO_BOLD + "   Oracles:")
              for (const oracle of result.attestation.oracleResults) {
                const status = oracle.passed ? "✓" : "✗"
                const color = oracle.passed ? UI.Style.TEXT_SUCCESS : UI.Style.TEXT_DANGER
                UI.println(color + "     " + status + " " + oracle.oracle.check)
              }
            }
          } else {
            UI.println(UI.Style.TEXT_DANGER_BOLD + "✗  Failed" + UI.Style.TEXT_DIM + ` (${duration}ms)`)
            if (result.errors) {
              for (const error of result.errors) {
                UI.println(UI.Style.TEXT_DANGER + "   " + error.message)
              }
            }
            process.exit(1)
          }
        })
      },
    )
  },
  handler: () => {},
})
