import { describe, expect, it } from "vitest";
import { formatCpf, formatPhone } from "../lib/brazil";

describe("Brazilian document and phone formatting", () => {
  it("formats CPF progressively and limits it to 11 digits", () => {
    expect(formatCpf("5299")).toBe("529.9");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("529.982.247-25 extra 99")).toBe("529.982.247-25");
  });

  it("formats landline and mobile phone numbers", () => {
    expect(formatPhone("1630000000")).toBe("(16) 3000-0000");
    expect(formatPhone("16999990000")).toBe("(16) 99999-0000");
    expect(formatPhone("(16) 99999-0000 extra 99")).toBe(
      "(16) 99999-0000",
    );
  });
});
