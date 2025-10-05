export namespace Molecule {
  export interface Spec {
    id: string
    description: string
    actions: Action[]
    oracles: OracleRef[]
  }

  export interface Action {
    toolID: string
    params: Record<string, any>
  }

  export interface OracleRef {
    type: "bash"
    check: string
  }

  export interface Attestation {
    moleculeID: string
    timestamp: number
    inputHash: string
    outputHash: string
    oracleResults: OracleResult[]
    success: boolean
  }

  export interface OracleResult {
    oracle: OracleRef
    passed: boolean
    output: string
  }
}
