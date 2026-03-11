import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import HomePage from "./HomePage";

vi.mock("../api/http", () => ({
  api: {
    getPosts: vi.fn().mockResolvedValue([]),
  },
}));

describe("HomePage", () => {
  it("shows registration success message when registered=1", async () => {
    render(
      <MemoryRouter initialEntries={["/?registered=1"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Congrats! Your registration has been successful.")).toBeInTheDocument();
  });

  it("shows profile update success message when profileUpdated=1", async () => {
    render(
      <MemoryRouter initialEntries={["/?profileUpdated=1"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Profile updated successfully!")).toBeInTheDocument();
  });
});
