import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Layout from "./Layout";

const mockLogout = vi.fn();
let authState = {
  isAuthenticated: false,
  user: null,
  logout: mockLogout,
};

vi.mock("../context/AuthContext", () => ({
  useAuth: () => authState,
}));

describe("Layout", () => {
  beforeEach(() => {
    mockLogout.mockReset();
  });

  it("shows Dashboard and Logout links for logged in users", () => {
    authState = {
      isAuthenticated: true,
      user: { displayName: "asdf.asdf" },
      logout: mockLogout,
    };

    render(
      <MemoryRouter>
        <Layout>
          <div>content</div>
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Logout" })).toBeInTheDocument();
  });

  it("shows Login/Register links for guests", () => {
    authState = {
      isAuthenticated: false,
      user: null,
      logout: mockLogout,
    };

    render(
      <MemoryRouter>
        <Layout>
          <div>content</div>
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument();
  });
});
