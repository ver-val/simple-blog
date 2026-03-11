import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ForgotPasswordPage from "./ForgotPasswordPage";
import ResetPasswordPage from "./ResetPasswordPage";

describe("ResetPasswordPage", () => {
  it("redirects to forgot password with error when token is missing", async () => {
    render(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Forgot Password" })).toBeInTheDocument();
    });
    expect(screen.getByText("Password reset token is invalid or has expired.")).toBeInTheDocument();
  });

  it("stays on reset page when token exists", async () => {
    render(
      <MemoryRouter initialEntries={["/reset-password?token=abc123"]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Reset Password" })).toBeInTheDocument();
  });
});
