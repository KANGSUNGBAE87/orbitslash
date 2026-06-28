import { describe, expect, it } from "vitest";
import { groupByComboTimeout } from "./ComboTiming";

describe("groupByComboTimeout", () => {
  it("timeout 미만 공백은 같은 combo group으로 묶는다", () => {
    const groups = groupByComboTimeout(
      [
        { id: 1, hitAtMs: 0 },
        { id: 2, hitAtMs: 300 },
        { id: 3, hitAtMs: 649 },
      ],
      650,
    );

    expect(groups.map((group) => group.map((item) => item.id))).toEqual([[1, 2, 3]]);
  });

  it("timeout 이상 공백은 같은 stroke 안에서도 combo group을 끊는다", () => {
    const groups = groupByComboTimeout(
      [
        { id: 1, hitAtMs: 0 },
        { id: 2, hitAtMs: 500 },
        { id: 3, hitAtMs: 1150 },
      ],
      650,
    );

    expect(groups.map((group) => group.map((item) => item.id))).toEqual([[1, 2], [3]]);
  });
});
