import { describe, expect, it } from "vitest";
import { executePreparedPaperBuy } from "./paper-buy-execution-gate.server";
import type { PreparedPaperBuy } from "./paper-buy-boundary.server";

describe("paper buy execution gate", () => {
  it("always fails closed without invoking RPC", () => {
    const receipt = executePreparedPaperBuy({} as PreparedPaperBuy);
    expect(receipt).toMatchObject({ status: "execution_disabled", executed: false });
  });
});
