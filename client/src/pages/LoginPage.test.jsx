import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoginPage from "./LoginPage";

const mockLogin = vi.fn();

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("disables Log In button when required fields are empty", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Log In" })).toBeDisabled();
  });

  it("shows required validation messages on submit", () => {
    const { container } = renderPage();

    fireEvent.submit(container.querySelector("form"));

    expect(screen.getByText("The username is required and cannot be empty")).toBeInTheDocument();
    expect(screen.getByText("The Password is required and cannot be empty")).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("shows API error for wrong credentials", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(new Error("Invalid username/password, Try again!"));
    renderPage();

    await user.type(screen.getByPlaceholderText("username"), "araj");
    await user.type(screen.getByPlaceholderText("password"), "!23");
    await user.click(screen.getByRole("button", { name: "Log In" }));

    expect(screen.getByText("Invalid username/password, Try again!")).toBeInTheDocument();
  });

  it("logs in successfully and redirects to Home", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce(undefined);
    renderPage();

    await user.type(screen.getByPlaceholderText("username"), "asdf.asdf");
    await user.type(screen.getByPlaceholderText("password"), "Asdf@1234");
    await user.click(screen.getByRole("button", { name: "Log In" }));

    expect(mockLogin).toHaveBeenCalledWith("asdf.asdf", "Asdf@1234");
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
  });
});
