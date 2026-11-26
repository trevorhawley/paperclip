import { expect, it } from "vitest";
import { signInErrorMessage } from "./Auth";

it("explains an untrusted address instead of implying a wrong password", () => {
  const err = { code: "INVALID_ORIGIN" };
  expect(signInErrorMessage(err, "Invalid origin", { hostname: "localhost", href: "http://localhost:3100/auth" }))
    .toContain("Open http://127.0.0.1:3100/auth instead");
  expect(signInErrorMessage(err, "Invalid origin", { hostname: "paperclip.example", href: "https://paperclip.example/auth" }))
    .toContain("isn't trusted for sign-in");
  expect(signInErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" }, "Invalid email or password", { hostname: "localhost", href: "x" }))
    .toBe("Invalid email or password");
});
