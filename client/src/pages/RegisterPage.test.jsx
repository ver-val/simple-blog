import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RegisterPage from "./RegisterPage";

const mockRegister = vi.fn();

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ register: mockRegister }),
}));

describe("RegisterPage", () => {
  beforeEach(() => {
    mockRegister.mockReset();
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("disables Register Now when required fields are empty", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Register Now" })).toBeDisabled();
  });

  it("shows validation error for invalid email", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("username"), "asdf");
    await user.type(screen.getByPlaceholderText("email"), "asdf");
    await user.type(screen.getByPlaceholderText("password"), "Asdf@1234");
    await user.type(screen.getByPlaceholderText("confirm password"), "Asdf@1234");
    await user.click(screen.getByRole("button", { name: "Register Now" }));

    expect(screen.getByText("The email address is not valid")).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("shows validation error when password and confirm password mismatch", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("username"), "asdf");
    await user.type(screen.getByPlaceholderText("email"), "asdf.asdf@example.com");
    await user.type(screen.getByPlaceholderText("password"), "Asdf@1234");
    await user.type(screen.getByPlaceholderText("confirm password"), "Asdf@1235");
    await user.click(screen.getByRole("button", { name: "Register Now" }));

    expect(screen.getByText("The password and its confirm are not the same")).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("registers successfully and redirects to Home", async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValueOnce(undefined);
    renderPage();

    await user.type(screen.getByPlaceholderText("username"), "asdf.asdf");
    await user.type(screen.getByPlaceholderText("email"), "asdf.asdf@example.com");
    await user.type(screen.getByPlaceholderText("password"), "Asdf@1234");
    await user.type(screen.getByPlaceholderText("confirm password"), "Asdf@1234");
    await user.click(screen.getByRole("button", { name: "Register Now" }));

    expect(mockRegister).toHaveBeenCalledWith("asdf.asdf", "asdf.asdf@example.com", "Asdf@1234");
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
  });

  it("does not submit when fields are blank and shows username error on submit", () => {
    const { container } = renderPage();

    fireEvent.submit(container.querySelector("form"));

    expect(screen.getByText("The username is required and cannot be empty")).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });
});
