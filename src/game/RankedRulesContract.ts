import { RANKED_CORE_RULES_HASH, RANKED_CORE_SCHEMA_VERSION } from "../../shared/ranked-core";

export interface RankedRulesContract {
  rulesHash?: string;
  rulesVersion?: number;
}

export const CURRENT_RANKED_RULES_CONTRACT = {
  rulesHash: RANKED_CORE_RULES_HASH,
  rulesVersion: RANKED_CORE_SCHEMA_VERSION,
} as const;

export function matchesCurrentRankedRulesContract(contract: RankedRulesContract | undefined): boolean {
  return contract?.rulesHash === RANKED_CORE_RULES_HASH && contract.rulesVersion === RANKED_CORE_SCHEMA_VERSION;
}
